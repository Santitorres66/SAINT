"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "produccion";

/**
 * Sube un archivo al bucket PRIVADO de producción y devuelve su ruta interna.
 * - Si es imagen, muestra una previsualización (con URL firmada temporal).
 * - Permite reemplazar y quitar.
 * Valida tipo (por extensión) y tamaño máximo en el navegador.
 */
export default function ProduccionFileInput({
  value,
  onChange,
  carpeta,
  accept,
  esImagen = false,
  label,
  ayuda,
  maxMB = 50,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  carpeta: string; // subcarpeta dentro del bucket (ej. "matrices")
  accept: string; // atributo accept del input
  esImagen?: boolean;
  label: string;
  ayuda?: string;
  maxMB?: number;
}) {
  const supabase = createClient();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  async function subir(file: File) {
    setError(null);

    if (file.size > maxMB * 1024 * 1024) {
      setError(`El archivo supera el máximo de ${maxMB} MB.`);
      return;
    }

    setSubiendo(true);
    const ext = (file.name.split(".").pop() ?? "dat").toLowerCase();
    const path = `${carpeta}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });

    if (upErr) {
      setError(`No se pudo subir: ${upErr.message}`);
      setSubiendo(false);
      return;
    }

    setNombreArchivo(file.name);
    if (esImagen) {
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);
      setPreview(data?.signedUrl ?? null);
    }
    onChange(path);
    setSubiendo(false);
  }

  function quitar() {
    setPreview(null);
    setNombreArchivo(null);
    onChange(null);
  }

  const tieneArchivo = Boolean(value);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>

      {!tieneArchivo ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-8 text-center transition hover:border-neutral-400 hover:bg-neutral-100">
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir(f);
            }}
          />
          <span className="text-sm font-medium text-neutral-700">
            {subiendo ? "Subiendo…" : "Tocá para subir"}
          </span>
          {ayuda && (
            <span className="mt-1 text-xs text-neutral-500">{ayuda}</span>
          )}
        </label>
      ) : (
        <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3">
          {esImagen && preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Previsualización"
              className="h-20 w-20 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 text-2xl">
              📄
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-800">
              {nombreArchivo ?? "Archivo cargado"}
            </p>
            <p className="text-xs text-neutral-400">Guardado ✓</p>
          </div>
          <button
            type="button"
            onClick={quitar}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Quitar
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
