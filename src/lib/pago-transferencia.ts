import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/lib/types";
import { confirmarOrden } from "@/lib/confirmar-orden";
import { consultarPagoTalo, taloConfigurado } from "@/lib/talo";

/**
 * Pago por transferencia: lo que se le muestra al cliente y cómo se concilia.
 *
 * Hay dos modos, y la tienda elige sola según las variables de entorno:
 *
 *  - TALO (automático). Cada pedido recibe su propio CVU/alias. El cliente
 *    transfiere el monto exacto, Talo avisa por webhook y el pedido se
 *    confirma sin que nadie toque nada. Es lo que hace Tiendanube.
 *
 *  - MANUAL (mientras Talo no esté dado de alta). Se muestra el alias propio
 *    de SAINT con un monto que lleva centavos únicos (ej. $45.000,37): así,
 *    al ver la transferencia en el banco, se sabe de qué pedido es sin
 *    preguntar. La confirmación la hace el admin con un botón.
 */

export type ModoTransferencia = "talo" | "manual";

export function modoTransferencia(): ModoTransferencia {
  return taloConfigurado() ? "talo" : "manual";
}

/**
 * La cuenta propia de SAINT, para el modo manual.
 *
 * No son datos secretos (se le muestran a cada cliente que paga), por eso
 * viven en el código. Las variables TRANSFERENCIA_* de Vercel, si existen,
 * tienen prioridad: sirven para cambiar de cuenta sin tocar código.
 */
const CUENTA_SAINT = {
  alias: "saint.prendas",
  cbu: "1430001713002873970017",
  titular: "Santiago Damian Torres",
};

export function cuentaManual() {
  return {
    alias: process.env.TRANSFERENCIA_ALIAS?.trim() || CUENTA_SAINT.alias,
    cvu: process.env.TRANSFERENCIA_CBU?.trim() || CUENTA_SAINT.cbu,
    titular: process.env.TRANSFERENCIA_TITULAR?.trim() || CUENTA_SAINT.titular,
  };
}

/** Cuánto vale un pedido sin pagar antes de liberarse. */
export const HORAS_PARA_PAGAR = 48;

/** Un código corto y legible para nombrar el pedido por teléfono. */
export function nuevaReferencia(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
  let codigo = "";
  for (let i = 0; i < 5; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }
  return `WEB-${codigo}`;
}

/**
 * Elige centavos que ningún otro pedido manual pendiente esté usando con el
 * mismo total, para que dos transferencias iguales no se confundan.
 */
export async function montoConCentavosUnicos(
  supabase: SupabaseClient,
  total: number,
): Promise<number> {
  const { data } = await supabase
    .from("orders")
    .select("pago_monto")
    .eq("metodo_pago", "transferencia")
    .eq("status", "pending")
    .gte("pago_monto", total)
    .lt("pago_monto", total + 1);
  const usados = new Set(
    ((data as { pago_monto: number | string }[]) ?? []).map((o) =>
      Math.round((Number(o.pago_monto) - total) * 100),
    ),
  );
  const libres = Array.from({ length: 99 }, (_, i) => i + 1).filter(
    (c) => !usados.has(c),
  );
  // Con 99 pedidos iguales pendientes a la vez se repite; no es un caso real.
  const cents = libres.length
    ? libres[Math.floor(Math.random() * libres.length)]
    : 1 + Math.floor(Math.random() * 99);
  return Math.round(total * 100 + cents) / 100;
}

/** Lo mínimo de la orden que hace falta para conciliar su pago. */
type OrdenTransferencia = {
  id: string;
  status: string;
  pago_id: string | null;
  pago_monto: number | string | null;
};

/**
 * Le pregunta a Talo cómo está el cobro de un pedido y deja la orden al día.
 * La llaman el webhook y la página del pedido (por si el webhook se pierde).
 *
 * Reglas:
 *  - SUCCESS  → se confirma el pedido.
 *  - OVERPAID → se confirma igual (la plata alcanza) y queda anotado para
 *               devolver la diferencia.
 *  - UNDERPAID→ NO se confirma: queda marcado para que el admin decida.
 *  - EXPIRED  → el pedido se da por vencido.
 *
 * Devuelve el estado en que quedó la orden.
 */
export async function sincronizarPagoTalo(
  supabase: SupabaseClient,
  orden: OrdenTransferencia,
): Promise<string> {
  // Se concilia aunque el pedido figure vencido o cancelado: si la plata
  // igual entró por su CVU, el pedido se confirma (y el admin se entera) en
  // vez de quedar una transferencia sin dueño.
  if (!orden.pago_id || orden.status === "approved") return orden.status;

  const pago = await consultarPagoTalo(orden.pago_id);
  const estado = pago.payment_status;

  // Defensa: el cobro tiene que ser de ESTE pedido y por ESTE monto. Si
  // alguien cambiara el precio del cobro, no se confirma solo.
  const montoTalo = Number(pago.price?.amount);
  const montoOk =
    !Number.isFinite(montoTalo) ||
    Math.abs(montoTalo - Number(orden.pago_monto)) < 0.01;
  const pedidoOk = !pago.external_id || pago.external_id === orden.id;

  if (!montoOk || !pedidoOk) {
    console.warn("talo: el cobro no coincide con el pedido", orden.id, pago);
    await supabase
      .from("orders")
      .update({
        pago_estado: estado,
        notas: "⚠ El cobro de Talo no coincide con el pedido. Revisar a mano.",
      })
      .eq("id", orden.id);
    return orden.status;
  }

  if (estado === "SUCCESS" || estado === "OVERPAID") {
    await confirmarOrden(supabase, orden.id, {
      usuario: "transferencia (Talo)",
      cambios: {
        pago_estado: estado,
        pagado_at: new Date().toISOString(),
        ...(estado === "OVERPAID"
          ? { notas: "Transfirió de MÁS: devolver la diferencia desde Talo." }
          : {}),
      },
    });
    return "approved";
  }

  if (estado === "EXPIRED") {
    await supabase
      .from("orders")
      .update({ status: "expired", pago_estado: estado })
      .eq("id", orden.id)
      .eq("status", "pending");
    return "expired";
  }

  // PENDING o UNDERPAID: solo se anota el estado de Talo. Un pago de menos
  // en un pedido cancelado lo vuelve a "pending" para que aparezca en Ventas.
  await supabase
    .from("orders")
    .update({
      pago_estado: estado,
      ...(estado === "UNDERPAID"
        ? {
            status: "pending",
            notas: "Transfirió de MENOS: decidir si se acepta o se devuelve.",
          }
        : {}),
    })
    .eq("id", orden.id);
  return estado === "UNDERPAID" ? "pending" : orden.status;
}

/* --- Lo que ve el cliente --------------------------------------------- */

/** El pedido tal como se le muestra al cliente en /pedido/[id]. */
export type PedidoPublico = {
  id: string;
  referencia: string;
  status: string;
  pagoEstado: string | null;
  modo: ModoTransferencia;
  total: number;
  monto: number;
  alias: string | null;
  cvu: string | null;
  titular: string | null;
  vence: string | null;
  creado: string;
  nombre: string;
  items: Pick<OrderItem, "nombre" | "talle" | "color" | "cantidad" | "precio_unitario" | "bordado">[];
};

/** Las columnas que hacen falta para armar un PedidoPublico. */
export const COLUMNAS_PEDIDO =
  "id, created_at, status, total, items, comprador, referencia, acceso, pago_monto, pago_alias, pago_cvu, pago_vence, pago_id, pago_estado, metodo_pago";

type FilaPedido = {
  id: string;
  created_at: string;
  status: string;
  total: number | string;
  items: OrderItem[] | null;
  comprador: { nombre?: string } | null;
  referencia: string | null;
  acceso: string | null;
  pago_monto: number | string | null;
  pago_alias: string | null;
  pago_cvu: string | null;
  pago_vence: string | null;
  pago_id: string | null;
  pago_estado: string | null;
  metodo_pago: string;
};

/**
 * Busca un pedido por id y clave. Sin la clave correcta no devuelve nada:
 * el id solo no alcanza para ver el pedido de otro.
 */
export async function leerPedido(
  supabase: SupabaseClient,
  id: string,
  clave: string,
): Promise<FilaPedido | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !clave) return null;
  const { data } = await supabase
    .from("orders")
    .select(COLUMNAS_PEDIDO)
    .eq("id", id)
    .eq("metodo_pago", "transferencia")
    .maybeSingle();
  const fila = data as FilaPedido | null;
  if (!fila?.acceso || !igualesSeguro(fila.acceso, clave)) return null;
  return fila;
}

export function aPedidoPublico(fila: FilaPedido): PedidoPublico {
  const vencido =
    fila.status === "pending" &&
    fila.pago_vence !== null &&
    new Date(fila.pago_vence).getTime() < Date.now();
  return {
    id: fila.id,
    referencia: fila.referencia ?? fila.id.slice(0, 8),
    status: vencido ? "expired" : fila.status,
    pagoEstado: fila.pago_estado,
    modo: fila.pago_id ? "talo" : "manual",
    total: Number(fila.total),
    monto: Number(fila.pago_monto ?? fila.total),
    alias: fila.pago_alias,
    cvu: fila.pago_cvu,
    titular: fila.pago_id ? null : cuentaManual().titular,
    vence: fila.pago_vence,
    creado: fila.created_at,
    nombre: fila.comprador?.nombre ?? "",
    items: (fila.items ?? []).map((i) => ({
      nombre: i.nombre,
      talle: i.talle,
      color: i.color,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      bordado: i.bordado ?? null,
    })),
  };
}

/** Compara dos claves sin filtrar por tiempo cuánto coinciden. */
function igualesSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
