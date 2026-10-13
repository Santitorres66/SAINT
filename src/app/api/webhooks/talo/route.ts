import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarPagoTalo } from "@/lib/pago-transferencia";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/talo
 *
 * Talo llama acá cuando cambia el estado de un cobro, con un aviso mínimo:
 *   { "message": "Pago Actualizado", "paymentId": "...", "externalId": "..." }
 *
 * El aviso NO trae el estado ni viene firmado (Talo todavía no firma sus
 * webhooks), así que no se le cree nada: solo se usa para saber QUÉ cobro
 * mirar, y el estado real se pide a Talo con nuestro token. Un aviso falso
 * como mucho provoca una consulta de más.
 *
 * Talo pide responder 200 en menos de 3 segundos: se contesta enseguida y la
 * conciliación corre después, con `after`.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  const externalId = typeof body.externalId === "string" ? body.externalId : "";
  if (!paymentId && !externalId) return NextResponse.json({ received: true });

  after(async () => {
    try {
      const supabase = createAdminClient();
      // Se busca por el id del cobro (lo guardamos al crearlo) y, si no
      // está, por el id del pedido que viaja como externalId.
      let query = supabase
        .from("orders")
        .select("id, status, pago_id, pago_monto")
        .eq("metodo_pago", "transferencia");
      query = paymentId
        ? query.eq("pago_id", paymentId)
        : /^[0-9a-f-]{36}$/i.test(externalId)
          ? query.eq("id", externalId)
          : query.eq("id", "00000000-0000-0000-0000-000000000000");

      const { data: orden } = await query.maybeSingle();
      if (!orden) {
        console.warn("webhook talo: pedido no encontrado", paymentId, externalId);
        return;
      }
      const estado = await sincronizarPagoTalo(supabase, orden);
      console.log("webhook talo:", orden.id, "→", estado);
    } catch (e) {
      console.error("webhook talo:", e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({ received: true });
}
