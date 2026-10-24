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
  revalidatePath("/admin/cobranzas");
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

/**
 * Una venta sin nada para cobrar (total 0, o descuento igual al total) está
 * saldada desde que nace. La base solo recalcula el estado cuando se mueve un
 * cobro o cambia el total, así que una venta que se carga directo en $0 se
 * quedaba en "pendiente" para siempre: no había saldo para cobrar y tampoco
 * podía pasar a "cobrado". Acá la cerramos a mano.
 */
async function cerrarVentaSinSaldo(
  supabase: Supa,
  ventaId: string,
  usuario: string,
): Promise<boolean> {
  const { data: venta } = await supabase
    .from("ventas")
    .select("total, descuento, total_cobrado, estado_cobro, fecha")
    .eq("id", ventaId)
    .maybeSingle();
  if (!venta) return false;

  const saldo =
    Number(venta.total) -
    Number(venta.descuento ?? 0) -
    Number(venta.total_cobrado ?? 0);
  if (saldo > 0.01) return false;

  if (venta.estado_cobro !== "cobrado") {
    await supabase
      .from("ventas")
      .update({ estado_cobro: "cobrado", fecha_cobro: new Date().toISOString() })
      .eq("id", ventaId);
  }
  await sincronizarOrdenConVenta(supabase, ventaId, usuario);
  return true;
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

/**
 * Revisa que ningún ítem de mercadería venga sin talle o sin color cuando el
 * producto los usa.
 *
 * Es la misma validación que hace el formulario, repetida acá porque es la
 * que importa: una compra guardada sin talle busca una variante que no
 * existe, no suma stock y no da ningún error. Así se perdieron compras
 * enteras sin que nada lo avisara.
 */
async function validarVariantesDeItems(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  items: { tipo?: string; product_id?: string | null; nombre?: string;
           talle?: string | null; color?: string | null }[],
): Promise<string | null> {
  const ids = [
    ...new Set(
      items
        .filter((i) => (i.tipo ?? "mercaderia") === "mercaderia" && i.product_id)
        .map((i) => i.product_id as string),
    ),
  ];
  if (!ids.length) return null;

  const { data } = await supabase
    .from("products")
    .select("id, nombre, talles, colores")
    .in("id", ids);
  const porId = new Map(
    ((data as { id: string; nombre: string; talles: string[]; colores: string[] }[]) ?? [])
      .map((p) => [p.id, p]),
  );

  for (const it of items) {
    if ((it.tipo ?? "mercaderia") !== "mercaderia" || !it.product_id) continue;
    const prod = porId.get(it.product_id);
    if (!prod) continue;
    if ((prod.talles ?? []).length > 0 && !it.talle)
      return `Falta el talle de "${prod.nombre}". Sin talle la compra no suma stock.`;
    if ((prod.colores ?? []).length > 0 && !it.color)
      return `Falta el color de "${prod.nombre}". Sin color la compra no suma stock.`;
  }
  return null;
}

/**
 * Se asegura de que el producto ofrezca esa combinación antes de moverle el
 * stock.
 *
 * Comprar un talle que el producto todavía no listaba es lo normal: es
 * justamente la forma de incorporarlo al catálogo. Pero el stock vive en
 * `product_variantes`, así que si la fila no existe no hay dónde sumarlo, y
 * si el talle no figura en `products.talles` la variante queda invisible en
 * todos los formularios: stock que está pero no se puede elegir.
 *
 * Es idempotente y barato: si la combinación ya existía, no hace nada.
 */
async function asegurarVariante(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  productId: string,
  talle: string,
  color: string,
) {
  await supabase.from("product_variantes").upsert(
    { product_id: productId, talle, color, stock: 0 },
    { onConflict: "product_id,talle,color", ignoreDuplicates: true },
  );

  const { data: prod } = await supabase
    .from("products")
    .select("talles, colores")
    .eq("id", productId)
    .maybeSingle();
  if (!prod) return;

  const talles: string[] = prod.talles ?? [];
  const colores: string[] = prod.colores ?? [];
  const faltaTalle = Boolean(talle) && !talles.includes(talle);
  const faltaColor = Boolean(color) && !colores.includes(color);
  if (!faltaTalle && !faltaColor) return;

  await supabase
    .from("products")
    .update({
      talles: faltaTalle ? [...talles, talle] : talles,
      colores: faltaColor ? [...colores, color] : colores,
    })
    .eq("id", productId);
}

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

  const faltante = await validarVariantesDeItems(supabase, input.items);
  if (faltante) return { error: faltante };

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
    await asegurarVariante(
      supabase,
      it.product_id,
      it.talle ?? "",
      it.color ?? "",
    );
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

/**
 * Edita una compra ya cargada. Como la compra suma stock, primero devolvemos
 * (descontamos) lo que había sumado la versión anterior y después sumamos lo
 * de la versión nueva. El costo del producto queda con el de esta compra.
 */
export async function updateCompra(
  id: string,
  input: {
    proveedor_id: string | null;
    fecha: string;
    items: CompraItem[];
    medio_pago: string;
    cuotas: number;
    monto_cuota: number;
    notas: string;
  },
): Promise<ActionResult> {
  if (!input.items?.length)
    return { error: "Agregá al menos un ítem a la compra." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const faltante = await validarVariantesDeItems(supabase, input.items);
  if (faltante) return { error: faltante };

  const { data: previa } = await supabase
    .from("compras")
    .select("items")
    .eq("id", id)
    .maybeSingle();
  if (!previa) return { error: "No se encontró la compra." };

  // Revertimos el stock que había sumado la compra anterior
  for (const it of (previa.items ?? []) as CompraItem[]) {
    if ((it.tipo ?? "mercaderia") !== "mercaderia" || !it.product_id) continue;
    await supabase.rpc("descontar_stock_variante", {
      p_product_id: it.product_id,
      p_talle: it.talle ?? "",
      p_color: it.color ?? "",
      p_cantidad: it.cantidad,
    });
  }

  const total = input.items.reduce(
    (a, i) => a + i.cantidad * i.costo_unitario,
    0,
  );

  const { error } = await supabase
    .from("compras")
    .update({
      proveedor_id: input.proveedor_id,
      fecha: input.fecha || new Date().toISOString(),
      total,
      items: input.items,
      medio_pago: input.medio_pago?.trim() ?? "",
      cuotas: input.cuotas || 1,
      monto_cuota: input.monto_cuota || 0,
      notas: input.notas?.trim() ?? "",
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar la compra: ${error.message}` };

  // Sumamos el stock de los ítems nuevos (y refrescamos el costo)
  for (const it of input.items) {
    if ((it.tipo ?? "mercaderia") !== "mercaderia" || !it.product_id) continue;
    await asegurarVariante(
      supabase,
      it.product_id,
      it.talle ?? "",
      it.color ?? "",
    );
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

  // Venta en $0 (regalo, canje, descuento total): queda cobrada de una.
  await cerrarVentaSinSaldo(supabase, venta.id, user.email ?? "");

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
  if (saldo <= 0.01) {
    // No hay nada que cobrar: nos aseguramos de que figure como cobrada.
    await cerrarVentaSinSaldo(supabase, ventaId, user.email ?? "");
    revalidarGestion();
    return { ok: true };
  }
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

/**
 * Marca como cobrada una venta que no tiene saldo (por ejemplo, una venta en
 * $0). Es lo que se usa al pasar a "Cobrado" algo que no tiene nada que cobrar.
 */
export async function saldarVentaSinSaldo(
  ventaId: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const ok = await cerrarVentaSinSaldo(supabase, ventaId, user.email ?? "");
  if (!ok)
    return {
      error: 'Esta venta todavía tiene saldo. Registrá el cobro desde "Ventas".',
    };

  revalidarGestion();
  revalidatePath("/admin/cobranzas");
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
