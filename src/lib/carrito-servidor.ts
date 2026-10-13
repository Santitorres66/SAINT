import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem, Product } from "@/lib/types";
import { sanearBordado } from "@/lib/bordado";

/** Un ítem del carrito tal como lo manda el navegador (sin revisar). */
export type ItemEntrada = {
  productId: string;
  talle: string | null;
  color: string | null;
  cantidad: number;
  /** Lo que armó el cliente en el previsualizador. Viene sin revisar. */
  bordado?: unknown;
};

/**
 * Convierte el carrito del navegador en ítems de orden con datos y precios
 * de la base. Nunca confía en el navegador: el nombre, el precio y el stock
 * salen de Supabase. Devuelve un error legible si algo no cierra.
 */
export async function resolverCarrito(
  supabase: SupabaseClient,
  entrada: unknown,
): Promise<{ items: OrderItem[]; total: number } | { error: string; status: number }> {
  const lista: ItemEntrada[] = Array.isArray(entrada) ? entrada : [];
  if (lista.length === 0) {
    return { error: "El carrito está vacío.", status: 400 };
  }

  const ids = [...new Set(lista.map((i) => String(i.productId)))];
  const { data: productos, error: dbError } = await supabase
    .from("products")
    .select("*")
    .in("id", ids);

  if (dbError) {
    return { error: "No se pudieron verificar los productos.", status: 500 };
  }

  const porId = new Map<string, Product>(
    (productos as Product[]).map((p) => [p.id, p]),
  );

  // Stock por variante (talle + color) de los productos involucrados
  const { data: variantes } = await supabase
    .from("product_variantes")
    .select("product_id, talle, color, stock")
    .in("product_id", ids);
  const stockVariante = new Map<string, number>();
  (
    (variantes as {
      product_id: string;
      talle: string;
      color: string;
      stock: number;
    }[]) ?? []
  ).forEach((v) =>
    stockVariante.set(`${v.product_id}|${v.talle}|${v.color}`, v.stock),
  );

  // La misma variante puede venir en dos líneas (con bordados distintos):
  // el stock se controla contra la suma, no línea por línea.
  const pedidoPorVariante = new Map<string, number>();

  const items: OrderItem[] = [];
  for (const item of lista) {
    const prod = porId.get(String(item.productId));
    const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1));

    if (!prod || !prod.activo) {
      return { error: "Uno de los productos ya no está disponible.", status: 400 };
    }

    const talle = typeof item.talle === "string" ? item.talle.slice(0, 20) : null;
    const color = typeof item.color === "string" ? item.color.slice(0, 40) : null;

    // Verificamos el stock de la variante exacta (si existe); si no, el total.
    const keyVar = `${prod.id}|${talle ?? ""}|${color ?? ""}`;
    const disponible = stockVariante.has(keyVar)
      ? stockVariante.get(keyVar)!
      : prod.stock;
    const pedido = (pedidoPorVariante.get(keyVar) ?? 0) + cantidad;
    pedidoPorVariante.set(keyVar, pedido);
    if (disponible < pedido) {
      return {
        error: `No hay stock suficiente de "${prod.nombre}"${
          talle || color ? ` (${[talle, color].filter(Boolean).join(" · ")})` : ""
        }.`,
        status: 400,
      };
    }

    items.push({
      product_id: prod.id,
      nombre: prod.nombre,
      talle,
      color,
      cantidad,
      precio_unitario: Number(prod.precio),
      // El bordado es una anotación para el taller y se guarda recortado,
      // porque lo escribió un navegador.
      bordado: sanearBordado(item.bordado),
    });
  }

  const total = items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);
  return { items, total };
}
