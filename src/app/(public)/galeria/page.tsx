import type { Metadata } from "next";
import Link from "next/link";
import GaleriaMosaico from "@/components/GaleriaMosaico";
import Reveal from "@/components/Reveal";
import { getTrabajos } from "@/lib/galeria";

export const metadata: Metadata = {
  title: "Trabajos reales",
  description:
    "Bordados de SAINT ya entregados: piezas reales, hechas a mano, sobre buzos, remeras, gorras y sombreros.",
};

/**
 * GALERÍA — las piezas terminadas.
 *
 * Es la página que contesta la pregunta que nadie hace en voz alta: "¿y cómo
 * queda de verdad?". Por eso también es el lugar donde se dice, sin vueltas,
 * que el previsualizador de la tienda es una idea y esto es el bordado.
 */
export default async function GaleriaPage() {
  const trabajos = await getTrabajos();

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14 text-center">
        <p className="anim-sube text-[11px] uppercase tracking-wide2 text-saint-gray">
          Piezas entregadas
        </p>
        <h1
          className="anim-sube mt-4 font-serif text-4xl font-light sm:text-5xl"
          style={{ ["--d" as string]: "120ms" }}
        >
          Trabajos reales
        </h1>
        <p
          className="anim-sube mx-auto mt-5 max-w-xl text-sm leading-relaxed text-saint-gray"
          style={{ ["--d" as string]: "240ms" }}
        >
          Cada una de estas piezas la pidió alguien y la bordamos a mano. No hay
          renders acá: es hilo sobre tela, con su relieve y su textura.
        </p>
      </div>

      <GaleriaMosaico trabajos={trabajos} />

      <Reveal>
        <div className="mt-24 border-t border-saint-line pt-16 text-center">
          <h2 className="font-serif text-2xl font-light">
            ¿Ya sabés qué querés bordado?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-saint-gray">
            Elegí la prenda y probá cómo te queda tu bordado antes de pedirlo.
          </p>
          <Link href="/tienda" className="btn-line mt-8">
            Ir a la tienda
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
