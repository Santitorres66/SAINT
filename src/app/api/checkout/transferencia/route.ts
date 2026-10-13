import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/mercadopago";
import { resolverCarrito } from "@/lib/carrito-servidor";
import { crearPagoTalo, datosDeTransferencia } from "@/lib/talo";
import {
  HORAS_PARA_PAGAR,
  cuentaManual,
  modoTransferencia,
  montoConCentavosUnicos,
  nuevaReferencia,
} from "@/lib/pago-transferencia";

export const runtime = "nodejs";

function textoCorto(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

/**
 * POST /api/checkout/transferencia
 *
 * Arma el pedido para pagar por transferencia:
 *  1. Recalcula precios y stock desde la base (no confía en el navegador).
 *  2. Crea la orden en "pending" con una clave secreta para verla.
 *  3. Le pide a Talo un CVU/alias para ese pedido (o, en modo manual, usa el
 *     alias propio con centavos únicos).
 *  4. Devuelve el link a la página del pedido, donde está el monto exacto.
 *
 * El stock NO se descuenta acá: recién cuando entra la plata. Un carrito que
 * nadie paga no puede dejar una prenda bloqueada.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nombre = textoCorto(body?.cliente?.nombre, 80);
    const telefono = textoCorto(body?.cliente?.telefono, 40);
    const email = textoCorto(body?.cliente?.email, 120);
    const notas = textoCorto(body?.cliente?.notas, 500);

    if (!nombre) {
      return NextResponse.json(
        { error: "Escribí tu nombre para que sepamos de quién es el pedido." },
        { status: 400 },
      );
    }
    if (telefono.replace(/\D/g, "").length < 8) {
      return NextResponse.json(
        { error: "Dejanos un teléfono con WhatsApp para coordinar el bordado y el envío." },
        { status: 400 },
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Revisá el email." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const carrito = await resolverCarrito(supabase, body?.items);
    if ("error" in carrito) {
      return NextResponse.json({ error: carrito.error }, { status: carrito.status });
    }

    const modo = modoTransferencia();
    const cuenta = cuentaManual();
    if (modo === "manual" && !cuenta.alias && !cuenta.cvu) {
      console.error("transferencia: falta TRANSFERENCIA_ALIAS / TRANSFERENCIA_CBU");
      return NextResponse.json(
        { error: "El pago por transferencia no está disponible ahora. Escribinos por WhatsApp." },
        { status: 503 },
      );
    }

    const acceso = crypto.randomBytes(18).toString("base64url");
    const referencia = nuevaReferencia();
    const monto =
      modo === "manual"
        ? await montoConCentavosUnicos(supabase, carrito.total)
        : carrito.total;
    const vence = new Date(Date.now() + HORAS_PARA_PAGAR * 3600 * 1000);

    // 1) La orden, todavía sin datos de pago
    const { data: orden, error: ordenError } = await supabase
      .from("orders")
      .insert({
        status: "pending",
        metodo_pago: "transferencia",
        total: carrito.total,
        items: carrito.items,
        // Las notas del cliente viajan con sus datos; la columna `notas` de
        // la orden queda para las alertas del pago (pagó de más, de menos…).
        comprador: {
          nombre,
          telefono,
          email: email || undefined,
          notas: notas || undefined,
        },
        referencia,
        acceso,
        pago_monto: monto,
        ...(modo === "manual"
          ? {
              pago_alias: cuenta.alias,
              pago_cvu: cuenta.cvu,
              pago_vence: vence.toISOString(),
            }
          : {}),
      })
      .select("id")
      .single();

    if (ordenError || !orden) {
      console.error("transferencia: no se pudo crear la orden", ordenError?.message);
      return NextResponse.json({ error: "No se pudo crear el pedido. Probá de nuevo." }, { status: 500 });
    }

    const siteUrl = getSiteUrl();
    const linkPedido = `${siteUrl}/pedido/${orden.id}?k=${acceso}`;

    // 2) El CVU propio del pedido (modo Talo)
    if (modo === "talo") {
      try {
        const pago = await crearPagoTalo({
          orderId: orden.id,
          monto,
          motivo: `SAINT ${referencia}`,
          webhookUrl: `${siteUrl}/api/webhooks/talo`,
          redirectUrl: linkPedido,
          cliente: { nombre, telefono, email },
        });
        const { cvu, alias } = datosDeTransferencia(pago);
        if (!cvu && !alias) throw new Error("Talo no devolvió CVU ni alias");

        await supabase
          .from("orders")
          .update({
            pago_id: pago.id,
            pago_estado: pago.payment_status ?? "PENDING",
            pago_cvu: cvu,
            pago_alias: alias,
            pago_vence: pago.expiration_timestamp ?? vence.toISOString(),
          })
          .eq("id", orden.id);
      } catch (e) {
        // Sin CVU el pedido no se puede pagar: se cancela para que no quede
        // colgado en el admin como si estuviera esperando plata.
        console.error("transferencia: Talo falló >>>", e);
        await supabase
          .from("orders")
          .update({ status: "cancelled", notas: "No se pudo generar el CVU en Talo." })
          .eq("id", orden.id);
        return NextResponse.json(
          { error: "No pudimos generar los datos de transferencia. Probá de nuevo en un rato." },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({
      order_id: orden.id,
      referencia,
      url: `/pedido/${orden.id}?k=${acceso}`,
    });
  } catch (e) {
    console.error("transferencia error >>>", e);
    return NextResponse.json({ error: "No se pudo armar el pedido. Probá de nuevo." }, { status: 500 });
  }
}
