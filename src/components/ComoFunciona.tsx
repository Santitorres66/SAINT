import Link from "next/link";
import Reveal from "./Reveal";

/**
 * Los tres pasos: elegís la prenda, elegís el bordado, la usás.
 *
 * Está para contestar la pregunta que se hace cualquiera que entra y ve
 * prendas lisas: "¿y esto qué tiene de especial?". El hilo que une los tres
 * pasos se cose solo cuando la sección aparece — es la única animación de la
 * home que cuenta algo en lugar de solo decorar.
 */

const PASOS = [
  {
    numero: "01",
    titulo: "Elegí la prenda",
    texto:
      "Buzos, remeras, gorras y sombreros. Básicos sobrios, sin género, en el color que va con vos.",
  },
  {
    numero: "02",
    titulo: "Elegí el bordado",
    texto:
      "Tu personaje, tu mascota, una fecha, un símbolo que solo vos entendés. Nos mandás la idea y la bordamos.",
  },
  {
    numero: "03",
    titulo: "Ya es tuya",
    texto:
      "Bordada a mano y en hilo, pieza única. No existe otra igual, ni siquiera acá.",
  },
];

export default function ComoFunciona() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-28">
      <Reveal>
        <div className="text-center">
          <p className="mb-6 text-[11px] uppercase tracking-wide2 text-saint-gray">
            Cómo funciona
          </p>
          <h2 className="font-serif text-3xl font-light leading-snug sm:text-4xl">
            La prenda la elegís vos.
            <br className="hidden sm:block" /> El bordado, también.
          </h2>
        </div>
      </Reveal>

      <Reveal delay={120} className="mt-16">
        {/* El hilo. Decorativo: lo que dice ya está escrito en los pasos. */}
        <svg
          aria-hidden
          viewBox="0 0 800 40"
          preserveAspectRatio="none"
          className="hidden h-10 w-full sm:block"
          style={{ ["--largo" as string]: "100" }}
        >
          <path
            d="M 40 20 C 200 -10, 280 50, 400 20 C 520 -10, 600 50, 760 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            pathLength={100}
            className="hilo text-saint-gray/50"
          />
          {[40, 400, 760].map((x) => (
            <circle key={x} cx={x} cy={20} r={2.5} className="fill-saint-gray/60" />
          ))}
        </svg>

        <div className="mt-8 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {PASOS.map((paso, i) => (
            <Reveal key={paso.numero} delay={200 + i * 140}>
              <div className="text-center sm:text-left">
                <p className="font-serif text-2xl font-light text-saint-gray/60">
                  {paso.numero}
                </p>
                <h3 className="mt-3 font-serif text-xl">{paso.titulo}</h3>
                <p className="mt-3 text-sm leading-relaxed text-saint-gray">
                  {paso.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Reveal delay={620}>
        <div className="mt-16 text-center">
          <Link href="/tienda" className="btn-line">
            Empezar por la prenda
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
