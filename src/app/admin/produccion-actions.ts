"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PRODUCCION } from "@/lib/produccion";
import type { MatrizInput, ActionResult } from "@/lib/types";

function revalidarProduccion() {
  revalidatePath("/admin/produccion");
  revalidatePath("/admin/produccion/matrices");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/* ------------------------------- Matrices -------------------------------- */

export async function createMatriz(input: MatrizInput): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre de la matriz es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("matrices").insert({
    nombre: input.nombre.trim(),
    costo: input.costo ?? 0,
    observaciones: input.observaciones?.trim() ?? "",
    archivo_path: input.archivo_path,
    imagen_path: input.imagen_path,
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarProduccion();
  redirect("/admin/produccion/matrices");
}

export async function deleteMatriz(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // Borramos los archivos del bucket para no dejar huérfanos
  const { data: matriz } = await supabase
    .from("matrices")
    .select("archivo_path, imagen_path")
    .eq("id", id)
    .single();

  const paths = [matriz?.archivo_path, matriz?.imagen_path].filter(
    (p): p is string => !!p,
  );
  if (paths.length) {
    await supabase.storage.from(BUCKET_PRODUCCION).remove(paths);
  }

  const { error } = await supabase.from("matrices").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarProduccion();
  return { ok: true };
}
