"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import {
  cancelarTransferencia,
  confirmarTransferencia,
  marcarTransferenciaRevisada,
  revisarEnTalo,
} from "@/app/admin/transferencias-actions";

/** $45.000,37: acá los centavos importan, son los que identifican el pago. */
function formatMonto(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: Math.round(n * 100) % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Pedidos web por transferencia que necesitan una mirada.
 *
 * Con Talo, los pagos se confirman solos y esta lista casi siempre está
 * vacía: solo aparecen los que todavía no pagaron o los que pagaron mal. En
 * modo manual, acá se confirma cada pedido al ver la plata en el banco; el
 * monto con centavos es lo que hay que buscar.
 */
export default function TransferenciasPendientes({ pedidos }: { pedidos: Order[] }) {
  if (pedidos.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <h2 className="text-lg font-semibold text-neutral-900">
        Pedidos web por transferencia
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Esperando la plata o con algo para revisar. Buscá el{" "}
        <strong>monto exacto</strong> en tu cuenta para saber de quién es cada
        transferencia.
      </p>

      <ul className="mt-4 space-y-3">
        {pedidos.map((p) => (
          <Fila key={p.id} pedido={p} />
        ))}
      </ul>
    </section>
  );
}

function Fila({ pedido: p }: { pedido: Order }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const vencido =
    p.status === "pending" && p.pago_vence && new Date(p.pago_vence) < new Date();
  const pagado = p.status === "approved";
  const conTalo = Boolean(p.pago_id);

  function correr(accion: () => Promise<{ error?: string }>, pregunta?: string) {
    if (pregunta && !window.confirm(pregunta)) return;
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const comprador = p.comprador;
  const prendas = (p.items ?? [])
    .map((i) => `${i.cantidad}× ${i.nombre}${i.talle ? ` ${i.talle}` : ""}`)
    .join(", ");

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">
            {p.referencia ?? p.id.slice(0, 8)} · {comprador?.nombre || "Cliente web"}
            {comprador?.telefono && (
              <a
                href={`https://wa.me/${comprador.telefono.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-sm font-normal text-emerald-700 underline"
              >
                {comprador.telefono}
              </a>
            )}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatFecha(p.created_at)} · {prendas}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {conTalo ? "Cobro automático (Talo)" : "Transferencia manual"}
            {p.pago_estado && conTalo ? ` · Talo: ${p.pago_estado}` : ""}
            {p.status === "pending" && p.pago_vence
              ? vencido
                ? " · venció"
                : ` · vence ${formatFecha(p.pago_vence)}`
              : ""}
          </p>
          {p.notas && (
            <p className="mt-2 rounded-lg bg-amber-100 px-3 py-1.5 text-sm text-amber-900">
              {p.notas}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-xl font-semibold tabular-nums text-neutral-900">
            {formatMonto(Number(p.pago_monto ?? p.total))}
          </p>
          {Number(p.pago_monto ?? p.total) !== Number(p.total) && (
            <p className="text-xs text-neutral-500">
              precio {formatPrecio(Number(p.total))}
            </p>
          )}
          <p
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              pagado
                ? "bg-emerald-100 text-emerald-800"
                : vencido
                  ? "bg-neutral-200 text-neutral-700"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {pagado ? "Pagado" : vencido ? "Vencido" : "Esperando pago"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pagado ? (
          <button
            disabled={pending}
            onClick={() => correr(() => marcarTransferenciaRevisada(p.id))}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Listo, ya lo resolví
          </button>
        ) : (
          <>
            <button
              disabled={pending}
              onClick={() =>
                correr(
                  () => confirmarTransferencia(p.id),
                  `¿Confirmás que entró ${formatMonto(Number(p.pago_monto ?? p.total))}? Se descuenta el stock y el pedido pasa a Producción.`,
                )
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Ya entró la plata · confirmar
            </button>
            {conTalo && (
              <button
                disabled={pending}
                onClick={() => correr(() => revisarEnTalo(p.id))}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                Consultar en Talo
              </button>
            )}
            <button
              disabled={pending}
              onClick={() =>
                correr(
                  () => cancelarTransferencia(p.id),
                  "¿Cancelar este pedido? No se pagó, así que no hay stock para devolver.",
                )
              }
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Cancelar pedido
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}
