"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PRODUCCION } from "@/lib/produccion";
import type { MatrizInput, ActionResult } from "@/lib/types";

function revalidarProduccion() {
  revalidatePath("/admin/produccion");
  revalidatePath("/admin/produccion/matrices");
  // El stock puede cambiar al crear órdenes → refrescamos productos y web
  revalidatePath("/admin/productos");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/tienda");
}

type NuevaOrdenInput = {
  pedido_referencia: string;
  cliente: string;
  cliente_id: string | null;
  fecha: string;
  product_id: string | null;
  prenda: string;
  tipo_prenda: string;
  talle: string;
  color: string;
  cantidad: number;
  bordado_descripcion: string;
  bordado_ubicacion: string;
  bordado_tamano: string;
  bordado_colores: number;
  observaciones: string;
  imagen_ref_path: string | null;
  archivo_bordado_path: string | null;
  matriz_modo: "ninguna" | "existente" | "nueva";
  matriz_id: string | null;
  matriz_nueva: {
    nombre: string;
    costo: number;
    observaciones: string;
    imagen_path: string | null;
    archivo_path: string | null;
  } | null;
  costo_prenda: number;
  costo_matriz: number;
  costo_bordado: number;
  otros_costos: number;
};

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

/* -------------------------- Órdenes de producción ------------------------ */

export async function createOrdenProduccion(
  input: NuevaOrdenInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  if (!input.prenda?.trim() && !input.product_id)
    return { error: "Indicá la prenda (elegí un producto o escribila)." };

  // Verificamos el stock de la VARIANTE exacta (talle + color)
  const cant = input.cantidad || 1;
  if (input.product_id) {
    const { data: variante } = await supabase
      .from("product_variantes")
      .select("stock")
      .eq("product_id", input.product_id)
      .eq("talle", input.talle || "")
      .eq("color", input.color || "")
      .maybeSingle();
    if (variante && variante.stock < cant) {
      return {
        error: `No hay stock suficiente de esa variante (talle ${input.talle || "-"}, color ${input.color || "-"}): quedan ${variante.stock}.`,
      };
    }
  }

  // Resolver la matriz
  let matrizId: string | null = null;
  if (input.matriz_modo === "existente") {
    matrizId = input.matriz_id;
  } else if (input.matriz_modo === "nueva" && input.matriz_nueva?.nombre?.trim()) {
    const { data: m, error: mErr } = await supabase
      .from("matrices")
      .insert({
        nombre: input.matriz_nueva.nombre.trim(),
        costo: input.matriz_nueva.costo ?? 0,
        observaciones: input.matriz_nueva.observaciones?.trim() ?? "",
        imagen_path: input.matriz_nueva.imagen_path,
        archivo_path: input.matriz_nueva.archivo_path,
      })
      .select("id")
      .single();
    if (mErr || !m) return { error: `No se pudo crear la matriz: ${mErr?.message}` };
    matrizId = m.id;
  }

  const costo_total =
    (input.costo_prenda || 0) +
    (input.costo_matriz || 0) +
    (input.costo_bordado || 0) +
    (input.otros_costos || 0);

  const { data: orden, error } = await supabase
    .from("ordenes_produccion")
    .insert({
      pedido_referencia: input.pedido_referencia?.trim() ?? "",
      cliente: input.cliente?.trim() ?? "",
      cliente_id: input.cliente_id,
      fecha: input.fecha || new Date().toISOString(),
      product_id: input.product_id,
      prenda: input.prenda?.trim() ?? "",
      tipo_prenda: input.tipo_prenda?.trim() ?? "",
      talle: input.talle?.trim() ?? "",
      color: input.color?.trim() ?? "",
      cantidad: input.cantidad || 1,
      bordado_descripcion: input.bordado_descripcion?.trim() ?? "",
      bordado_ubicacion: input.bordado_ubicacion?.trim() ?? "",
      bordado_tamano: input.bordado_tamano?.trim() ?? "",
      bordado_colores: input.bordado_colores || 0,
      observaciones: input.observaciones?.trim() ?? "",
      imagen_ref_path: input.imagen_ref_path,
      archivo_bordado_path: input.archivo_bordado_path,
      matriz_id: matrizId,
      estado: "pendiente",
      costo_prenda: input.costo_prenda || 0,
      costo_matriz: input.costo_matriz || 0,
      costo_bordado: input.costo_bordado || 0,
      otros_costos: input.otros_costos || 0,
      costo_total,
    })
    .select("id")
    .single();

  if (error || !orden)
    return { error: `No se pudo crear la orden: ${error?.message}` };

  // Descontamos el stock de la variante (producimos lo que realmente tenemos)
  if (input.product_id) {
    await supabase.rpc("descontar_stock_variante", {
      p_product_id: input.product_id,
      p_talle: input.talle || "",
      p_color: input.color || "",
      p_cantidad: cant,
    });
  }

  // Registro inicial en el historial
  await supabase.from("produccion_historial").insert({
    orden_id: orden.id,
    estado_anterior: null,
    estado_nuevo: "pendiente",
    usuario: user.email ?? "",
  });

  revalidarProduccion();
  redirect("/admin/produccion");
}

type EditarOrdenInput = {
  pedido_referencia: string;
  cliente: string;
  cliente_id: string | null;
  fecha: string;
  bordado_descripcion: string;
  bordado_ubicacion: string;
  bordado_tamano: string;
  bordado_colores: number;
  observaciones: string;
  imagen_ref_path: string | null;
  archivo_bordado_path: string | null;
  matriz_modo: "ninguna" | "existente" | "nueva";
  matriz_id: string | null;
  matriz_nueva: {
    nombre: string;
    costo: number;
    observaciones: string;
    imagen_path: string | null;
    archivo_path: string | null;
  } | null;
  costo_prenda: number;
  costo_matriz: number;
  costo_bordado: number;
  otros_costos: number;
};

/**
 * Edita los datos de una orden ya creada (bordado, archivos, matriz, costos).
 * No toca prenda/talle/color/cantidad ni el estado: esos ya afectaron el
 * stock o el Kanban y se manejan por sus propios flujos.
 */
export async function updateOrdenProduccion(
  id: string,
  input: EditarOrdenInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // Resolver la matriz (misma lógica que al crear la orden)
  let matrizId: string | null = null;
  if (input.matriz_modo === "existente") {
    matrizId = input.matriz_id;
  } else if (input.matriz_modo === "nueva" && input.matriz_nueva?.nombre?.trim()) {
    const { data: m, error: mErr } = await supabase
      .from("matrices")
      .insert({
        nombre: input.matriz_nueva.nombre.trim(),
        costo: input.matriz_nueva.costo ?? 0,
        observaciones: input.matriz_nueva.observaciones?.trim() ?? "",
        imagen_path: input.matriz_nueva.imagen_path,
        archivo_path: input.matriz_nueva.archivo_path,
      })
      .select("id")
      .single();
    if (mErr || !m) return { error: `No se pudo crear la matriz: ${mErr?.message}` };
    matrizId = m.id;
  }

  const costo_total =
    (input.costo_prenda || 0) +
    (input.costo_matriz || 0) +
    (input.costo_bordado || 0) +
    (input.otros_costos || 0);

  const { error } = await supabase
    .from("ordenes_produccion")
    .update({
      pedido_referencia: input.pedido_referencia?.trim() ?? "",
      cliente: input.cliente?.trim() ?? "",
      cliente_id: input.cliente_id,
      fecha: input.fecha || new Date().toISOString(),
      bordado_descripcion: input.bordado_descripcion?.trim() ?? "",
      bordado_ubicacion: input.bordado_ubicacion?.trim() ?? "",
      bordado_tamano: input.bordado_tamano?.trim() ?? "",
      bordado_colores: input.bordado_colores || 0,
      observaciones: input.observaciones?.trim() ?? "",
      imagen_ref_path: input.imagen_ref_path,
      archivo_bordado_path: input.archivo_bordado_path,
      matriz_id: matrizId,
      costo_prenda: input.costo_prenda || 0,
      costo_matriz: input.costo_matriz || 0,
      costo_bordado: input.costo_bordado || 0,
      otros_costos: input.otros_costos || 0,
      costo_total,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar los cambios: ${error.message}` };

  revalidarProduccion();
  revalidatePath(`/admin/produccion/${id}`);
  redirect(`/admin/produccion/${id}`);
}

/** Elimina una orden de producción y DEVUELVE el stock del producto. */
export async function deleteOrdenProduccion(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: orden } = await supabase
    .from("ordenes_produccion")
    .select("product_id, cantidad, talle, color")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("ordenes_produccion")
    .delete()
    .eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  // Devolvemos a la variante lo que la orden había descontado
  if (orden?.product_id) {
    await supabase.rpc("sumar_stock_variante", {
      p_product_id: orden.product_id,
      p_talle: orden.talle ?? "",
      p_color: orden.color ?? "",
      p_cantidad: orden.cantidad ?? 1,
    });
  }

  revalidarProduccion();
  return { ok: true };
}

/** Cambia el estado de una orden (desde el Kanban o el detalle) y lo registra. */
export async function cambiarEstadoProduccion(
  id: string,
  nuevoEstado: "pendiente" | "en_produccion" | "fabricado" | "entregado",
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: orden } = await supabase
    .from("ordenes_produccion")
    .select("estado, fecha_inicio, fecha_fabricacion")
    .eq("id", id)
    .single();
  if (!orden) return { error: "No se encontró la orden." };

  const anterior = orden.estado;
  if (anterior === nuevoEstado) return { ok: true };

  const ahora = new Date().toISOString();
  const updates: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === "en_produccion" && !orden.fecha_inicio)
    updates.fecha_inicio = ahora;
  if (nuevoEstado === "fabricado" && !orden.fecha_fabricacion)
    updates.fecha_fabricacion = ahora;

  const { error } = await supabase
    .from("ordenes_produccion")
    .update(updates)
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  await supabase.from("produccion_historial").insert({
    orden_id: id,
    estado_anterior: anterior,
    estado_nuevo: nuevoEstado,
    usuario: user.email ?? "",
  });

  revalidarProduccion();
  return { ok: true };
}
