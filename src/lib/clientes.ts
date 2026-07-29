import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "./types";

export async function getClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) {
    console.warn("getClientes:", error.message);
    return [];
  }
  return (data as Cliente[]) ?? [];
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Cliente) ?? null;
}
