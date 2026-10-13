"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ClearCartOnMount from "@/components/cart/ClearCartOnMount";
import { formatPrecio, whatsappLink } from "@/lib/constants";
import { describirBordado } from "@/lib/bordado";
import type { PedidoPublico } from "@/lib/pago-transferencia";

/** Cada cuánto se pregunta si ya entró la plata. */
const INTERVALO_TALO_MS = 6000;
// En modo manual lo confirma una persona: no tiene sentido preguntar seguido.
const INTERVALO_MANUAL_MS = 30000;

/** $45.000 o $45.000,37: los centavos se muestran solo si existen. */
function formatMonto(n: number): string {
  const conCentavos = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: conCentavos ? 2 : 0,
    maximumFractionDigits: conCentavos ? 2 : 0,
  }).format(n);
}

/** El monto como se pega en la app del banco: sin puntos, coma decimal. */
function montoParaCopiar(n: number): string {
  const conCentavos = Math.round(n * 100) % 100 !== 0;
  return conCentavos ? n.toFixed(2).replace(".", ",") : String(Math.round(n));
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * La pantalla de pago por transferencia.
 *
 * Mientras el pedido está pendiente, consulta el estado cada pocos segundos
 * y también apenas el cliente vuelve a la pestaña (que es justo lo que pasa
 * cuando termina de transferir desde la app del banco). Cuando entra la
 * plata, la pantalla cambia sola a "pago confirmado".
 */
export default function PagoTransferencia({
  pedido,
  clave,
}: {
  pedido: PedidoPublico;
  clave: string;
}) {
  const [status, setStatus] = useState(pedido.status);
  const [pagoEstado, setPagoEstado] = useState(pedido.pagoEstado);
  const consultando = useRef(false);

  const consultar = useCallback(async () => {
    if (consultando.current) return;
    consultando.current = true;
    try {
      const res = await fetch(
        `/api/orden/${pedido.id}?k=${encodeURIComponent(clave)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setPagoEstado(data.pagoEstado ?? null);
      }
    } catch {
      // Sin conexión: se vuelve a intentar en la próxima vuelta.
    }
    consultando.current = false;
  }, [pedido.id, clave]);

  useEffect(() => {
    if (status !== "pending") return;
    const ms = pedido.modo === "talo" ? INTERVALO_TALO_MS : INTERVALO_MANUAL_MS;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") consultar();
    }, ms);
    const alVolver = () => {
      if (document.visibilityState === "visible") consultar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [status, pedido.modo, consultar]);

  const mensajeWhatsapp = (texto: string) =>
    whatsappLink(
      `¡Hola SAINT! 🖤 ${texto}\nPedido ${pedido.referencia}${
        pedido.nombre ? ` · ${pedido.nombre}` : ""
      }`,
    );

  return (
    <div className="mx-auto max-w-xl px-6 py-16 sm:py-24">
      <ClearCartOnMount />

      <p className="text-center text-[11px] uppercase tracking-wide2 text-saint-gray">
        Pedido {pedido.referencia}
      </p>

      {status === "approved" ? (
        <Confirmado
          pedido={pedido}
          whatsapp={mensajeWhatsapp(
            "Ya pagué mi pedido por transferencia. Quiero coordinar el bordado y el envío.",
          )}
        />
      ) : status === "pending" ? (
        <Pendiente
          pedido={pedido}
          pagoEstado={pagoEstado}
          whatsappComprobante={mensajeWhatsapp(
            `Te mando el comprobante de la transferencia de ${formatMonto(pedido.monto)}.`,
          )}
        />
      ) : (
        <Cerrado
          vencido={status === "expired"}
          whatsapp={mensajeWhatsapp(
            "Mi pedido venció sin pagar. ¿Me ayudás a rehacerlo?",
          )}
        />
      )}

      <Resumen pedido={pedido} />
    </div>
  );
}

/* --- Esperando la transferencia ------------------------------------ */

function Pendiente({
  pedido,
  pagoEstado,
  whatsappComprobante,
}: {
  pedido: PedidoPublico;
  pagoEstado: string | null;
  whatsappComprobante: string;
}) {
  const automatico = pedido.modo === "talo";

  return (
    <>
      <h1 className="mt-4 text-center font-serif text-4xl font-light">
        Transferí para confirmar
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-saint-gray">
        {automatico
          ? "Apenas entre la transferencia, tu pedido se confirma solo. No hace falta mandar comprobante."
          : "Cuando veamos la transferencia, confirmamos tu pedido y te avisamos."}
      </p>

      {pagoEstado === "UNDERPAID" && (
        <p className="mt-6 border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          Recibimos una transferencia por un monto menor al del pedido. Ya lo
          estamos revisando: escribinos por WhatsApp y lo resolvemos.
        </p>
      )}

      {/* El monto: lo más importante de la pantalla */}
      <div className="mt-10 border border-saint-line bg-saint-ink/60 px-6 py-8 text-center">
        <p className="text-[11px] uppercase tracking-wide2 text-saint-gray">
          Monto exacto a transferir
        </p>
        <p className="mt-2 font-serif text-5xl font-light tabular-nums">
          {formatMonto(pedido.monto)}
        </p>
        <BotonCopiar valor={montoParaCopiar(pedido.monto)} etiqueta="Copiar monto" />
        {!automatico && pedido.monto !== pedido.total && (
          <p className="mx-auto mt-4 max-w-sm text-[11px] leading-relaxed text-saint-gray">
            Los centavos son a propósito: con ellos reconocemos tu transferencia
            entre las demás. Transferí el monto exacto, centavos incluidos.
          </p>
        )}
      </div>

      {/* A dónde */}
      <dl className="mt-6 divide-y divide-saint-line border-y border-saint-line">
        {pedido.alias && <Dato titulo="Alias" valor={pedido.alias} />}
        {pedido.cvu && <Dato titulo={automatico ? "CVU" : "CBU / CVU"} valor={pedido.cvu} />}
        {pedido.titular && <Dato titulo="Titular" valor={pedido.titular} copiable={false} />}
      </dl>

      {/* Cómo */}
      <ol className="mt-8 space-y-3 text-sm leading-relaxed">
        <Paso n={1}>Copiá el alias y abrí la app de tu banco o billetera.</Paso>
        <Paso n={2}>
          Transferí <span className="text-saint-white">el monto exacto</span>, en{" "}
          <span className="text-saint-white">una sola transferencia</span>.
        </Paso>
        <Paso n={3}>
          {automatico
            ? "Volvé a esta pantalla: se va a actualizar sola cuando llegue el pago."
            : "Mandanos el comprobante por WhatsApp para confirmarlo más rápido."}
        </Paso>
      </ol>

      {/* Estado en vivo */}
      <div className="mt-10 flex items-center justify-center gap-3 text-xs uppercase tracking-wide2 text-saint-gray">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        Esperando tu transferencia
      </div>

      {pedido.vence && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-saint-gray">
          Tenés tiempo hasta el {formatFecha(pedido.vence)}. Después el pedido
          se libera y las prendas vuelven a estar disponibles.
        </p>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        {!automatico && (
          <a
            href={whatsappComprobante}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 border border-[#25D366] bg-[#25D366]/10 px-6 py-3 text-xs uppercase tracking-wide2 text-saint-white transition-colors duration-300 hover:bg-[#25D366] hover:text-saint-black"
          >
            Mandar comprobante por WhatsApp
          </a>
        )}
        <p className="text-center text-[11px] leading-relaxed text-saint-gray/80">
          Guardá esta página: es el link de tu pedido.
        </p>
      </div>
    </>
  );
}

/* --- Pago recibido -------------------------------------------------- */

function Confirmado({ pedido, whatsapp }: { pedido: PedidoPublico; whatsapp: string }) {
  return (
    <div className="mt-6 flex flex-col items-center text-center anim-sube">
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-600 text-2xl text-emerald-700">
        ✓
      </span>
      <h1 className="font-serif text-4xl font-light">¡Pago recibido!</h1>
      <p className="mt-4 leading-relaxed text-saint-gray">
        {pedido.nombre ? `Gracias, ${pedido.nombre.split(" ")[0]}. ` : ""}
        Tu pedido está confirmado y ya entró al taller. Escribinos para
        coordinar el <span className="text-saint-white">bordado</span> y el{" "}
        <span className="text-saint-white">envío</span>.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-line">
          Coordinar por WhatsApp
        </a>
        <Link
          href="/tienda"
          className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-saint-white"
        >
          Seguir viendo la tienda →
        </Link>
      </div>
    </div>
  );
}

/* --- Vencido o cancelado ------------------------------------------- */

function Cerrado({ vencido, whatsapp }: { vencido: boolean; whatsapp: string }) {
  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <h1 className="font-serif text-4xl font-light">
        {vencido ? "Este pedido venció" : "Este pedido se canceló"}
      </h1>
      <p className="mt-4 leading-relaxed text-saint-gray">
        {vencido
          ? "Pasó el plazo para transferir y las prendas se liberaron. Si ya transferiste, escribinos con el comprobante y lo resolvemos."
          : "Si creés que es un error o ya transferiste, escribinos y lo vemos."}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-line">
          Escribinos por WhatsApp
        </a>
        <Link
          href="/tienda"
          className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-saint-white"
        >
          Volver a la tienda →
        </Link>
      </div>
    </div>
  );
}

/* --- Piezas --------------------------------------------------------- */

function Resumen({ pedido }: { pedido: PedidoPublico }) {
  return (
    <details className="group mt-12 border-t border-saint-line pt-6">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs uppercase tracking-wide2 text-saint-gray">
        <span>Tu pedido · {pedido.items.reduce((a, i) => a + i.cantidad, 0)} prendas</span>
        <span className="transition-transform group-open:rotate-45">+</span>
      </summary>
      <ul className="mt-5 space-y-4">
        {pedido.items.map((i, n) => (
          <li key={n} className="flex justify-between gap-4 text-sm">
            <div>
              <p className="font-serif text-base">
                {i.nombre} <span className="text-saint-gray">x{i.cantidad}</span>
              </p>
              <p className="text-xs text-saint-gray">
                {[i.talle, i.color].filter(Boolean).join(" · ") || "—"}
              </p>
              {i.bordado && (
                <p className="mt-1 text-[11px] text-saint-gray">
                  Bordado: {describirBordado(i.bordado)}
                </p>
              )}
            </div>
            <p className="shrink-0 tabular-nums">
              {formatPrecio(i.precio_unitario * i.cantidad)}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-between border-t border-saint-line pt-4 text-sm">
        <span className="text-saint-gray">Total</span>
        <span className="font-serif text-xl">{formatPrecio(pedido.total)}</span>
      </div>
    </details>
  );
}

function Dato({
  titulo,
  valor,
  copiable = true,
}: {
  titulo: string;
  valor: string;
  copiable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide2 text-saint-gray">{titulo}</dt>
        <dd className="mt-1 break-all font-mono text-base">{valor}</dd>
      </div>
      {copiable && <BotonCopiar valor={valor} etiqueta="Copiar" chico />}
    </div>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-saint-line text-[11px] text-saint-gray">
        {n}
      </span>
      <span className="text-saint-gray">{children}</span>
    </li>
  );
}

function BotonCopiar({
  valor,
  etiqueta,
  chico = false,
}: {
  valor: string;
  etiqueta: string;
  chico?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Navegadores viejos o sin permiso: el método de siempre.
      const t = document.createElement("textarea");
      t.value = valor;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={
        chico
          ? "shrink-0 border border-saint-line px-4 py-2 text-[11px] uppercase tracking-wide2 text-saint-gray transition-colors hover:border-saint-white hover:text-saint-white"
          : "btn-line mt-5"
      }
    >
      {copiado ? "¡Copiado!" : etiqueta}
    </button>
  );
}
