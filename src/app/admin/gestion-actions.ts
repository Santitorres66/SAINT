"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ProveedorInput,
  CompraItem,
  CobroInput,
  ActionResult,
  OrderItem,
} from "@/lib/types";

/**
 * Server Actions del sistema de gestión: proveedores, compras, ventas
 * manuales y cobros.
 * - Las compras SUMAN stock (y guardan el costo).
 * - Las ventas manuales RESTAN stock, salvo las que vienen de una orden de
 *   producción: esa prenda ya se descontó al crear la orden.
 * - Los cobros no tocan stock: mueven el estado de cobro de la venta (y, si
 *   la venta cierra una orden, también el estado de la orden).
 */

function revalidarGestion() {
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/proveedores");
  revalidatePath("/admin/compras");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/produccion");
  // El stock cambió → refrescamos la web pública
  revalidatePath("/");
  revalidatePath("/tienda");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Deja el estado de la orden de producción en línea con el cobro de su venta.
 * `vendido` mientras quede saldo, `cobrado` cuando la venta está saldada.
 * La venta es la única fuente de verdad; la orden solo la refleja.
 */
async function sincronizarOrdenConVenta(
  supabase: Supa,
  ventaId: string,
  usuario: string,
) {
  const { data: orden } = await supabase
    .from("ordenes_produccion")
    .select("id, estado")
    .eq("venta_id", ventaId)
    .maybeSingle();
  if (!orden) return;

  const { data: venta } = await supabase
    .from("ventas")
    .select("estado_cobro, fecha_cobro")
    .eq("id", ventaId)
    .maybeSingle();
  if (!venta) return;

  const nuevoEstado = venta.estado_cobro === "cobrado" ? "cobrado" : "vendido";
  if (orden.estado === nuevoEstado) return;

  await supabase
    .from("ordenes_produccion")
    .update({ estado: nuevoEstado, fecha_cobro: venta.fecha_cobro ?? null })
    .eq("id", orden.id);

  await supabase.from("produccion_historial").insert({
    orden_id: orden.id,
    estado_anterior: orden.estado,
    estado_nuevo: nuevoEstado,
    usuario,
  });
}

/* ------------------------------ Proveedores ------------------------------ */

export async function createProveedor(
  input: ProveedorInput,
): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("proveedores").insert({
    nombre: input.nombre.trim(),
    telefono: input.telefono?.trim() ?? "",
    email: input.email?.trim() ?? "",
    cuit: input.cuit?.trim() ?? "",
    notas: input.notas?.trim() ?? "",
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarGestion();
  redirect("/admin/proveedores");
}

export async function updateProveedor(
  id: string,
  input: ProveedorInput,
): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("proveedores")
    .update({
      nombre: input.nombre.trim(),
      telefono: input.telefono?.trim() ?? "",
      email: input.email?.trim() ?? "",
      cuit: input.cuit?.trim() ?? "",
      notas: input.notas?.trim() ?? "",
    })
    .eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarGestion();
  redirect("/admin/proveedores");
}

export async function deleteProveedor(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarGestion();
  return { ok: true };
}

/* -------------------------------- Compras -------------------------------- */

export async function createCompra(input: {
  proveedor_id: string | null;
  fecha: string;
  items: CompraItem[];
  medio_pago: string;
  cuotas: number;
  monto_cuota: number;
  notas: string;
}): Promise<ActionResult> {
  if (!input.items?.length)
    return { error: "Agregá al menos un ítem a la compra." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const total = input.items.reduce(
    (a, i) => a + i.cantidad * i.costo_unitario,
    0,
  );

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      proveedor_id: input.proveedor_id,
      fecha: input.fecha || new Date().toISOString(),
      total,
      items: input.items,
      medio_pago: input.medio_pago?.trim() ?? "",
      cuotas: input.cuotas || 1,
      monto_cuota: input.monto_cuota || 0,
      notas: input.notas?.trim() ?? "",
    })
    .select("id")
    .single();

  if (error || !compra)
    return { error: `No se pudo guardar la compra: ${error?.message}` };

  // Sumar stock y actualizar costo SOLO para ítems de mercadería
  for (const it of input.items) {
    if ((it.tipo ?? "mercaderia") !== "mercaderia" || !it.product_id) continue;
    await supabase.rpc("sumar_stock_variante", {
      p_product_id: it.product_id,
      p_talle: it.talle ?? "",
      p_color: it.color ?? "",
      p_cantidad: it.cantidad,
    });
    await supabase
      .from("products")
      .update({ costo: it.costo_unitario })
      .eq("id", it.product_id);
  }

  revalidarGestion();
  redirect("/admin/compras");
}

export async function deleteCompra(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // Traemos los ítems para revertir el stock que había sumado
  const { data: compra } = await supabase
    .from("compras")
    .select("items")
    .eq("id", id)
    .single();

  if (compra?.items) {
    for (const it of compra.items as CompraItem[]) {
      if ((it.tipo ?? "mercaderia") !== "mercaderia" || !it.product_id) continue;
      await supabase.rpc("descontar_stock_variante", {
        p_product_id: it.product_id,
        p_talle: it.talle ?? "",
        p_color: it.color ?? "",
        p_cantidad: it.cantidad,
      });
    }
  }

  const { error } = await supabase.from("compras").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarGestion();
  return { ok: true };
}

/* ---------------------------- Ventas manuales ---------------------------- */

export async function createVentaManual(input: {
  cliente: string;
  cliente_id: string | null;
  medio_pago: string;
  fecha: string;
  items: OrderItem[];
  notas: string;
  /** Orden de producción que esta venta cierra (viene del Kanban). */
  orden_produccion_id?: string | null;
  /** Descuento acordado sobre el total. */
  descuento?: number;
}): Promise<ActionResult> {
  if (!input.items?.length)
    return { error: "Agregá al menos un producto a la venta." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const ordenId = input.orden_produccion_id || null;

  // Una orden se cierra con UNA sola venta.
  if (ordenId) {
    const { data: orden } = await supabase
      .from("ordenes_produccion")
      .select("venta_id")
      .eq("id", ordenId)
      .maybeSingle();
    if (!orden) return { error: "No se encontró la orden de producción." };
    if (orden.venta_id)
      return { error: "Esa orden ya tiene una venta cargada." };
  }

  const total = input.items.reduce(
    (a, i) => a + i.cantidad * i.precio_unitario,
    0,
  );
  const descuento = Math.max(input.descuento || 0, 0);
  if (descuento > total)
    return { error: "El descuento no puede ser mayor que el total." };

  // Las ventas que cierran una orden de producción NO vuelven a tocar el
  // stock: la prenda ya salió cuando se creó la orden.
  const afectaStock = !ordenId;

  const { data: venta, error } = await supabase
    .from("ventas")
    .insert({
      cliente: input.cliente?.trim() ?? "",
      cliente_id: input.cliente_id ?? null,
      medio_pago: input.medio_pago?.trim() ?? "",
      fecha: input.fecha || new Date().toISOString(),
      total,
      descuento,
      items: input.items,
      notas: input.notas?.trim() ?? "",
      afecta_stock: afectaStock,
    })
    .select("id")
    .single();

  if (error || !venta)
    return { error: `No se pudo guardar la venta: ${error?.message}` };

  if (afectaStock) {
    // Restar stock de la variante (solo ítems que referencian un producto real)
    for (const it of input.items) {
      if (it.product_id) {
        await supabase.rpc("descontar_stock_variante", {
          p_product_id: it.product_id,
          p_talle: it.talle ?? "",
          p_color: it.color ?? "",
          p_cantidad: it.cantidad,
        });
      }
    }
  }

  // Cerrar el circuito: la orden queda vinculada y pasa a "vendido".
  if (ordenId) {
    const { data: previa } = await supabase
      .from("ordenes_produccion")
      .select("estado")
      .eq("id", ordenId)
      .single();

    await supabase
      .from("ordenes_produccion")
      .update({
        venta_id: venta.id,
        estado: "vendido",
        fecha_venta: new Date().toISOString(),
      })
      .eq("id", ordenId);

    await supabase.from("produccion_historial").insert({
      orden_id: ordenId,
      estado_anterior: previa?.estado ?? null,
      estado_nuevo: "vendido",
      usuario: user.email ?? "",
    });
  }

  revalidarGestion();
  redirect(ordenId ? "/admin/produccion" : "/admin/ventas");
}

/** Edita una venta manual. Ajusta el stock según los cambios de ítems. */
export async function updateVentaManual(
  id: string,
  input: {
    cliente: string;
    cliente_id: string | null;
    medio_pago: string;
    fecha: string;
    items: OrderItem[];
    notas: string;
    descuento?: number;
  },
): Promise<ActionResult> {
  if (!input.items?.length)
    return { error: "Agregá al menos un producto a la venta." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: previa } = await supabase
    .from("ventas")
    .select("items, afecta_stock, total_cobrado")
    .eq("id", id)
    .single();
  if (!previa) return { error: "No se encontró la venta." };

  // Si la venta nunca tocó el stock (vino de producción), tampoco lo tocamos
  // ahora: ni al devolver los ítems viejos ni al descontar los nuevos.
  const afectaStock = previa.afecta_stock ?? true;

  if (afectaStock && previa.items) {
    // Devolvemos al stock lo que la venta anterior había descontado
    for (const it of previa.items as OrderItem[]) {
      if (it.product_id) {
        await supabase.rpc("sumar_stock_variante", {
          p_product_id: it.product_id,
          p_talle: it.talle ?? "",
          p_color: it.color ?? "",
          p_cantidad: it.cantidad,
        });
      }
    }
  }

  const total = input.items.reduce(
    (a, i) => a + i.cantidad * i.precio_unitario,
    0,
  );
  const descuento = Math.max(input.descuento || 0, 0);
  if (descuento > total)
    return { error: "El descuento no puede ser mayor que el total." };

  // El total no puede quedar por debajo de lo ya cobrado.
  const cobrado = Number(previa.total_cobrado ?? 0);
  if (cobrado > total - descuento + 0.01)
    return {
      error: `Ya cobraste más de lo que quedaría esta venta. Ajustá o eliminá los cobros primero.`,
    };

  const { error } = await supabase
    .from("ventas")
    .update({
      cliente: input.cliente?.trim() ?? "",
      cliente_id: input.cliente_id ?? null,
      medio_pago: input.medio_pago?.trim() ?? "",
      fecha: input.fecha || new Date().toISOString(),
      total,
      descuento,
      items: input.items,
      notas: input.notas?.trim() ?? "",
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  if (afectaStock) {
    // Descontamos el stock de la variante de los ítems nuevos
    for (const it of input.items) {
      if (it.product_id) {
        await supabase.rpc("descontar_stock_variante", {
          p_product_id: it.product_id,
          p_talle: it.talle ?? "",
          p_color: it.color ?? "",
          p_cantidad: it.cantidad,
        });
      }
    }
  }

  // El total cambió → la base recalculó el estado de cobro. Reflejarlo.
  await sincronizarOrdenConVenta(supabase, id, user.email ?? "");

  revalidarGestion();
  redirect("/admin/ventas");
}

export async function deleteVentaManual(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: venta } = await supabase
    .from("ventas")
    .select("items, afecta_stock")
    .eq("id", id)
    .single();
  if (!venta) return { error: "No se encontró la venta." };

  // Si la orden de producción se cerró con esta venta, vuelve a "entregado".
  const { data: orden } = await supabase
    .from("ordenes_produccion")
    .select("id, estado")
    .eq("venta_id", id)
    .maybeSingle();

  // Revertir stock: devolvemos lo vendido, salvo que la venta nunca lo tocara
  if ((venta.afecta_stock ?? true) && venta.items) {
    for (const it of venta.items as OrderItem[]) {
      if (it.product_id) {
        await supabase.rpc("sumar_stock_variante", {
          p_product_id: it.product_id,
          p_talle: it.talle ?? "",
          p_color: it.color ?? "",
          p_cantidad: it.cantidad,
        });
      }
    }
  }

  const { error } = await supabase.from("ventas").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  if (orden) {
    // El FK deja venta_id en null solo; acá devolvemos el estado del Kanban.
    await supabase
      .from("ordenes_produccion")
      .update({ estado: "entregado", fecha_venta: null, fecha_cobro: null })
      .eq("id", orden.id);

    await supabase.from("produccion_historial").insert({
      orden_id: orden.id,
      estado_anterior: orden.estado,
      estado_nuevo: "entregado",
      usuario: user.email ?? "",
    });
  }

  revalidarGestion();
  return { ok: true };
}

/* -------------------------------- Cobros --------------------------------- */

/**
 * Registra una entrada de plata de una venta (seña, saldo, cuota…).
 * El estado de cobro lo recalcula la base sola; acá solo reflejamos el
 * resultado en la orden de producción, si esta venta cierra alguna.
 */
export async function registrarCobro(
  ventaId: string,
  input: CobroInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const monto = Number(input.monto) || 0;
  if (monto <= 0) return { error: "El monto del cobro tiene que ser mayor a 0." };

  const { data: venta } = await supabase
    .from("ventas")
    .select("total, descuento, total_cobrado")
    .eq("id", ventaId)
    .maybeSingle();
  if (!venta) return { error: "No se encontró la venta." };

  const saldo =
    Number(venta.total) -
    Number(venta.descuento ?? 0) -
    Number(venta.total_cobrado ?? 0);
  if (saldo <= 0.01) return { error: "Esta venta ya está saldada." };
  if (monto > saldo + 0.01)
    return {
      error: `El cobro no puede superar el saldo pendiente (${saldo.toFixed(2)}).`,
    };

  const cuotas = Math.max(Number(input.cuotas) || 1, 1);

  const { error } = await supabase.from("cobros").insert({
    venta_id: ventaId,
    fecha: input.fecha || new Date().toISOString(),
    monto,
    medio_pago: input.medio_pago?.trim() ?? "",
    cuotas,
    monto_cuota: monto / cuotas,
    notas: input.notas?.trim() ?? "",
  });
  if (error) return { error: `No se pudo registrar el cobro: ${error.message}` };

  await sincronizarOrdenConVenta(supabase, ventaId, user.email ?? "");

  revalidarGestion();
  return { ok: true };
}

/** Elimina un cobro (se cargó mal). La base recalcula el estado de la venta. */
export async function deleteCobro(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { data: cobro } = await supabase
    .from("cobros")
    .select("venta_id")
    .eq("id", id)
    .maybeSingle();
  if (!cobro) return { error: "No se encontró el cobro." };

  const { error } = await supabase.from("cobros").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  await sincronizarOrdenConVenta(supabase, cobro.venta_id, user.email ?? "");

  revalidarGestion();
  return { ok: true };
}

/**
 * Cambia el descuento de una venta sin tocar los ítems. Sirve para acordar
 * una rebaja al momento de cobrar.
 */
export async function actualizarDescuentoVenta(
  ventaId: string,
  descuento: number,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const nuevo = Math.max(Number(descuento) || 0, 0);

  const { data: venta } = await supabase
    .from("ventas")
    .select("total, total_cobrado")
    .eq("id", ventaId)
    .maybeSingle();
  if (!venta) return { error: "No se encontró la venta." };

  const total = Number(venta.total);
  if (nuevo > total)
    return { error: "El descuento no puede ser mayor que el total." };
  if (Number(venta.total_cobrado ?? 0) > total - nuevo + 0.01)
    return {
      error:
        "Con ese descuento la venta quedaría cobrada de más. Ajustá los cobros primero.",
    };

  const { error } = await supabase
    .from("ventas")
    .update({ descuento: nuevo })
    .eq("id", ventaId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await sincronizarOrdenConVenta(supabase, ventaId, user.email ?? "");

  revalidarGestion();
  return { ok: true };
}
