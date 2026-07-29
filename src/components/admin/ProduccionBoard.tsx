"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrdenProduccionVista, EstadoProduccion } from "@/lib/types";
import {
  ESTADOS_PRODUCCION,
  formatNumeroOrden,
} from "@/lib/constants";
import { cambiarEstadoProduccion } from "@/app/admin/produccion-actions";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * Tablero de producción: 4 columnas por estado, con tarjetas.
 * El estado se cambia con el selector de cada tarjeta. (El drag & drop
 * se suma en la próxima etapa.)
 */
export default function ProduccionBoard({
  ordenes,
}: {
  ordenes: OrdenProduccionVista[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function mover(id: string, estado: EstadoProduccion) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoProduccion(id, estado);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {ESTADOS_PRODUCCION.map((estado) => {
          const items = ordenes.filter((o) => o.estado === estado.value);
          return (
            <div
              key={estado.value}
              className={`rounded-2xl border ${estado.col} p-3`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-neutral-800">
                  {estado.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.chip}`}
                >
                  {items.length}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        {o.imagen_ref_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.imagen_ref_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xl text-neutral-300">
                            🧵
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-neutral-400">
                          {formatNumeroOrden(o.numero)}
                        </p>
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {o.product_nombre || o.prenda || "—"}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {o.bordado_descripcion || "Sin descripción"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                      <span>Cant: {o.cantidad}</span>
                      {o.talle && <span>Talle: {o.talle}</span>}
                      {o.color && <span>{o.color}</span>}
                      <span>{formatFecha(o.fecha)}</span>
                    </div>

                    {o.cliente && (
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        👤 {o.cliente}
                      </p>
                    )}

                    <select
                      value={o.estado}
                      disabled={pending}
                      onChange={(e) =>
                        mover(o.id, e.target.value as EstadoProduccion)
                      }
                      className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-900 disabled:opacity-50"
                    >
                      {ESTADOS_PRODUCCION.map((e) => (
                        <option key={e.value} value={e.value}>
                          Mover a: {e.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-neutral-400">
                    Sin órdenes
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
