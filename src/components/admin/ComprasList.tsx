"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Compra } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { deleteCompra } from "@/app/admin/gestion-actions";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/** Listado de compras con opción de eliminar (revierte el stock). */
export default function ComprasList({ compras }: { compras: Compra[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aBorrar, setABorrar] = useState<Compra | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirmarBorrado() {
    if (!aBorrar) return;
    const id = aBorrar.id;
    setError(null);
    startTransition(async () => {
      const res = await deleteCompra(id);
      if (res?.error) setError(res.error);
      else {
        setABorrar(null);
        router.refresh();
      }
    });
  }

  if (!compras.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
        <p className="text-lg font-medium text-neutral-700">
          Todavía no registraste compras.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Cargá una compra para sumar stock a tus productos.
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
        {compras.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-neutral-900">
                  {c.proveedor_nombre || "Sin proveedor"}
                </p>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {formatFecha(c.fecha)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-neutral-900">
                  {formatPrecio(c.total)}
                </p>
                <button
                  onClick={() => setABorrar(c)}
                  className="mt-1 text-xs font-medium text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>

            <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 pt-2 text-sm text-neutral-600">
              {c.items.map((it, idx) => (
                <li key={idx} className="flex justify-between py-1.5">
                  <span>
                    {it.cantidad}× {it.nombre}
                  </span>
                  <span>{formatPrecio(it.costo_unitario * it.cantidad)}</span>
                </li>
              ))}
            </ul>

            {c.notas && (
              <p className="mt-2 text-xs text-neutral-400">{c.notas}</p>
            )}
          </li>
        ))}
      </ul>

      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar esta compra?
            </h3>
            <p className="mt-2 text-neutral-600">
              Se va a <strong>descontar del stock</strong> lo que esta compra
              había sumado. Esta acción no se puede deshacer.
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
