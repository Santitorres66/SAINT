"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductInput, ActionResult, VarianteInput } from "@/lib/types";

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
export async function createProduct(
  input: ProductInput,
  variantes: VarianteInput[] = [],
): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const total = variantes.reduce((a, v) => a + (v.stock || 0), 0);

  const { data: prod, error } = await supabase
    .from("products")
    .insert({
      nombre: input.nombre.trim(),
      categoria: input.categoria,
      precio: input.precio,
      costo: input.costo ?? 0,
      descripcion: input.descripcion?.trim() ?? "",
      colores: input.colores ?? [],
      talles: input.talles ?? [],
      imagenes: input.imagenes ?? [],
      stock: total,
      activo: input.activo,
    })
    .select("id")
    .single();

  if (error || !prod) return { error: `No se pudo guardar: ${error?.message}` };

  if (variantes.length) {
    const { error: vErr } = await supabase.from("product_variantes").insert(
      variantes.map((v) => ({
        product_id: prod.id,
        talle: v.talle,
        color: v.color,
        stock: v.stock,
      })),
    );
    if (vErr)
      return { error: `Producto creado, pero falló el stock: ${vErr.message}` };
  }

  revalidarPublico();
  redirect("/admin/productos");
}

/** Edita un producto existente. */
export async function updateProduct(
  id: string,
  input: ProductInput,
  variantes: VarianteInput[] = [],
): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const total = variantes.reduce((a, v) => a + (v.stock || 0), 0);

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
      stock: total,
      activo: input.activo,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Reemplazamos las variantes por las nuevas
  await supabase.from("product_variantes").delete().eq("product_id", id);
  if (variantes.length) {
    await supabase.from("product_variantes").insert(
      variantes.map((v) => ({
        product_id: id,
        talle: v.talle,
        color: v.color,
        stock: v.stock,
      })),
    );
  }

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

/**
 * Registra una PÉRDIDA (rotura, robo, defecto): descuenta stock de una
 * variante puntual, sin que sea una venta.
 */
export async function registrarPerdida(
  productId: string,
  talle: string,
  color: string,
  cantidad: number,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!cantidad || cantidad <= 0)
    return { error: "Indicá una cantidad válida." };

  const { error } = await supabase.rpc("descontar_stock_variante", {
    p_product_id: productId,
    p_talle: talle || "",
    p_color: color || "",
    p_cantidad: cantidad,
  });
  if (error) return { error: `No se pudo registrar: ${error.message}` };

  revalidarPublico(productId);
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
