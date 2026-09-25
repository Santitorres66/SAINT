"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TrabajoGaleria } from "@/lib/types";
import Reveal from "./Reveal";

/**
 * El mosaico de trabajos reales, con su visor.
 *
 * Las fotos entran escalonadas al bajar y se acomodan en columnas de alturas
 * distintas: un bordado en el pecho y otro en una gorra no tienen por qué
 * entrar en el mismo rectángulo, y forzarlos a una grilla pareja los aplana a
 * todos. Al tocar una, se abre grande con su historia.
 */
export default function GaleriaMosaico({
  trabajos,
}: {
  trabajos: TrabajoGaleria[];
}) {
  const [abierto, setAbierto] = useState<TrabajoGaleria | null>(null);
  const [foto, setFoto] = useState(0);

  function abrir(t: TrabajoGaleria) {
    setAbierto(t);
    setFoto(0);
  }

  if (!trabajos.length) {
    return (
      <p className="py-24 text-center text-sm uppercase tracking-wide2 text-saint-gray">
        Muy pronto vas a ver acá los primeros trabajos.
      </p>
    );
  }

  return (
    <>
      {/* Columnas CSS: cada foto conserva su proporción y el mosaico se
          acomoda solo, sin recortar nada a la fuerza. */}
      <div className="columns-2 gap-5 lg:columns-3 [&>*]:mb-5">
        {trabajos.map((t, i) => (
          <Reveal key={t.id} delay={(i % 3) * 90} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => abrir(t)}
              className="group block w-full text-left"
            >
              <div className="relative overflow-hidden bg-saint-ink">
                <Image
                  src={t.imagenes[0]}
                  alt={t.titulo || "Bordado de SAINT"}
                  width={800}
                  height={1000}
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="h-auto w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.04]"
                />

                {/* La historia asoma al pasar por encima. */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-saint-black/85 px-4 py-3 opacity-0 backdrop-blur-sm transition-all duration-500 ease-smooth group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="block font-serif text-sm">
                    {t.titulo || "Bordado a pedido"}
                  </span>
                  {(t.prenda || t.cliente) && (
                    <span className="mt-0.5 block text-[10px] uppercase tracking-wide2 text-saint-gray">
                      {[t.prenda, t.cliente && `para ${t.cliente}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>

                {t.imagenes.length > 1 && (
                  <span className="absolute right-3 top-3 bg-saint-black/70 px-2 py-1 text-[10px] uppercase tracking-wide2 text-saint-gray backdrop-blur-sm">
                    {t.imagenes.length} fotos
                  </span>
                )}
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {abierto && (
        <Visor
          trabajo={abierto}
          foto={foto}
          setFoto={setFoto}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}

/** La foto en grande, con su historia al costado. */
function Visor({
  trabajo,
  foto,
  setFoto,
  onCerrar,
}: {
  trabajo: TrabajoGaleria;
  foto: number;
  setFoto: (i: number) => void;
  onCerrar: () => void;
}) {
  const total = trabajo.imagenes.length;

  // Escape cierra y las flechas pasan de foto: abierto a pantalla completa, el
  // teclado es lo primero que la mano busca.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") setFoto((foto + 1) % total);
      if (e.key === "ArrowLeft") setFoto((foto - 1 + total) % total);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [foto, total, onCerrar, setFoto]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={trabajo.titulo || "Trabajo de SAINT"}
      className="anim-aparece fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={onCerrar}
    >
      <div
        className="anim-sube grid max-h-full w-full max-w-4xl gap-6 overflow-y-auto bg-saint-black p-5 sm:grid-cols-[1.4fr_1fr] sm:p-6"
        // El clic adentro no cierra: solo el de afuera.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <Image
            src={trabajo.imagenes[foto]}
            alt={trabajo.titulo || "Bordado de SAINT"}
            width={1200}
            height={1500}
            sizes="(max-width: 640px) 100vw, 55vw"
            className="h-auto w-full object-contain"
          />

          {total > 1 && (
            <div className="mt-3 flex gap-2">
              {trabajo.imagenes.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setFoto(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  className={`relative aspect-square w-16 overflow-hidden bg-saint-ink transition-opacity duration-300 ${
                    i === foto
                      ? "opacity-100 ring-1 ring-saint-white"
                      : "opacity-50 hover:opacity-100"
                  }`}
                >
                  <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-serif text-2xl font-light">
              {trabajo.titulo || "Bordado a pedido"}
            </h2>
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="shrink-0 text-saint-gray transition-colors hover:text-saint-white"
            >
              ✕
            </button>
          </div>

          {(trabajo.prenda || trabajo.cliente) && (
            <p className="mt-2 text-[11px] uppercase tracking-wide2 text-saint-gray">
              {[trabajo.prenda, trabajo.cliente && `para ${trabajo.cliente}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {trabajo.descripcion && (
            <p className="mt-5 text-sm leading-relaxed text-saint-gray">
              {trabajo.descripcion}
            </p>
          )}

          <div className="mt-auto space-y-3 pt-8">
            {trabajo.product_id && (
              <Link href={`/producto/${trabajo.product_id}`} className="btn-line w-full">
                Ver esta prenda
              </Link>
            )}
            <p className="text-[11px] leading-relaxed text-saint-gray/70">
              Cada bordado se hace de nuevo, a mano: dos piezas del mismo diseño
              nunca salen idénticas. Eso es exactamente lo que las hace únicas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
