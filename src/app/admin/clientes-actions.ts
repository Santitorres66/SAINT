"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ClienteInput, ActionResult } from "@/lib/types";

function revalidar() {
  revalidatePath("/admin/clientes");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function datos(input: ClienteInput) {
  return {
    nombre: input.nombre.trim(),
    apellido: input.apellido?.trim() ?? "",
    telefono: input.telefono?.trim() ?? "",
    email: input.email?.trim() ?? "",
    domicilio: input.domicilio?.trim() ?? "",
    localidad: input.localidad?.trim() ?? "",
    provincia: input.provincia?.trim() ?? "",
    observaciones: input.observaciones?.trim() ?? "",
  };
}

export async function createCliente(input: ClienteInput): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("clientes").insert(datos(input));
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidar();
  redirect("/admin/clientes");
}

export async function updateCliente(
  id: string,
  input: ClienteInput,
): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("clientes").update(datos(input)).eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidar();
  redirect("/admin/clientes");
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidar();
  return { ok: true };
}
