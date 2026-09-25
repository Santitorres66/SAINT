"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, TrabajoInput } from "@/lib/types";

/**
 * Server Actions de la galería de trabajos reales.
 *
 * Mismo criterio que el resto del panel: se escribe con el cliente de servidor
 * (que lleva la sesión del admin), así RLS solo deja pasar si hay alguien
 * logueado, y después se revalidan las rutas públicas para que la foto nueva
 * aparezca en la web al instante.
 */

function revalidarPublico(id?: string) {
  revalidatePath("/");
  revalidatePath("/galeria");
  if (id) revalidatePath(`/galeria/${id}`);
  revalidatePath("/admin/galeria");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Deja los datos del formulario listos para la base.
 *
 * La foto es lo único obligatorio: un trabajo sin foto no es nada en una
 * galería. El título, en cambio, puede faltar — a veces la pieza habla sola.
 */
function preparar(input: TrabajoInput) {
  return {
    titulo: input.titulo?.trim() ?? "",
    descripcion: input.descripcion?.trim() ?? "",
    imagenes: (input.imagenes ?? []).filter(Boolean),
    cliente: input.cliente?.trim() ?? "",
    prenda: input.prenda?.trim() ?? "",
    product_id: input.product_id || null,
    destacado: Boolean(input.destacado),
    orden: Number.isFinite(input.orden) ? input.orden : 0,
    activo: Boolean(input.activo),
  };
}

function validar(input: TrabajoInput): string | null {
  if (!input.imagenes?.filter(Boolean).length)
    return "Subí al menos una foto del trabajo.";
  return null;
}

/** Carga un trabajo nuevo. */
export async function createTrabajo(
  input: TrabajoInput,
): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("galeria_trabajos")
    .insert(preparar(input));

  if (error) return { error: error.message };
  revalidarPublico();
  // Como en el resto del panel: al guardar se vuelve al listado.
  redirect("/admin/galeria");
}

/** Edita un trabajo ya cargado. */
export async function updateTrabajo(
  id: string,
  input: TrabajoInput,
): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("galeria_trabajos")
    .update(preparar(input))
    .eq("id", id);

  if (error) return { error: error.message };
  revalidarPublico(id);
  redirect("/admin/galeria");
}

/**
 * Muestra u oculta un trabajo sin borrarlo.
 *
 * Es lo que conviene hacer casi siempre: una foto que hoy no querés mostrar
 * (el cliente pidió bajarla, la sacaste mejor después) mañana puede volver, y
 * borrarla la pierde para siempre.
 */
export async function toggleTrabajoActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("galeria_trabajos")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidarPublico(id);
  return { ok: true };
}

/** Pone o saca un trabajo de los destacados de la home. */
export async function toggleTrabajoDestacado(
  id: string,
  destacado: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("galeria_trabajos")
    .update({ destacado })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidarPublico(id);
  return { ok: true };
}

/** Borra un trabajo. Las fotos quedan en el storage (no se tocan). */
export async function deleteTrabajo(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("galeria_trabajos")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidarPublico();
  return { ok: true };
}
