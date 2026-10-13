import { createClient } from "@/lib/supabase/server";
import type { Order } from "./types";

/**
 * Trae todas las órdenes para el panel admin.
 * Requiere sesión: RLS solo deja leerlas a usuarios autenticados.
 */
export async function getAllOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getAllOrders:", error.message);
    return [];
  }
  return (data as Order[]) ?? [];
}

/**
 * Pedidos por transferencia que necesitan que alguien los mire:
 * los que esperan la plata, y los ya pagados que quedaron con una alerta
 * (ej.: transfirió de más y hay que devolver la diferencia).
 */
export async function getTransferenciasParaRevisar(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("metodo_pago", "transferencia")
    .or('status.eq.pending,and(status.eq.approved,notas.neq."")')
    .order("created_at", { ascending: false });

  if (error) {
    // Antes de correr pagos-transferencia.sql la columna no existe: no es
    // motivo para romper la página de ventas.
    console.warn("getTransferenciasParaRevisar:", error.message);
    return [];
  }
  return (data as Order[]) ?? [];
}
