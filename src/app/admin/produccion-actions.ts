"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PRODUCCION } from "@/lib/produccion";
import type {
  MatrizInput,
  ActionResult,
  EstadoProduccion,
  PrioridadProduccion,
} from "@/lib/types";

function revalidarProduccion() {
  revalidatePath("/admin/produccion");
  revalidatePath("/admin/produccion/matrices");
  revalidatePath("/admin/mermas");
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
  es_servicio: boolean;
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
  prioridad: PrioridadProduccion;
  fecha_estimada_entrega: string | null;
  costo_prenda: number;
  costo_matriz: number;
  costo_bordado: number;
  otros_costos: number;
  /** Tomar el pedido aunque no alcance el stock de la variante. */
  permitir_sin_stock?: boolean;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Stock actual de una variante (talle + color). Si no existe, es 0. */
async function stockVariante(
  supabase: Supabase,
  productId: string,
  talle: string | null,
  color: string | null,
): Promise<number> {
  const { data } = await supabase
    .from("product_variantes")
    .select("stock")
    .eq("product_id", productId)
    .eq("talle", talle || "")
    .eq("color", color || "")
    .maybeSingle();
  return data?.stock ?? 0;
}

/**
 * Descuenta lo que le falta a una orden tomada sin stock, con lo que haya
 * ahora en la variante. Devuelve cuántas unidades siguen faltando.
 */
async function asignarStockPendiente(
  supabase: Supabase,
  orden: {
    id: string;
    product_id: string | null;
    talle: string | null;
    color: string | null;
    stock_pendiente?: number | null;
  },
): Promise<number> {
  const pendiente = orden.stock_pendiente ?? 0;
  if (pendiente <= 0 || !orden.product_id) return 0;

  const disponible = await stockVariante(
    supabase,
    orden.product_id,
    orden.talle,
    orden.color,
  );
  const asignar = Math.min(disponible, pendiente);
  if (asignar <= 0) return pendiente;

  await supabase.rpc("descontar_stock_variante", {
    p_product_id: orden.product_id,
    p_talle: orden.talle ?? "",
    p_color: orden.color ?? "",
    p_cantidad: asignar,
  });
  await supabase
    .from("ordenes_produccion")
    .update({ stock_pendiente: pendiente - asignar })
    .eq("id", orden.id);
  return pendiente - asignar;
}

function textoVariante(talle: string | null, color: string | null) {
  return `talle ${talle || "-"}, color ${color || "-"}`;
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

  // Un servicio puede no tener prenda propia (la trae el cliente), así que lo
  // que no puede faltar es la descripción del trabajo: sin eso la orden no
  // dice qué hay que bordar.
  if (input.es_servicio) {
    if (!input.bordado_descripcion?.trim() && !input.prenda?.trim())
      return { error: "Describí el trabajo de bordado." };
  } else if (!input.prenda?.trim() && !input.product_id) {
    return { error: "Indicá la prenda (elegí un producto o escribila)." };
  }

  // Verificamos el stock de la VARIANTE exacta (talle + color). Si no
  // alcanza, el pedido se puede tomar igual (con aviso): lo que falta queda
  // en stock_pendiente y la orden espera a que se reponga la prenda.
  const cant = input.cantidad || 1;
  let faltante = 0;
  if (input.product_id) {
    const disponible = await stockVariante(
      supabase,
      input.product_id,
      input.talle,
      input.color,
    );
    faltante = Math.max(cant - disponible, 0);
    if (faltante > 0 && !input.permitir_sin_stock) {
      return {
        error: `No hay stock suficiente de esa variante (${textoVariante(input.talle, input.color)}): quedan ${disponible}. Marcá “Tomar el pedido igual” si querés cargarlo y reponer después.`,
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
      es_servicio: input.es_servicio ?? false,
      bordado_descripcion: input.bordado_descripcion?.trim() ?? "",
      bordado_ubicacion: input.bordado_ubicacion?.trim() ?? "",
      bordado_tamano: input.bordado_tamano?.trim() ?? "",
      bordado_colores: input.bordado_colores || 0,
      observaciones: input.observaciones?.trim() ?? "",
      imagen_ref_path: input.imagen_ref_path,
      archivo_bordado_path: input.archivo_bordado_path,
      matriz_id: matrizId,
      estado: "pendiente",
      prioridad: input.prioridad || "media",
      fecha_estimada_entrega: input.fecha_estimada_entrega,
      costo_prenda: input.costo_prenda || 0,
      costo_matriz: input.costo_matriz || 0,
      costo_bordado: input.costo_bordado || 0,
      otros_costos: input.otros_costos || 0,
      costo_total,
      // Solo se manda si hace falta: así las órdenes comunes se siguen
      // creando aunque todavía no se haya corrido produccion-sin-stock.sql.
      ...(faltante > 0 ? { stock_pendiente: faltante } : {}),
    })
    .select("id")
    .single();

  if (error || !orden)
    return { error: `No se pudo crear la orden: ${error?.message}` };

  // Descontamos de la variante lo que hay; lo que falta se descuenta cuando
  // se reponga y la orden pase a producción.
  if (input.product_id && cant - faltante > 0) {
    await supabase.rpc("descontar_stock_variante", {
      p_product_id: input.product_id,
      p_talle: input.talle || "",
      p_color: input.color || "",
      p_cantidad: cant - faltante,
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
  es_servicio: boolean;
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
  prioridad: PrioridadProduccion;
  fecha_estimada_entrega: string | null;
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
      es_servicio: input.es_servicio ?? false,
      bordado_descripcion: input.bordado_descripcion?.trim() ?? "",
      bordado_ubicacion: input.bordado_ubicacion?.trim() ?? "",
      bordado_tamano: input.bordado_tamano?.trim() ?? "",
      bordado_colores: input.bordado_colores || 0,
      observaciones: input.observaciones?.trim() ?? "",
      imagen_ref_path: input.imagen_ref_path,
      archivo_bordado_path: input.archivo_bordado_path,
      matriz_id: matrizId,
      prioridad: input.prioridad || "media",
      fecha_estimada_entrega: input.fecha_estimada_entrega,
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
    .select("*")
    .eq("id", id)
    .single();

  // Si ya se vendió, borrar la orden devolvería al stock una prenda que en
  // realidad salió del negocio, y dejaría la venta sin su origen.
  if (orden?.venta_id)
    return {
      error:
        "Esta orden ya tiene una venta cargada. Eliminá primero la venta desde “Ventas”.",
    };

  const { error } = await supabase
    .from("ordenes_produccion")
    .delete()
    .eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  // Devolvemos a la variante lo que la orden había descontado (si se tomó
  // sin stock, lo pendiente nunca salió de la variante)
  const devolver = (orden?.cantidad ?? 1) - (orden?.stock_pendiente ?? 0);
  if (orden?.product_id && devolver > 0) {
    await supabase.rpc("sumar_stock_variante", {
      p_product_id: orden.product_id,
      p_talle: orden.talle ?? "",
      p_color: orden.color ?? "",
      p_cantidad: devolver,
    });
  }

  revalidarProduccion();
  return { ok: true };
}

/**
 * Cambia el estado de una orden (desde el Kanban o el detalle) y lo registra.
 *
 * Los dos últimos estados NO se manejan desde acá: `vendido` lo produce la
 * carga de la venta y `cobrado` el registro del cobro. La venta es la fuente
 * de verdad de esa parte del circuito; si el Kanban pudiera moverlos a mano,
 * el tablero mostraría una cosa y la plata otra.
 */
export async function cambiarEstadoProduccion(
  id: string,
  nuevoEstado: EstadoProduccion,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: orden } = await supabase
    .from("ordenes_produccion")
    .select("*")
    .eq("id", id)
    .single();
  if (!orden) return { error: "No se encontró la orden." };

  const anterior = orden.estado;
  if (anterior === nuevoEstado) return { ok: true };

  if (nuevoEstado === "vendido" && !orden.venta_id)
    return {
      error:
        'Para pasar a "Vendido" cargá la venta con el botón "Cargar como vendido".',
    };

  if (nuevoEstado === "cobrado") {
    if (!orden.venta_id)
      return { error: "Primero cargá la venta de esta orden." };
    const { data: venta } = await supabase
      .from("ventas")
      .select("estado_cobro")
      .eq("id", orden.venta_id)
      .maybeSingle();
    if (venta?.estado_cobro !== "cobrado")
      return {
        error:
          'Esta venta todavía tiene saldo. Registrá el cobro desde "Ventas" y la orden pasa sola a "Cobrado".',
      };
  }

  // Perder una orden o sacarla de "perdido" tiene su propio flujo: registra
  // (o limpia) el motivo y el seguimiento de la merma.
  if (nuevoEstado === "perdido")
    return marcarPerdida(id, { motivo: "otro", nota: "", rehacer: false });
  if (anterior === "perdido") return volverAProduccion(id, nuevoEstado);

  // Volver atrás con una venta ya cargada desincronizaría orden y plata.
  const cerrados: string[] = ["vendido", "cobrado"];
  if (cerrados.includes(anterior) && !cerrados.includes(nuevoEstado))
    return {
      error:
        "Esta orden ya tiene una venta cargada. Eliminá la venta si querés volver atrás.",
    };

  // Una orden tomada sin stock no puede salir de "Pendiente" sin la prenda:
  // si ya se repuso, se descuenta ahora lo que faltaba.
  const trabajando: string[] = ["en_produccion", "fabricado", "entregado"];
  if (trabajando.includes(nuevoEstado) && (orden.stock_pendiente ?? 0) > 0) {
    const faltan = await asignarStockPendiente(supabase, orden);
    if (faltan > 0) {
      revalidarProduccion();
      return {
        error: `Todavía no hay stock de esta prenda (${textoVariante(orden.talle, orden.color)}): faltan ${faltan}. Reponela con una compra o corrigiendo el stock y volvé a moverla.`,
      };
    }
  }

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

/* -------------------------------- Mermas --------------------------------- */

/**
 * Marca una orden como perdida (merma): la prenda se rompió o el bordado
 * salió mal. Guarda el motivo y en qué etapa pasó, y opcionalmente la rehace
 * en el momento.
 *
 * El stock no se toca: la prenda ya se descontó al crear la orden y, como se
 * perdió, no vuelve. Si se rehace, la orden nueva descuenta otra.
 */
export async function marcarPerdida(
  id: string,
  input: { motivo: string; nota: string; rehacer: boolean },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: orden } = await supabase
    .from("ordenes_produccion")
    .select("estado, venta_id")
    .eq("id", id)
    .maybeSingle();
  if (!orden) return { error: "No se encontró la orden." };
  if (orden.estado === "perdido") return { ok: true };
  if (orden.venta_id)
    return {
      error:
        "Esta orden ya tiene una venta cargada. Eliminá la venta antes de marcarla como perdida.",
    };

  const { error } = await supabase
    .from("ordenes_produccion")
    .update({
      estado: "perdido",
      merma_motivo: input.motivo || "otro",
      merma_nota: input.nota?.trim() ?? "",
      merma_etapa: orden.estado,
      fecha_merma: new Date().toISOString(),
      merma_estado: "abierta",
      merma_resolucion: null,
    })
    .eq("id", id);
  if (error) return { error: `No se pudo marcar como perdida: ${error.message}` };

  await supabase.from("produccion_historial").insert({
    orden_id: id,
    estado_anterior: orden.estado,
    estado_nuevo: "perdido",
    usuario: user.email ?? "",
  });

  if (input.rehacer) {
    const res = await rehacerOrden(id);
    if (res?.error)
      return {
        error: `Se marcó como perdida, pero no se pudo rehacer: ${res.error}`,
      };
  }

  revalidarProduccion();
  return { ok: true };
}

/**
 * Crea una orden nueva, igual a la perdida, para volver a hacerla. Queda en
 * "Pendiente" con prioridad alta y vinculada a la original. Descuenta otra
 * prenda del stock (si no hay, queda esperando que se reponga). La matriz ya existe, así que su costo no se vuelve a cargar.
 */
export async function rehacerOrden(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: o } = await supabase
    .from("ordenes_produccion")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!o) return { error: "No se encontró la orden." };
  if (o.estado !== "perdido")
    return { error: "Solo se puede rehacer una orden perdida." };
  if (o.rehecha_orden_id) return { error: "Esta orden ya se rehízo." };

  // Ya hay un cliente esperando: si no hay prenda, la orden nueva se toma
  // igual y queda esperando stock, como cualquier pedido tomado sin stock.
  const cant = o.cantidad || 1;
  const faltante = o.product_id
    ? Math.max(cant - (await stockVariante(supabase, o.product_id, o.talle, o.color)), 0)
    : 0;

  const costo_matriz = o.matriz_id ? 0 : Number(o.costo_matriz) || 0;
  const costo_total =
    (Number(o.costo_prenda) || 0) +
    costo_matriz +
    (Number(o.costo_bordado) || 0) +
    (Number(o.otros_costos) || 0);
  const aviso = `Rehecha de la orden #${String(o.numero).padStart(5, "0")}.`;

  const { data: nueva, error } = await supabase
    .from("ordenes_produccion")
    .insert({
      pedido_referencia: o.pedido_referencia ?? "",
      cliente: o.cliente ?? "",
      cliente_id: o.cliente_id,
      fecha: new Date().toISOString(),
      product_id: o.product_id,
      prenda: o.prenda ?? "",
      tipo_prenda: o.tipo_prenda ?? "",
      talle: o.talle ?? "",
      color: o.color ?? "",
      cantidad: cant,
      es_servicio: o.es_servicio ?? false,
      bordado_descripcion: o.bordado_descripcion ?? "",
      bordado_ubicacion: o.bordado_ubicacion ?? "",
      bordado_tamano: o.bordado_tamano ?? "",
      bordado_colores: o.bordado_colores ?? 0,
      observaciones: [aviso, o.observaciones].filter(Boolean).join(" "),
      imagen_ref_path: o.imagen_ref_path,
      archivo_bordado_path: o.archivo_bordado_path,
      matriz_id: o.matriz_id,
      estado: "pendiente",
      // Ya hay un cliente esperando: la rehecha va primero.
      prioridad: "alta",
      fecha_estimada_entrega: o.fecha_estimada_entrega,
      costo_prenda: Number(o.costo_prenda) || 0,
      costo_matriz,
      costo_bordado: Number(o.costo_bordado) || 0,
      otros_costos: Number(o.otros_costos) || 0,
      costo_total,
      origen_merma_id: o.id,
      ...(faltante > 0 ? { stock_pendiente: faltante } : {}),
    })
    .select("id")
    .single();
  if (error || !nueva)
    return { error: `No se pudo crear la orden nueva: ${error?.message}` };

  if (o.product_id && cant - faltante > 0) {
    await supabase.rpc("descontar_stock_variante", {
      p_product_id: o.product_id,
      p_talle: o.talle || "",
      p_color: o.color || "",
      p_cantidad: cant - faltante,
    });
  }

  await supabase.from("produccion_historial").insert({
    orden_id: nueva.id,
    estado_anterior: null,
    estado_nuevo: "pendiente",
    usuario: user.email ?? "",
  });

  await supabase
    .from("ordenes_produccion")
    .update({ merma_estado: "rehecha", rehecha_orden_id: nueva.id })
    .eq("id", id);

  revalidarProduccion();
  return { ok: true };
}

/** Cierra el seguimiento de una merma indicando qué se hizo con la prenda. */
export async function cerrarMerma(
  id: string,
  resolucion: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("ordenes_produccion")
    .update({ merma_estado: "cerrada", merma_resolucion: resolucion || null })
    .eq("id", id)
    .eq("estado", "perdido");
  if (error) return { error: `No se pudo cerrar: ${error.message}` };

  revalidarProduccion();
  return { ok: true };
}

/**
 * Deshace una merma cargada por error: la orden vuelve a la etapa en la que
 * estaba (o a la indicada) y se borran los datos de la merma.
 */
export async function volverAProduccion(
  id: string,
  estado?: EstadoProduccion,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: o } = await supabase
    .from("ordenes_produccion")
    .select("estado, merma_etapa, rehecha_orden_id")
    .eq("id", id)
    .maybeSingle();
  if (!o) return { error: "No se encontró la orden." };
  if (o.estado !== "perdido") return { ok: true };
  if (o.rehecha_orden_id)
    return {
      error:
        "Esta merma ya se rehízo con otra orden. Si fue un error, eliminá la orden nueva primero.",
    };

  const permitidos: string[] = ["pendiente", "en_produccion", "fabricado", "entregado"];
  const destino: EstadoProduccion =
    estado && permitidos.includes(estado)
      ? estado
      : permitidos.includes(o.merma_etapa ?? "")
        ? (o.merma_etapa as EstadoProduccion)
        : "pendiente";

  const { error } = await supabase
    .from("ordenes_produccion")
    .update({
      estado: destino,
      merma_motivo: null,
      merma_nota: "",
      merma_etapa: null,
      fecha_merma: null,
      merma_estado: null,
      merma_resolucion: null,
    })
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  await supabase.from("produccion_historial").insert({
    orden_id: id,
    estado_anterior: "perdido",
    estado_nuevo: destino,
    usuario: user.email ?? "",
  });

  revalidarProduccion();
  return { ok: true };
}
