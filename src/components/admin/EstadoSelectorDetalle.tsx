"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EstadoProduccion } from "@/lib/types";
import { ESTADOS_PRODUCCION } from "@/lib/constants";
import { cambiarEstadoProduccion } from "@/app/admin/produccion-actions";

/** Selector de estado para el detalle de una orden. */
export default function EstadoSelectorDetalle({
  id,
  estado,
}: {
  id: string;
  estado: EstadoProduccion;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar(nuevo: EstadoProduccion) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoProduccion(id, nuevo);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <select
        value={estado}
        disabled={pending}
        onChange={(e) => cambiar(e.target.value as EstadoProduccion)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-900 disabled:opacity-50"
      >
        {ESTADOS_PRODUCCION.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
