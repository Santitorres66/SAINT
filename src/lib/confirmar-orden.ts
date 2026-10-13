import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/lib/types";

/**
 * Pasa una orden de la web a "approved" y hace todo lo que eso implica:
 * descuenta el stock de cada variante y abre una orden de producción por
 * ítem, para que el pedido aparezca en el tablero del taller.
 *
 * Es el único lugar donde una orden se confirma, venga el pago de donde
 * venga (Mercado Pago, una transferencia detectada sola, o el admin que la
 * marca a mano). Así las tres puertas hacen exactamente lo mismo.
 *
 * Idempotente de verdad: el cambio de estado es un UPDATE condicionado a que
 * la orden NO esté aprobada todavía. Si llegan dos avisos del mismo pago al
 * mismo tiempo, solo uno gana esa fila; el otro no encuentra nada que
 * actualizar y se va sin tocar el stock. Leer el estado primero y escribir
 * después —como se hacía antes— dejaba una ventana donde los dos pasaban.
 *
 * Devuelve `true` si esta llamada fue la que confirmó la orden.
 */
export async function confirmarOrden(
  supabase: SupabaseClient,
  orderId: string,
  datos: {
    /** Columnas extra a guardar junto con el cambio de estado. */
    cambios?: Record<string, unknown>;
    /** Quién figura en el historial de producción. */
    usuario: string;
  },
): Promise<boolean> {
  const { data: orden, error } = await supabase
    .from("orders")
    .update({ ...datos.cambios, status: "approved" })
    .eq("id", orderId)
    .neq("status", "approved")
    .select("id, items, comprador")
    .maybeSingle();

  if (error) throw new Error(`confirmarOrden: ${error.message}`);
  if (!orden) return false; // ya estaba confirmada (o no existe)

  const items = (orden.items as OrderItem[]) ?? [];
  const comprador = orden.comprador as
    | { nombre?: string; email?: string; telefono?: string; notas?: string }
    | null;
  const nombreComprador =
    comprador?.nombre || comprador?.email || "Cliente web";
  const refPedido = `Venta web ${String(orderId).slice(0, 8)}`;

  for (const item of items) {
    // 1) Descontar stock de la variante vendida
    if (item.product_id) {
      await supabase.rpc("descontar_stock_variante", {
        p_product_id: item.product_id,
        p_talle: item.talle ?? "",
        p_color: item.color ?? "",
        p_cantidad: item.cantidad,
      });
    }

    // 2) Crear la orden de producción (SIN volver a descontar stock: la
    //    venta ya lo hizo). Queda en "Pendiente" para fabricar.
    const { data: op } = await supabase
      .from("ordenes_produccion")
      .insert({
        pedido_referencia: refPedido,
        cliente: nombreComprador,
        product_id: item.product_id,
        prenda: item.nombre,
        talle: item.talle ?? "",
        color: item.color ?? "",
        cantidad: item.cantidad,
        bordado_descripcion: item.bordado?.motivo ?? "",
        bordado_ubicacion: item.bordado?.ubicacion ?? "",
        bordado_tamano: item.bordado?.tamano ?? "",
        observaciones: [
          "PEDIDO WEB — PAGADO.",
          comprador?.telefono ? `Tel: ${comprador.telefono}` : "",
          item.bordado
            ? `Hilo: ${item.bordado.hilo}`
            : "Sin bordado: la prenda va lisa.",
          item.bordado?.tipo === "imagen"
            ? "⚠ El diseño lo manda el cliente por WhatsApp (no está acá)."
            : "",
          comprador?.notas ? `Notas del cliente: ${comprador.notas}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (op) {
      await supabase.from("produccion_historial").insert({
        orden_id: op.id,
        estado_anterior: null,
        estado_nuevo: "pendiente",
        usuario: datos.usuario,
      });
    }
  }

  return true;
}
