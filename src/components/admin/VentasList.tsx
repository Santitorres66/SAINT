"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VentaUnificada } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { deleteVentaManual } from "@/app/admin/gestion-actions";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Listado unificado de ventas (online + manuales). */
export default function VentasList({ ventas }: { ventas: VentaUnificada[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aBorrar, setABorrar] = useState<VentaUnificada | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <ul className="space-y-4">
        {ventas.map((v) => (
          <li
            key={`${v.canal}-${v.id}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      v.canal === "online"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {v.canal === "online" ? "Web" : "Manual"}
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
              </div>

              <div className="text-right">
                <p className="text-lg font-semibold text-neutral-900">
                  {formatPrecio(v.total)}
                </p>
                {v.canal === "manual" && (
                  <button
                    onClick={() => setABorrar(v)}
                    className="mt-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
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

      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar esta venta?
            </h3>
            <p className="mt-2 text-neutral-600">
              Se va a <strong>devolver al stock</strong> lo que esta venta había
              descontado. Esta acción no se puede deshacer.
            </p>
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
