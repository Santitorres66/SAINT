"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrabajoGaleria } from "@/lib/types";
import {
  deleteTrabajo,
  toggleTrabajoActivo,
  toggleTrabajoDestacado,
} from "@/app/admin/galeria-actions";

/**
 * Listado de la galería en el panel: las fotos cargadas, con lo que se hace
 * todos los días a mano (mostrar, destacar, editar, borrar) al alcance de un
 * clic sobre la miniatura.
 */
export default function GaleriaList({
  trabajos,
}: {
  trabajos: TrabajoGaleria[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [borrando, setBorrando] = useState<TrabajoGaleria | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Corre una acción y vuelve a pedir la lista, como el resto del panel. */
  function ejecutar(accion: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  if (!trabajos.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
        <p className="text-neutral-600">
          Todavía no cargaste ningún trabajo.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
          Las fotos de bordados ya entregados son lo que más convence: muestran
          cómo queda de verdad, que es justo lo que el previsualizador no puede
          prometer.
        </p>
        <Link
          href="/admin/galeria/nuevo"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          Cargar el primero
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {trabajos.map((t) => (
          <article
            key={t.id}
            className={`overflow-hidden rounded-2xl border bg-white transition ${
              t.activo ? "border-neutral-200" : "border-dashed border-neutral-300"
            }`}
          >
            <div className="relative aspect-[4/5] bg-neutral-100">
              {t.imagenes?.[0] && (
                <Image
                  src={t.imagenes[0]}
                  alt={t.titulo || "Trabajo"}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className={`object-cover transition ${
                    t.activo ? "" : "opacity-40 grayscale"
                  }`}
                />
              )}

              <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                {t.destacado && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    En la home
                  </span>
                )}
                {!t.activo && (
                  <span className="rounded bg-neutral-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
                    Oculto
                  </span>
                )}
                {t.imagenes.length > 1 && (
                  <span className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                    {t.imagenes.length} fotos
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <h3 className="font-medium text-neutral-900">
                  {t.titulo || "Sin título"}
                </h3>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {[t.prenda, t.cliente].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    ejecutar(() => toggleTrabajoDestacado(t.id, !t.destacado))
                  }
                  className="text-neutral-500 transition hover:text-amber-700 disabled:opacity-40"
                >
                  {t.destacado ? "Sacar de la home" : "Poner en la home"}
                </button>

                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => ejecutar(() => toggleTrabajoActivo(t.id, !t.activo))}
                  className="text-neutral-500 transition hover:text-neutral-900 disabled:opacity-40"
                >
                  {t.activo ? "Ocultar" : "Mostrar"}
                </button>

                <Link
                  href={`/admin/galeria/editar/${t.id}`}
                  className="text-neutral-500 transition hover:text-neutral-900"
                >
                  Editar
                </Link>

                <button
                  type="button"
                  onClick={() => setBorrando(t)}
                  className="ml-auto text-neutral-400 transition hover:text-red-600"
                >
                  Borrar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Borrar es para siempre, así que se pregunta. */}
      {borrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-medium">Borrar este trabajo</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Se va de la galería y no se puede deshacer.{" "}
              {borrando.activo &&
                "Si solo querés sacarlo de la web por un tiempo, conviene ocultarlo."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setBorrando(null)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => {
                  const id = borrando.id;
                  setBorrando(null);
                  ejecutar(() => deleteTrabajo(id));
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
