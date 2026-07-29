"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrdenProduccion } from "@/app/admin/produccion-actions";

/** Botón para eliminar una orden de producción (devuelve el stock). */
export default function EliminarOrdenBtn({ id }: { id: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function eliminar() {
    setError(null);
    startTransition(async () => {
      const res = await deleteOrdenProduccion(id);
      if (res?.error) setError(res.error);
      else {
        router.push("/admin/produccion");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Eliminar orden
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar esta orden?
            </h3>
            <p className="mt-2 text-neutral-600">
              Se va a <strong>devolver al stock</strong> la cantidad que esta
              orden había descontado. Esta acción no se puede deshacer.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setAbierto(false)}
                disabled={pending}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
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
