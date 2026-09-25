import Image from "next/image";
import Link from "next/link";
import type { TrabajoGaleria } from "@/lib/types";
import Reveal from "./Reveal";

/**
 * La tira de trabajos reales en la home.
 *
 * Va después de los tres pasos a propósito: primero se explica que el bordado
 * lo elige el cliente, y justo después se muestra que eso ya pasó muchas veces
 * y salió bien. Es la prueba, y va donde recién nació la duda.
 *
 * Si todavía no hay trabajos cargados, la sección no se dibuja: una galería
 * vacía diría lo contrario de lo que queremos decir.
 */
export default function TrabajosReales({
  trabajos,
}: {
  trabajos: TrabajoGaleria[];
}) {
  if (!trabajos.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <Reveal>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wide2 text-saint-gray">
              Hilo sobre tela
            </p>
            <h2 className="font-serif text-3xl font-light">Trabajos reales</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-saint-gray">
              Piezas que ya entregamos. Esto es cómo queda un bordado de verdad.
            </p>
          </div>
          <Link
            href="/galeria"
            className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors duration-300 hover:text-saint-white"
          >
            Ver todos →
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
        {trabajos.map((t, i) => (
          <Reveal key={t.id} delay={(i % 3) * 110}>
            <Link href="/galeria" className="group block">
              <div className="relative aspect-square overflow-hidden bg-saint-ink">
                <Image
                  src={t.imagenes[0]}
                  alt={t.titulo || "Bordado de SAINT"}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.05]"
                />
              </div>
              {(t.titulo || t.prenda) && (
                <p className="mt-3 text-[10px] uppercase tracking-wide2 text-saint-gray transition-colors duration-300 group-hover:text-saint-white">
                  {t.titulo || t.prenda}
                </p>
              )}
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
