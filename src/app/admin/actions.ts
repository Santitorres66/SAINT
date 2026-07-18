"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductInput, ActionResult } from "@/lib/types";

/**
 * Server Actions del panel admin: crear, editar, borrar y activar/desactivar.
 * Todas escriben con el cliente de servidor (que lleva la sesión del admin),
 * así RLS permite la operación solo si hay un usuario autenticado.
 *
 * Tras cada cambio revalidamos las rutas públicas para que la web se
 * actualice automáticamente.
 */

/** Revalida la web pública (home, tienda y el detalle del producto tocado). */
function revalidarPublico(id?: string) {
  revalidatePath("/");
  revalidatePath("/tienda");
  if (id) revalidatePath(`/producto/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
}

/** Verifica que haya un admin logueado antes de escribir. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Normaliza y valida los datos del formulario. Devuelve error legible o null. */
function validar(input: ProductInput): string | null {
  if (!input.nombre?.trim()) return "El nombre del producto es obligatorio.";
  if (!input.categoria) return "Elegí una categoría.";
  if (Number.isNaN(input.precio) || input.precio < 0)
    return "El precio tiene que ser un número válido (0 o mayor).";
  if (Number.isNaN(input.stock) || input.stock < 0)
    return "El stock tiene que ser un número válido (0 o mayor).";
  return null;
}

/** Crea un producto nuevo. */
export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("products").insert({
    nombre: input.nombre.trim(),
    categoria: input.categoria,
    precio: input.precio,
    descripcion: input.descripcion?.trim() ?? "",
    colores: input.colores ?? [],
    talles: input.talles ?? [],
    imagenes: input.imagenes ?? [],
    stock: input.stock,
    activo: input.activo,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarPublico();
  redirect("/admin/productos");
}

/** Edita un producto existente. */
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("products")
    .update({
      nombre: input.nombre.trim(),
      categoria: input.categoria,
      precio: input.precio,
      costo: input.costo ?? 0,
      descripcion: input.descripcion?.trim() ?? "",
      colores: input.colores ?? [],
      talles: input.talles ?? [],
      imagenes: input.imagenes ?? [],
      stock: input.stock,
      activo: input.activo,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarPublico(id);
  redirect("/admin/productos");
}

/** Elimina un producto. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarPublico(id);
  return { ok: true };
}

/** Activa o desactiva un producto (mostrar/ocultar en la web). */
export async function toggleActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("products")
    .update({ activo })
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidarPublico(id);
  return { ok: true };
}
