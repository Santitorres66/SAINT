import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aPedidoPublico,
  leerPedido,
  sincronizarPagoTalo,
} from "@/lib/pago-transferencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orden/[id]?k=<clave>
 *
 * La página del pedido pregunta acá cada pocos segundos si ya entró la
 * transferencia. Si el pedido es de Talo y sigue pendiente, se le consulta a
 * Talo en el momento: así, aunque el webhook se pierda, el pedido se
 * confirma igual mientras el cliente tenga la página abierta.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clave = new URL(request.url).searchParams.get("k") ?? "";
  const supabase = createAdminClient();

  let fila = await leerPedido(supabase, id, clave);
  if (!fila) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }

  if (fila.status === "pending" && fila.pago_id) {
    try {
      const antes = fila.status;
      const ahora = await sincronizarPagoTalo(supabase, fila);
      if (ahora !== antes) fila = (await leerPedido(supabase, id, clave)) ?? fila;
    } catch (e) {
      // Si Talo no responde, se informa lo que hay; el webhook sigue vivo.
      console.warn("orden: no se pudo consultar Talo", e);
    }
  }

  const p = aPedidoPublico(fila);
  return NextResponse.json(
    { status: p.status, pagoEstado: p.pagoEstado },
    { headers: { "Cache-Control": "no-store" } },
  );
}
