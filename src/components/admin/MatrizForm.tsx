"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { MatrizInput } from "@/lib/types";
import { createMatriz } from "@/app/admin/produccion-actions";
import ProduccionFileInput from "./ProduccionFileInput";

/** Formulario para crear una matriz en la biblioteca. */
export default function MatrizForm() {
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [imagenPath, setImagenPath] = useState<string | null>(null);
  const [archivoPath, setArchivoPath] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: MatrizInput = {
      nombre,
      costo: Number(costo) || 0,
      observaciones,
      imagen_path: imagenPath,
      archivo_path: archivoPath,
    };
    startTransition(async () => {
      const res = await createMatriz(input);
      if (res?.error) setError(res.error);
    });
  }

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <label htmlFor="nombre" className={labelClase}>
            Nombre de la matriz *
          </label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputClase}
            placeholder="Ej: Logo empresa XYZ"
          />
        </div>

        <div>
          <label htmlFor="costo" className={labelClase}>
            Costo de realización
          </label>
          <input
            id="costo"
            type="number"
            min="0"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            className={inputClase}
            placeholder="Ej: 8000"
          />
        </div>

        <div>
          <label htmlFor="obs" className={labelClase}>
            Observaciones
          </label>
          <textarea
            id="obs"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            className={inputClase}
            placeholder="Cantidad de puntadas, colores, notas del digitalizado…"
          />
        </div>
      </section>

      <section className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <ProduccionFileInput
          label="Imagen de referencia"
          value={imagenPath}
          onChange={setImagenPath}
          carpeta="matrices"
          accept="image/*"
          esImagen
          ayuda="JPG, PNG o WEBP"
        />
        <ProduccionFileInput
          label="Archivo de matriz"
          value={archivoPath}
          onChange={setArchivoPath}
          carpeta="matrices"
          accept=".dst,.emb,.pdf,.png,.jpg,.jpeg,.zip"
          ayuda="DST, EMB, PDF, PNG, JPG o ZIP"
        />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/produccion/matrices"
          className="rounded-xl border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-neutral-900 px-8 py-3 text-base font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar matriz"}
        </button>
      </div>
    </form>
  );
}
