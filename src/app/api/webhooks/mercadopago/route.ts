import { NextResponse } from "next/server";
import crypto from "crypto";
import { Payment } from "mercadopago";
import { getMercadoPagoClient } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";
import { confirmarOrden } from "@/lib/confirmar-orden";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/mercadopago
 *
 * Mercado Pago llama a esta URL cuando cambia el estado de un pago.
 * Flujo:
 *  1. (Opcional) Validar la firma del webhook.
 *  2. Volver a consultar el pago en Mercado Pago (fuente confiable).
 *  3. Actualizar la orden y, si se aprobó, descontar el stock (una sola vez).
 *
 * ⚠️ El webhook solo funciona con una URL pública (Vercel). En localhost,
 * Mercado Pago no puede alcanzar tu máquina, así que se prueba una vez deployado.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const rawBody = await request.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsed = {};
    }

    // El id del pago puede venir por query (?data.id=) o en el body (data.id)
    const tipo =
      url.searchParams.get("type") ??
      url.searchParams.get("topic") ??
      (parsed.type as string) ??
      (parsed.action as string) ??
      "";
    const dataId =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      ((parsed.data as { id?: string })?.id ?? "");

    // Solo nos interesan las notificaciones de pago
    if (!tipo.includes("payment") || !dataId) {
      return NextResponse.json({ received: true });
    }

    // 1) Validación de firma (solo si configuraste MP_WEBHOOK_SECRET)
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret) {
      const firmaOk = validarFirma(request, url, String(dataId), secret);
      if (!firmaOk) {
        console.warn("webhook mercadopago: firma inválida");
        return NextResponse.json({ error: "firma inválida" }, { status: 401 });
      }
    }

    // 2) Consultamos el pago en Mercado Pago (dato confiable)
    const client = getMercadoPagoClient();
    const pago = await new Payment(client).get({ id: String(dataId) });

    const orderId = pago.external_reference;
    if (!orderId) return NextResponse.json({ received: true });

    const nuevoEstado = mapearEstado(pago.status);

    const supabase = createAdminClient();

    const comprador = pago.payer?.email
      ? {
          email: pago.payer.email,
          nombre: [pago.payer.first_name, pago.payer.last_name]
            .filter(Boolean)
            .join(" "),
        }
      : null;

    if (nuevoEstado === "approved") {
      // Confirma una sola vez: descuenta stock y abre las órdenes de
      // producción. Si ya estaba aprobada, no hace nada.
      await confirmarOrden(supabase, orderId, {
        usuario: "venta web",
        cambios: { mp_payment_id: String(pago.id ?? dataId), comprador },
      });
    } else {
      // Un aviso tardío de "pendiente" no puede desaprobar una orden pagada.
      await supabase
        .from("orders")
        .update({
          status: nuevoEstado,
          mp_payment_id: String(pago.id ?? dataId),
          comprador,
        })
        .eq("id", orderId)
        .neq("status", "approved");
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("webhook mercadopago:", msg);
    // Devolvemos 200 igual para que Mercado Pago no reintente en loop por
    // errores no recuperables; los problemas quedan en el log.
    return NextResponse.json({ received: true });
  }
}

/** Traduce el estado de Mercado Pago a nuestro estado de orden. */
function mapearEstado(status?: string): OrderStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
    case "cancelled":
      return "rejected";
    default:
      return "pending";
  }
}

/**
 * Valida la firma del webhook (x-signature) según el esquema de Mercado Pago.
 * manifest = `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
function validarFirma(
  request: Request,
  url: URL,
  dataId: string,
  secret: string,
): boolean {
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  if (!xSignature) return false;

  // x-signature: "ts=1704...,v1=abcdef..."
  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const idParaFirma = /^[0-9]+$/.test(dataId) ? dataId : dataId.toLowerCase();
  const manifest = `id:${idParaFirma};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
  } catch {
    return false;
  }
}
