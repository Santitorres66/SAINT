"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrabajoGaleria } from "@/lib/types";
import { claveMolde } from "@/lib/constants";
import {
  deleteTrabajo,
  toggleTrabajoActivo,
  toggleTrabajoDestacado,
} from "@/app/admin/galeria-actions";

/**
 * Listado de la galería en el panel.
 *
 * La galería son dos cosas a la vez: lo que se muestra en la web y el archivo
 * de todo lo que se bordó. Mezclados en una sola pila, a partir de la foto
 * treinta no se encuentra nada, así que arriba hay un filtro por estado y una
 * búsqueda por texto.
 *
 * Todo el filtrado pasa acá, en el navegador: son las fotos que ya están en
 * pantalla, no hace falta volver a pedirle nada al servidor por escribir una
 * letra.
 */

type Filtro = "todos" | "web" | "home" | "archivo";
export default function GaleriaList({
  trabajos,
}: {
  trabajos: TrabajoGaleria[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [borrando, setBorrando] = useState<TrabajoGaleria | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");

  /** Corre una acción y vuelve a pedir la lista, como el resto del panel. */
  function ejecutar(accion: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  // Cuántos hay de cada cosa, para que el filtro diga lo que va a mostrar
  // antes de tocarlo.
  const cuenta = {
    todos: trabajos.length,
    web: trabajos.filter((t) => t.activo).length,
    home: trabajos.filter((t) => t.activo && t.destacado).length,
    archivo: trabajos.filter((t) => !t.activo).length,
  };

  const visibles = useMemo(() => {
    const palabras = claveMolde(q).split(/\s+/).filter(Boolean);

    return trabajos.filter((t) => {
      if (filtro === "web" && !t.activo) return false;
      if (filtro === "home" && !(t.activo && t.destacado)) return false;
      if (filtro === "archivo" && t.activo) return false;

      if (!palabras.length) return true;
      const texto = claveMolde(`${t.titulo} ${t.prenda} ${t.cliente} ${t.descripcion}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [trabajos, filtro, q]);

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

      {/* Filtro y búsqueda */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["todos", "Todos"],
              ["web", "En la web"],
              ["home", "En la home"],
              ["archivo", "Archivo"],
            ] as [Filtro, string][]
          ).map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
              className={`rounded-lg px-3.5 py-2 text-sm transition ${
                filtro === valor
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {label}
              <span
                className={`ml-2 text-xs ${
                  filtro === valor ? "text-white/60" : "text-neutral-400"
                }`}
              >
                {cuenta[valor]}
              </span>
            </button>
          ))}
        </div>

        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, prenda o cliente"
          aria-label="Buscar en la galería"
          className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 sm:max-w-xs"
        />
      </div>

      {/* Qué es el archivo, dicho una vez y donde corresponde. */}
      {filtro === "archivo" && (
        <p className="mb-5 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          Estos trabajos no se ven en la web. Es tu registro: subí todo lo que
          bordes, y el día que quieras mostrar alguno, tocá “Mostrar”.
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center text-sm text-neutral-500">
          No hay trabajos que coincidan con eso.
        </p>
      ) : (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((t) => (
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
      )}

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
