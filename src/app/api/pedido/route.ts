import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrecio } from "@/lib/constants";
import { describirBordado, sanearBordado } from "@/lib/bordado";
import type { Product } from "@/lib/types";
import type { BordadoSpec } from "@/lib/bordado";

export const runtime = "nodejs";

/**
 * POST /api/pedido — el pedido por WhatsApp.
 *
 * Mientras el pago online está apagado, este es el circuito: el cliente arma
 * el carrito, deja su nombre, y el pedido entra al tablero de Producción como
 * "pendiente" mientras a él se le abre WhatsApp con todo escrito.
 *
 * Que caiga en "pendiente" y no en "vendido" es a propósito: un pedido de la
 * web todavía no es una venta. Hay bordados que no se pueden hacer, o que
 * cuestan mucho más de lo que el cliente imagina, y eso se conversa antes.
 * El tablero es la bandeja de entrada; lo que no se pueda, se descarta ahí.
 *
 * Nada de esto toca el stock ni cobra: no hay plata de por medio todavía.
 *
 * Regla de oro: el mensaje de WhatsApp SIEMPRE se devuelve, aunque falle la
 * base. Perder el pedido porque no se pudo escribir una fila sería el peor
 * error posible; si la base falla, el mensaje igual llega y se carga a mano.
 */

type ItemEntrada = {
  productId: string;
  talle: string | null;
  color: string | null;
  cantidad: number;
  bordado?: unknown;
};

type ItemResuelto = {
  producto: Product;
  talle: string | null;
  color: string | null;
  cantidad: number;
  bordado: BordadoSpec | null;
};

/** Un código corto y legible para nombrar el pedido por teléfono. */
function nuevaReferencia(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
  let codigo = "";
  for (let i = 0; i < 4; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }
  return `WEB-${codigo}`;
}

function textoCorto(valor: unknown, max: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const referencia = nuevaReferencia();

  try {
    const body = await request.json();

    const nombre = textoCorto(body?.cliente?.nombre, 80);
    const telefono = textoCorto(body?.cliente?.telefono, 40);
    const notas = textoCorto(body?.cliente?.notas, 500);
    const entrada: ItemEntrada[] = Array.isArray(body?.items) ? body.items : [];

    if (!nombre) {
      return NextResponse.json(
        { error: "Escribí tu nombre para que sepamos de quién es el pedido." },
        { status: 400 },
      );
    }
    if (!entrada.length) {
      return NextResponse.json(
        { error: "El carrito está vacío." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Los datos salen de la base, nunca del navegador: el nombre y el precio
    // que se le escriben al taller tienen que ser los de verdad.
    const ids = [...new Set(entrada.map((i) => i.productId))];
    const { data: productos, error: dbError } = await supabase
      .from("products")
      .select("*")
      .in("id", ids);

    if (dbError) {
      return NextResponse.json(
        { error: "No se pudieron verificar los productos. Probá de nuevo." },
        { status: 500 },
      );
    }

    const porId = new Map<string, Product>(
      (productos as Product[]).map((p) => [p.id, p]),
    );

    const items: ItemResuelto[] = [];
    for (const i of entrada) {
      const producto = porId.get(i.productId);
      if (!producto || !producto.activo) {
        return NextResponse.json(
          { error: "Uno de los productos ya no está disponible." },
          { status: 400 },
        );
      }
      items.push({
        producto,
        talle: textoCorto(i.talle, 20) || null,
        color: textoCorto(i.color, 40) || null,
        cantidad: Math.max(1, Math.floor(Number(i.cantidad) || 1)),
        bordado: sanearBordado(i.bordado),
      });
    }

    const mensaje = armarMensaje({
      referencia,
      nombre,
      telefono,
      notas,
      items,
    });

    // Las órdenes de producción: una por línea del pedido. Si esto falla, el
    // pedido igual sale por WhatsApp y se avisa que hay que cargarlo a mano.
    const filas = items.map((i) => ({
      pedido_referencia: referencia,
      cliente: nombre,
      product_id: i.producto.id,
      prenda: i.producto.nombre,
      tipo_prenda: i.producto.molde ?? "",
      talle: i.talle ?? "",
      color: i.color ?? "",
      cantidad: i.cantidad,
      bordado_descripcion: i.bordado?.motivo ?? "",
      bordado_ubicacion: i.bordado?.ubicacion ?? "",
      bordado_tamano: i.bordado?.tamano ?? "",
      observaciones: observacionesDe({ i, telefono, notas }),
      estado: "pendiente",
    }));

    const { error: insertError } = await supabase
      .from("ordenes_produccion")
      .insert(filas);

    if (insertError) {
      console.warn("pedido · no se pudo guardar en produccion:", insertError.message);
      return NextResponse.json({ referencia, mensaje, guardado: false });
    }

    return NextResponse.json({ referencia, mensaje, guardado: true });
  } catch (e) {
    console.error("pedido error >>>", e);
    return NextResponse.json(
      { error: "No se pudo armar el pedido. Probá de nuevo." },
      { status: 500 },
    );
  }
}

/** Todo lo que el taller necesita saber y no entra en una columna propia. */
function observacionesDe({
  i,
  telefono,
  notas,
}: {
  i: ItemResuelto;
  telefono: string;
  notas: string;
}): string {
  const lineas = [
    "PEDIDO WEB — sin pagar. Confirmar que el bordado se pueda hacer.",
    `Precio de lista de la prenda (bordado incluido): ${formatPrecio(Number(i.producto.precio) || 0)}`,
  ];

  if (telefono) lineas.push(`Tel: ${telefono}`);
  if (i.bordado) {
    lineas.push(`Hilo: ${i.bordado.hilo}`);
    if (i.bordado.tipo === "imagen") {
      // El previsualizador no sube la imagen: vive en el teléfono del cliente.
      lineas.push("⚠ El diseño lo manda el cliente por WhatsApp (no está acá).");
    }
  } else {
    lineas.push("Sin bordado: la prenda va lisa.");
  }
  if (notas) lineas.push(`Notas del cliente: ${notas}`);

  return lineas.join("\n");
}

/** El mensaje que el cliente manda por WhatsApp, ya escrito. */
function armarMensaje({
  referencia,
  nombre,
  telefono,
  notas,
  items,
}: {
  referencia: string;
  nombre: string;
  telefono: string;
  notas: string;
  items: ItemResuelto[];
}): string {
  const lineas: string[] = [`¡Hola SAINT! 🖤 Quiero hacer este pedido:`, ""];

  let total = 0;
  items.forEach((i, n) => {
    const precio = Number(i.producto.precio) || 0;
    total += precio * i.cantidad;

    const detalle = [i.talle, i.color].filter(Boolean).join(" · ");
    lineas.push(
      `${n + 1}) ${i.producto.nombre}${detalle ? ` (${detalle})` : ""} x${i.cantidad} — ${formatPrecio(precio * i.cantidad)}`,
    );
    lineas.push(
      i.bordado
        ? `    Bordado: ${describirBordado(i.bordado)}`
        : "    Sin bordado (prenda lisa)",
    );
    if (i.bordado?.tipo === "imagen") {
      lineas.push("    (te mando la imagen del diseño por acá)");
    }
  });

  lineas.push("");
  // El bordado va incluido en el precio de la prenda. Solo un diseño muy
  // complejo puede tener un costo extra, y eso se habla en el chat: ponerlo
  // en el mensaje del cliente lo haría dudar de un precio que ya está bien.
  lineas.push(`Total: ${formatPrecio(total)}`);
  lineas.push("");
  lineas.push(`Soy ${nombre}${telefono ? ` · ${telefono}` : ""}`);
  if (notas) lineas.push(`Nota: ${notas}`);
  lineas.push(`Pedido ${referencia}`);

  return lineas.join("\n");
}
