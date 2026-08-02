"use client";

import { useState } from "react";
import { tablaTallesDe } from "@/lib/constants";

/**
 * Tabla de talles del producto (medidas de la prenda), en un modal elegante
 * acorde a la estética SAINT. Se muestra según la categoría.
 */
export default function SizeChart({ categoria }: { categoria: string }) {
  const tabla = tablaTallesDe(categoria);
  const [open, setOpen] = useState(false);

  if (!tabla) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs uppercase tracking-wide2 text-saint-gray underline underline-offset-4 transition-colors hover:text-saint-white"
      >
        Tabla de talles
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md border border-saint-line bg-saint-black p-8 sm:p-10"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-saint-gray transition-colors hover:text-saint-white"
            >
              ✕
            </button>

            {/* Encabezado */}
            <div className="mb-8 text-center">
              <h3 className="brand text-2xl">TABLA DE TALLES</h3>
              <span className="hairline mx-auto my-3 max-w-[6rem]" />
              <p className="text-xs uppercase tracking-wide2 text-saint-gray">
                {tabla.titulo}
              </p>
            </div>

            {/* Tabla */}
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide2 text-saint-gray">
                  <th className="border border-saint-line py-2 font-normal"></th>
                  <th className="border border-saint-line py-2 font-normal">
                    Ancho
                  </th>
                  <th className="border border-saint-line py-2 font-normal">
                    Largo
                  </th>
                </tr>
              </thead>
              <tbody>
                {tabla.filas.map((f) => (
                  <tr key={f.talle}>
                    <td className="border border-saint-line py-2 font-serif text-base">
                      {f.talle}
                    </td>
                    <td className="border border-saint-line py-2 text-saint-gray">
                      {f.ancho}
                    </td>
                    <td className="border border-saint-line py-2 text-saint-gray">
                      {f.largo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Nota */}
            <p className="mt-8 text-center text-xs leading-relaxed text-saint-gray">
              El algodón tiene un achique aproximado del 5% en el primer lavado.
              ¡No te preocupes! Ya está contemplado en la moldería.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
