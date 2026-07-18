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
