"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MOLDE_POR_DEFECTO } from "@/lib/constants";
import type {
  ProductInput,
  ActionResult,
  VarianteInput,
  CorreccionInput,
} from "@/lib/types";

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
      molde: input.molde ?? MOLDE_POR_DEFECTO,
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

/**
 * Edita un producto existente.
 *
 * Ojo con el stock: acá NO se pisa. El stock de una variante que ya existe se
 * mueve solo por compras (suma), ventas y pérdidas (restan), o por una
 * corrección explícita — que llega en `correcciones` y exige `motivo`.
 * Guardar el formulario para cambiar el precio o una foto no puede alterar
 * las cantidades del depósito.
 */
export async function updateProduct(
  id: string,
  input: ProductInput,
  variantes: VarianteInput[] = [],
  correcciones: CorreccionInput[] = [],
  motivo = "",
): Promise<ActionResult> {
  const problema = validar(input);
  if (problema) return { error: problema };

  if (correcciones.length && !motivo.trim())
    return {
      error:
        "Para corregir el stock hay que indicar el motivo (por qué no coincidía).",
    };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // `stock` no se toca: lo recalcula solo el trigger de product_variantes.
  const { error } = await supabase
    .from("products")
    .update({
      nombre: input.nombre.trim(),
      categoria: input.categoria,
      molde: input.molde ?? MOLDE_POR_DEFECTO,
      precio: input.precio,
      costo: input.costo ?? 0,
      descripcion: input.descripcion?.trim() ?? "",
      colores: input.colores ?? [],
      talles: input.talles ?? [],
      imagenes: input.imagenes ?? [],
      activo: input.activo,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  /* --- Sincronizar qué combinaciones existen, sin tocar sus cantidades --- */
  const { data: actuales } = await supabase
    .from("product_variantes")
    .select("id, talle, color")
    .eq("product_id", id);

  const clave = (t: string, c: string) => `${t}|||${c}`;
  const deseadas = new Set(variantes.map((v) => clave(v.talle, v.color)));
  const existentes = new Map(
    ((actuales as { id: string; talle: string; color: string }[]) ?? []).map(
      (v) => [clave(v.talle, v.color), v.id],
    ),
  );

  // Combinaciones que se quitaron del producto (ya no se ofrece ese talle/color)
  const aBorrar = [...existentes.entries()]
    .filter(([k]) => !deseadas.has(k))
    .map(([, vId]) => vId);
  if (aBorrar.length)
    await supabase.from("product_variantes").delete().in("id", aBorrar);

  // Combinaciones nuevas: se crean con el stock que se cargó en el formulario
  // (es carga inicial de esa variante, no una corrección).
  const aCrear = variantes.filter((v) => !existentes.has(clave(v.talle, v.color)));
  if (aCrear.length)
    await supabase.from("product_variantes").insert(
      aCrear.map((v) => ({
        product_id: id,
        talle: v.talle,
        color: v.color,
        stock: v.stock,
      })),
    );

  /* --- Correcciones manuales, con su motivo --- */
  for (const c of correcciones) {
    const { error: cErr } = await supabase.rpc("corregir_stock_variante", {
      p_product_id: id,
      p_talle: c.talle,
      p_color: c.color,
      p_stock_nuevo: c.stock_nuevo,
      p_motivo: motivo.trim(),
      p_usuario: user.email ?? "",
    });
    if (cErr)
      return { error: `No se pudo corregir el stock: ${cErr.message}` };
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
