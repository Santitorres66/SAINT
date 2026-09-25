import Link from "next/link";
import Logo from "@/components/Logo";
import ConceptSection from "@/components/ConceptSection";
import ComoFunciona from "@/components/ComoFunciona";
import TrabajosReales from "@/components/TrabajosReales";
import ProductGrid from "@/components/ProductGrid";
import Reveal from "@/components/Reveal";
import { getFeaturedProducts } from "@/lib/products";
import { getTrabajosDestacados } from "@/lib/galeria";

/**
 * HOME — hero editorial con el logo escribiéndose, el concepto del bordado,
 * los tres pasos y la grilla de destacados leídos de Supabase.
 *
 * El movimiento del hero no espera al scroll (ya está en pantalla) y arranca
 * apenas carga; de ahí para abajo, cada sección entra cuando se llega a ella.
 */
export default async function HomePage() {
  // Se piden más de los que se muestran: los destacados se agrupan por modelo
  // y ocho productos pueden ser dos gorras en cuatro colores. Con doce
  // entran, salvo que todo el catálogo sea el mismo modelo.
  // Las dos lecturas son independientes: van juntas y no una después de otra.
  const [destacados, trabajos] = await Promise.all([
    getFeaturedProducts(16),
    getTrabajosDestacados(6),
  ]);

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 text-center">
        <Logo size="xl" tagline animado />

        <p
          className="anim-sube mt-10 max-w-md text-sm leading-relaxed text-saint-gray"
          style={{ ["--d" as string]: "1200ms" }}
        >
          Básicos de calidad que se vuelven únicos a través del bordado
          personalizado. Elegancia simple, sin género, con tu identidad.
        </p>

        <Link
          href="/tienda"
          className="btn-line anim-sube mt-10"
          style={{ ["--d" as string]: "1400ms" }}
        >
          Ver la tienda
        </Link>

        {/* Indicador de scroll */}
        <span
          className="anim-aparece absolute bottom-8 text-[10px] uppercase tracking-wide2 text-saint-gray/60"
          style={{ ["--d" as string]: "1800ms" }}
        >
          Deslizá para descubrir
        </span>
      </section>

      {/* CONCEPTO DEL BORDADO */}
      <ConceptSection />

      {/* LOS TRES PASOS */}
      <ComoFunciona />

      {/* LA PRUEBA: bordados ya entregados */}
      <TrabajosReales trabajos={trabajos} />

      {/* DESTACADOS */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <Reveal>
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide2 text-saint-gray">
                Selección
              </p>
              <h2 className="font-serif text-3xl font-light">Destacados</h2>
            </div>
            <Link
              href="/tienda"
              className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors duration-300 hover:text-saint-white"
            >
              Ver todo →
            </Link>
          </div>
        </Reveal>

        <ProductGrid
          products={destacados}
          maxModelos={8}
          emptyMessage="Muy pronto vas a ver acá las primeras piezas."
        />
      </section>
    </>
  );
}
