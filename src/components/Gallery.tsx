"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Galería del detalle de producto: imagen principal + miniaturas.
 */
export default function Gallery({
  imagenes,
  nombre,
}: {
  imagenes: string[];
  nombre: string;
}) {
  const [activa, setActiva] = useState(0);

  if (!imagenes?.length) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center bg-saint-ink">
        <span className="brand text-3xl text-saint-line">SAINT</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Imagen principal */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-saint-ink">
        <Image
          src={imagenes[activa]}
          alt={`${nombre} — imagen ${activa + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />
      </div>

      {/* Miniaturas */}
      {imagenes.length > 1 && (
        <div className="flex gap-3">
          {imagenes.map((src, i) => (
            <button
              key={src}
              onClick={() => setActiva(i)}
              className={`relative aspect-square w-20 overflow-hidden bg-saint-ink transition-opacity duration-300 ${
                i === activa ? "opacity-100 ring-1 ring-saint-white" : "opacity-50 hover:opacity-100"
              }`}
              aria-label={`Ver imagen ${i + 1}`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
