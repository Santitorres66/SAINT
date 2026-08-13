"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VentaUnificada } from "@/lib/types";
import { formatPrecio, chipCobro, labelCobro, formatNumeroOrden } from "@/lib/constants";
import { deleteVentaManual } from "@/app/admin/gestion-actions";
import CobrosPanel from "@/components/admin/CobrosPanel";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Filtros de la lista: por canal de venta y por estado de cobro. */
type FiltroCanal = "todas" | "online" | "manual";
type FiltroCobro = "todos" | "pendiente" | "cobrado";

/** Listado unificado de ventas (online + manuales), con su estado de cobro. */
export default function VentasList({
  ventas,
  abrirCobroId,
}: {
  ventas: VentaUnificada[];
  /** Venta cuyo panel de cobros se abre al entrar (viene de ?cobrar=…). */
  abrirCobroId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aBorrar, setABorrar] = useState<VentaUnificada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canal, setCanal] = useState<FiltroCanal>("todas");
  const [cobro, setCobro] = useState<FiltroCobro>("todos");
  const [cobrandoId, setCobrandoId] = useState<string | null>(
    abrirCobroId ?? null,
  );

  // Se relee de `ventas` en cada render: así el panel muestra los datos
  // frescos después de registrar un cobro (router.refresh()).
  const ventaCobrando = cobrandoId
    ? ventas.find((v) => v.id === cobrandoId && v.canal === "manual") ?? null
    : null;

  const nOnline = ventas.filter((v) => v.canal === "online").length;
  const nManual = ventas.filter((v) => v.canal === "manual").length;
  const nPendientes = ventas.filter((v) => v.saldo > 0).length;

  const visibles = ventas
    .filter((v) => canal === "todas" || v.canal === canal)
    .filter((v) => {
      if (cobro === "todos") return true;
      if (cobro === "pendiente") return v.saldo > 0;
      return v.saldo <= 0;
    });

  function confirmarBorrado() {
    if (!aBorrar) return;
    const id = aBorrar.id;
    setError(null);
    startTransition(async () => {
      const res = await deleteVentaManual(id);
      if (res?.error) setError(res.error);
      else {
        setABorrar(null);
        router.refresh();
      }
    });
  }

  if (!ventas.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
        <p className="text-lg font-medium text-neutral-700">
          Todavía no hay ventas.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Las ventas de la web aparecen solas. También podés cargar ventas
          manuales.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Filtro por canal */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["todas", `Todas (${ventas.length})`],
            ["online", `Tienda web (${nOnline})`],
            ["manual", `Manuales (${nManual})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setCanal(k)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              canal === k
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtro por estado de cobro */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["todos", "Todo el cobro"],
            ["pendiente", `Con saldo pendiente (${nPendientes})`],
            ["cobrado", "Saldadas"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setCobro(k)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              cobro === k
                ? "border-neutral-700 bg-neutral-100 text-neutral-900"
                : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
          No hay ventas de ese tipo.
        </p>
      ) : (
        <ul className="space-y-4">
          {visibles.map((v) => (
          <li
            key={`${v.canal}-${v.id}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      v.canal === "online"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {v.canal === "online" ? "Web" : "Manual"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chipCobro(v.estado_cobro)}`}
                  >
                    {labelCobro(v.estado_cobro)}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {v.medio_pago}
                  </span>
                </div>
                <p className="mt-1.5 font-medium text-neutral-900">
                  {v.cliente}
                </p>
                <p className="text-sm text-neutral-500">
                  {formatFecha(v.fecha)}
                </p>
                {v.orden_id && v.orden_numero !== null && (
                  <Link
                    href={`/admin/produccion/${v.orden_id}`}
                    className="mt-1 inline-block font-mono text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
                  >
                    🧵 Orden {formatNumeroOrden(v.orden_numero)}
                  </Link>
                )}
              </div>

              <div className="text-right">
                <p className="text-lg font-semibold text-neutral-900">
                  {formatPrecio(v.total)}
                </p>
                {/* Solo mostramos el detalle del cobro cuando aporta algo:
                    si está todo cobrado y sin descuento, el total ya lo dice. */}
                {v.canal === "manual" &&
                  (v.saldo > 0 || v.descuento > 0) && (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {v.descuento > 0 && (
                        <p>Descuento: − {formatPrecio(v.descuento)}</p>
                      )}
                      {v.total_cobrado > 0 && (
                        <p>Cobrado: {formatPrecio(v.total_cobrado)}</p>
                      )}
                      {v.saldo > 0 && (
                        <p className="font-medium text-amber-700">
                          Falta cobrar: {formatPrecio(v.saldo)}
                        </p>
                      )}
                    </div>
                  )}
                {v.canal === "manual" && (
                  <div className="mt-1.5 flex flex-wrap items-center justify-end gap-3">
                    <button
                      onClick={() => setCobrandoId(v.id)}
                      className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                    >
                      {v.saldo > 0 ? "Registrar cobro" : "Ver cobros"}
                    </button>
                    <Link
                      href={`/admin/ventas/editar/${v.id}`}
                      className="text-xs font-medium text-neutral-600 hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => setABorrar(v)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 pt-2 text-sm text-neutral-600">
              {v.items.map((it, idx) => (
                <li key={idx} className="flex justify-between py-1.5">
                  <span>
                    {it.cantidad}× {it.nombre}
                    {[it.talle, it.color].filter(Boolean).length > 0 && (
                      <span className="text-neutral-400">
                        {" "}
                        ({[it.talle, it.color].filter(Boolean).join(" · ")})
                      </span>
                    )}
                  </span>
                  <span>{formatPrecio(it.precio_unitario * it.cantidad)}</span>
                </li>
              ))}
            </ul>
          </li>
          ))}
        </ul>
      )}

      {ventaCobrando && (
        <CobrosPanel
          venta={ventaCobrando}
          onClose={() => setCobrandoId(null)}
        />
      )}

      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar esta venta?
            </h3>
            {aBorrar.orden_id ? (
              <p className="mt-2 text-neutral-600">
                Esta venta cierra la orden{" "}
                <strong className="font-mono">
                  {formatNumeroOrden(aBorrar.orden_numero ?? 0)}
                </strong>
                , que va a volver a <strong>Entregado</strong>. El stock no
                cambia: esa prenda ya había salido al crear la orden. También se
                borran sus cobros. Esta acción no se puede deshacer.
              </p>
            ) : (
              <p className="mt-2 text-neutral-600">
                Se va a <strong>devolver al stock</strong> lo que esta venta
                había descontado, y se borran sus cobros. Esta acción no se
                puede deshacer.
              </p>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setABorrar(null)}
                disabled={pending}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                disabled={pending}
                className="rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
