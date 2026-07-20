import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { getMercadoPagoClient, getSiteUrl } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderItem, Product } from "@/lib/types";

// El SDK de Mercado Pago necesita el runtime de Node.js (no Edge).
export const runtime = "nodejs";

type ItemEntrada = {
  productId: string;
  talle: string | null;
  color: string | null;
  cantidad: number;
};

/**
 * POST /api/checkout
 * Recibe los ítems del carrito, RECALCULA los precios desde la base de datos
 * (nunca confía en el navegador), crea la orden en Supabase y genera la
 * preferencia de pago de Mercado Pago. Devuelve el link de pago (init_point).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entrada: ItemEntrada[] = body?.items ?? [];

    if (!Array.isArray(entrada) || entrada.length === 0) {
      return NextResponse.json(
        { error: "El carrito está vacío." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Traemos los productos reales por id
    const ids = [...new Set(entrada.map((i) => i.productId))];
    const { data: productos, error: dbError } = await supabase
      .from("products")
      .select("*")
      .in("id", ids);

    if (dbError) {
      return NextResponse.json(
        { error: "No se pudieron verificar los productos." },
        { status: 500 },
      );
    }

    const porId = new Map<string, Product>(
      (productos as Product[]).map((p) => [p.id, p]),
    );

    // Construimos los ítems con datos y precios de la base
    const orderItems: OrderItem[] = [];
    for (const item of entrada) {
      const prod = porId.get(item.productId);
      const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1));

      if (!prod || !prod.activo) {
        return NextResponse.json(
          { error: "Uno de los productos ya no está disponible." },
          { status: 400 },
        );
      }
      if (prod.stock < cantidad) {
        return NextResponse.json(
          { error: `No hay stock suficiente de "${prod.nombre}".` },
          { status: 400 },
        );
      }

      orderItems.push({
        product_id: prod.id,
        nombre: prod.nombre,
        talle: item.talle ?? null,
        color: item.color ?? null,
        cantidad,
        precio_unitario: Number(prod.precio),
      });
    }

    const total = orderItems.reduce(
      (acc, i) => acc + i.precio_unitario * i.cantidad,
      0,
    );

    // 1) Creamos la orden (estado pendiente)
    const { data: orden, error: ordenError } = await supabase
      .from("orders")
      .insert({ status: "pending", total, items: orderItems })
      .select("id")
      .single();

    if (ordenError || !orden) {
      return NextResponse.json(
        { error: "No se pudo crear la orden." },
        { status: 500 },
      );
    }

    // 2) Creamos la preferencia de pago en Mercado Pago
    const siteUrl = getSiteUrl();
    const client = getMercadoPagoClient();
    const preference = new Preference(client);

    // Mercado Pago rechaza localhost para auto_return y notification_url.
    // Los activamos solo cuando hay una URL pública (producción / Vercel).
    const esLocal = /localhost|127\.0\.0\.1/.test(siteUrl);

    const result = await preference.create({
      body: {
        items: orderItems.map((i) => ({
          id: i.product_id ?? "",
          title: [i.nombre, i.talle, i.color].filter(Boolean).join(" · "),
          quantity: i.cantidad,
          unit_price: i.precio_unitario,
          currency_id: "ARS",
        })),
        external_reference: orden.id, // así el webhook sabe qué orden es
        back_urls: {
          success: `${siteUrl}/checkout/success`,
          failure: `${siteUrl}/checkout/failure`,
          pending: `${siteUrl}/checkout/pending`,
        },
        statement_descriptor: "SAINT",
        ...(esLocal
          ? {}
          : {
              auto_return: "approved",
              notification_url: `${siteUrl}/api/webhooks/mercadopago`,
            }),
      },
    });

    const initPoint = result.init_point ?? result.sandbox_init_point;

    if (!initPoint) {
      return NextResponse.json(
        { error: "Mercado Pago no devolvió un link de pago." },
        { status: 502 },
      );
    }

    // 3) Guardamos el id de la preferencia en la orden
    await supabase
      .from("orders")
      .update({ mp_preference_id: result.id })
      .eq("id", orden.id);

    return NextResponse.json({ init_point: initPoint, order_id: orden.id });
  } catch (e: unknown) {
    // Log detallado para diagnóstico (queda solo en el servidor).
    let detalle = "Error inesperado.";
    try {
      const err = e as {
        message?: string;
        cause?: unknown;
        status?: number;
        error?: unknown;
      };
      detalle = JSON.stringify(
        {
          message: err?.message,
          status: err?.status,
          cause: err?.cause,
          error: err?.error,
        },
        null,
        2,
      );
    } catch {
      detalle = String(e);
    }
    console.error("checkout error >>>", detalle);
    // Mensaje amable; el detalle queda en el log del servidor.
    return NextResponse.json(
      {
        error:
          "No se pudo iniciar el pago. Verificá que Mercado Pago esté configurado.",
      },
      { status: 500 },
    );
  }
}
