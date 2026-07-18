import { createClient } from "@/lib/supabase/server";
import type { Product } from "./types";

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

/** Todos los productos activos, con filtro opcional por categoría (catálogo). */
export async function getActiveProducts(
  categoria?: string,
): Promise<Product[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("activo", true)
    .order("created_at", { ascending: false });

  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("getActiveProducts:", error.message);
    return [];
  }
  return (data as Product[]) ?? [];
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
