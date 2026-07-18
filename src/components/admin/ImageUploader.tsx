"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";

/**
 * Subidor de imágenes al Storage de Supabase.
 * - Sube cada archivo al bucket "productos" y guarda su URL pública.
 * - Muestra miniaturas con opción de quitar.
 * - Permite reordenar (la primera imagen es la portada).
 */
export default function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const supabase = createClient();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarArchivos(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);
    setSubiendo(true);

    const nuevas: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setError("Solo se pueden subir imágenes.");
        continue;
      }
      // Nombre único para evitar colisiones.
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (upErr) {
        setError(`No se pudo subir ${file.name}: ${upErr.message}`);
        continue;
      }

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      nuevas.push(data.publicUrl);
    }

    onChange([...value, ...nuevas]);
    setSubiendo(false);
  }

  function quitar(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  function hacerPortada(url: string) {
    onChange([url, ...value.filter((u) => u !== url)]);
  }

  return (
    <div className="space-y-4">
      {/* Zona de subida */}
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center transition hover:border-neutral-400 hover:bg-neutral-100">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => manejarArchivos(e.target.files)}
          disabled={subiendo}
        />
        <span className="text-base font-medium text-neutral-700">
          {subiendo ? "Subiendo imágenes…" : "Tocá acá para subir fotos"}
        </span>
        <span className="mt-1 text-sm text-neutral-500">
          Podés elegir varias a la vez (JPG, PNG, WEBP).
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Miniaturas */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
            >
              <Image
                src={url}
                alt={`Imagen ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
              />

              {/* Etiqueta de portada */}
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium text-white">
                  Portada
                </span>
              )}

              {/* Acciones al hover */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => hacerPortada(url)}
                    className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-neutral-800"
                    title="Usar como portada"
                  >
                    Portada
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => quitar(url)}
                  className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-400">
        La primera imagen es la portada que se ve en la tienda. Pasá el mouse por
        una foto para cambiarla de portada o quitarla.
      </p>
    </div>
  );
}
