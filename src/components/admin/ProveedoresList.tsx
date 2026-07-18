"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Proveedor } from "@/lib/types";
import { deleteProveedor } from "@/app/admin/gestion-actions";

/** Listado de proveedores con editar y eliminar (con confirmación). */
export default function ProveedoresList({
  proveedores,
}: {
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aBorrar, setABorrar] = useState<Proveedor | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirmarBorrado() {
    if (!aBorrar) return;
    const id = aBorrar.id;
    setError(null);
    startTransition(async () => {
      const res = await deleteProveedor(id);
      if (res?.error) setError(res.error);
      else {
        setABorrar(null);
        router.refresh();
      }
    });
  }

  if (!proveedores.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
        <p className="text-lg font-medium text-neutral-700">
          Todavía no cargaste proveedores.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Agregá tu primer proveedor para después cargarle compras.
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

      <ul className="grid gap-4 sm:grid-cols-2">
        {proveedores.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-neutral-900">
                  {p.nombre}
                </p>
                <div className="mt-1 space-y-0.5 text-sm text-neutral-500">
                  {p.telefono && <p>📞 {p.telefono}</p>}
                  {p.email && <p>✉️ {p.email}</p>}
                  {p.cuit && <p>CUIT: {p.cuit}</p>}
                </div>
                {p.notas && (
                  <p className="mt-2 text-sm text-neutral-400">{p.notas}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href={`/admin/proveedores/editar/${p.id}`}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Editar
              </Link>
              <button
                onClick={() => setABorrar(p)}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar proveedor?
            </h3>
            <p className="mt-2 text-neutral-600">
              Vas a eliminar <strong>{aBorrar.nombre}</strong>. Las compras que
              le hayas cargado quedan, pero sin proveedor asociado.
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
