import { createClient } from "@/lib/supabase/server";
import type { Product, ProductVariante, StockCorreccion } from "./types";
import { ordenarTalles } from "./constants";

/**
 * Capa de acceso a datos (solo lecturas del lado del servidor).
 * Las escrituras viven en las server actions del admin.
 *
 * Nota: usamos el cliente de servidor (con cookies), así estas páginas se
 * renderizan de forma dinámica y SIEMPRE muestran datos frescos de Supabase.
 * Por eso cualquier cambio hecho en el admin aparece al instante en la web.
 *
 * Estas funciones nunca lanzan errores: si algo falla (por ejemplo, la tabla
 * todavía no existe), avisan por consola y devuelven una lista vacía, para que
 * la web siga funcionando y muestre "no hay productos".
 */

/** Productos destacados para la home (los más nuevos, activos). */
export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("getFeaturedProducts:", error.message);
    return [];
  }
  return (data as Product[]) ?? [];
}

/** Los filtros del catálogo, tal como llegan desde la URL de la tienda. */
export type FiltrosCatalogo = {
  categoria?: string;
  /** Texto libre: busca dentro del nombre del producto. */
  q?: string;
  /** Talles elegidos: entra el producto que tenga AL MENOS uno. */
  talles?: string[];
  /** Colores elegidos: entra el producto que tenga AL MENOS uno. */
  colores?: string[];
  precioMin?: number;
  precioMax?: number;
  /** Uno de los `value` de ORDENES_CATALOGO. */
  orden?: string;
};

/**
 * Los productos activos del catálogo, ya filtrados y ordenados.
 *
 * Se filtra en la base y no en el navegador: así la URL describe exactamente lo
 * que se ve (se puede compartir o marcar como favorita) y no hace falta traer
 * todo el catálogo para mostrar cuatro productos.
 */
export async function getActiveProducts(
  filtros: FiltrosCatalogo = {},
): Promise<Product[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select("*").eq("activo", true);

  if (filtros.categoria) query = query.eq("categoria", filtros.categoria);

  // `%` y `_` son comodines de LIKE: si el cliente los escribe, valen como texto.
  if (filtros.q?.trim()) {
    const texto = filtros.q.trim().replace(/[\\%_]/g, (c) => "\\" + c);
    query = query.ilike("nombre", `%${texto}%`);
  }

  // `overlaps` = "que comparta al menos uno". Elegir S y M trae las dos cosas,
  // que es lo que espera quien usa un filtro de talles.
  if (filtros.talles?.length) query = query.overlaps("talles", filtros.talles);
  if (filtros.colores?.length)
    query = query.overlaps("colores", filtros.colores);

  if (typeof filtros.precioMin === "number")
    query = query.gte("precio", filtros.precioMin);
  if (typeof filtros.precioMax === "number")
    query = query.lte("precio", filtros.precioMax);

  // Cada criterio de ORDENES_CATALOGO en su ORDER BY. "nuevo" (el default) es
  // lo último cargado primero.
  const porColumna: Record<string, { col: string; asc: boolean }> = {
    "precio-asc": { col: "precio", asc: true },
    "precio-desc": { col: "precio", asc: false },
    nombre: { col: "nombre", asc: true },
  };
  const { col, asc } = porColumna[filtros.orden ?? ""] ?? {
    col: "created_at",
    asc: false,
  };

  const { data, error } = await query.order(col, { ascending: asc });
  if (error) {
    console.warn("getActiveProducts:", error.message);
    return [];
  }
  return (data as Product[]) ?? [];
}

/**
 * Qué opciones tiene sentido ofrecer en los filtros: los talles y colores que
 * realmente existen, y el rango de precios real.
 *
 * Se calcula sobre la categoría elegida (no sobre el resto de los filtros) para
 * que la lista de talles no cambie sola mientras el cliente la está usando.
 */
export async function getOpcionesDeCatalogo(categoria?: string): Promise<{
  talles: string[];
  colores: string[];
  precioMin: number;
  precioMax: number;
}> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("talles, colores, precio")
    .eq("activo", true);
  if (categoria) query = query.eq("categoria", categoria);

  const { data, error } = await query;
  if (error || !data?.length) {
    if (error) console.warn("getOpcionesDeCatalogo:", error.message);
    return { talles: [], colores: [], precioMin: 0, precioMax: 0 };
  }

  const filas = data as {
    talles: string[] | null;
    colores: string[] | null;
    precio: number;
  }[];

  const talles = new Set<string>();
  const colores = new Set<string>();
  let min = Infinity;
  let max = 0;

  for (const f of filas) {
    (f.talles ?? []).forEach((t) => t && talles.add(t));
    (f.colores ?? []).forEach((c) => c && colores.add(c));
    const precio = Number(f.precio) || 0;
    if (precio < min) min = precio;
    if (precio > max) max = precio;
  }

  return {
    talles: ordenarTalles([...talles]),
    colores: [...colores].sort((a, b) => a.localeCompare(b, "es")),
    precioMin: Number.isFinite(min) ? min : 0,
    precioMax: max,
  };
}

/** Variantes (stock por talle+color) de un producto. */
export async function getProductVariantes(
  productId: string,
): Promise<ProductVariante[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variantes")
    .select("*")
    .eq("product_id", productId)
    .order("talle", { ascending: true })
    .order("color", { ascending: true });
  return (data as ProductVariante[]) ?? [];
}

/**
 * Mapa `product_id → categoría`, para poder saber de qué rubro fue cada ítem
 * vendido (las ventas guardan el nombre y el precio, no la categoría).
 */
export async function getCategoriaPorProducto(): Promise<
  Record<string, string>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("id, categoria");
  if (error) {
    console.warn("getCategoriaPorProducto:", error.message);
    return {};
  }
  const mapa: Record<string, string> = {};
  for (const p of (data as { id: string; categoria: string }[]) ?? []) {
    mapa[p.id] = p.categoria;
  }
  return mapa;
}

/** Últimas correcciones manuales de stock de un producto (más nueva primero). */
export async function getCorreccionesStock(
  productId: string,
  limit = 20,
): Promise<StockCorreccion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_correcciones")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    // La tabla puede no existir todavía (falta correr stock-correcciones.sql).
    console.warn("getCorreccionesStock:", error.message);
    return [];
  }
  return (data as StockCorreccion[]) ?? [];
}

/** Todas las variantes (para la vista de productos del admin). */
export async function getAllVariantes(): Promise<ProductVariante[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("product_variantes").select("*");
  return (data as ProductVariante[]) ?? [];
}

/** Un producto por id (para el detalle público; solo activos por RLS). */
export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("getProductById:", error.message);
    return null;
  }
  return (data as Product) ?? null;
}

/**
 * Todos los productos (incluye inactivos) para el panel admin.
 * Requiere sesión: RLS solo deja ver todo a usuarios autenticados.
 */
export async function getAllProductsAdmin(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getAllProductsAdmin:", error.message);
    return [];
  }
  return (data as Product[]) ?? [];
}
