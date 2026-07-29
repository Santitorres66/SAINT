"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MatrizConUso } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { deleteMatriz } from "@/app/admin/produccion-actions";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/** Biblioteca de matrices: tarjetas con imagen, costo, uso y archivo. */
export default function MatricesList({ matrices }: { matrices: MatrizConUso[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aBorrar, setABorrar] = useState<MatrizConUso | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirmarBorrado() {
    if (!aBorrar) return;
    const id = aBorrar.id;
    setError(null);
    startTransition(async () => {
      const res = await deleteMatriz(id);
      if (res?.error) setError(res.error);
      else {
        setABorrar(null);
        router.refresh();
      }
    });
  }

  if (!matrices.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
        <p className="text-lg font-medium text-neutral-700">
          Todavía no hay matrices.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Cargá tu primera matriz para poder reutilizarla en las órdenes.
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

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matrices.map((m) => (
          <li
            key={m.id}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
          >
            <div className="flex h-40 items-center justify-center bg-neutral-100">
              {m.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imagen_url}
                  alt={m.nombre}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl text-neutral-300">🧵</span>
              )}
            </div>

            <div className="space-y-2 p-4">
              <p className="font-semibold text-neutral-900">{m.nombre}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
                <span>Costo: {formatPrecio(m.costo)}</span>
                <span>Usada {m.veces_usada}×</span>
                <span>{formatFecha(m.fecha_creacion)}</span>
              </div>
              {m.observaciones && (
                <p className="text-xs text-neutral-400">{m.observaciones}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {m.archivo_url && (
                  <a
                    href={m.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Descargar archivo
                  </a>
                )}
                <button
                  onClick={() => setABorrar(m)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar matriz?
            </h3>
            <p className="mt-2 text-neutral-600">
              Vas a eliminar <strong>{aBorrar.nombre}</strong> y su archivo. Las
              órdenes que la usaron quedan, pero sin la matriz asociada.
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
