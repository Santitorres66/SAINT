import Link from "next/link";
import Logo from "@/components/Logo";
import ConceptSection from "@/components/ConceptSection";
import ProductGrid from "@/components/ProductGrid";
import { getFeaturedProducts } from "@/lib/products";

/**
 * HOME — hero negro editorial con logo y tagline, sección del concepto del
 * bordado y grilla de destacados leídos de Supabase.
 */
export default async function HomePage() {
  const destacados = await getFeaturedProducts(8);

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 text-center">
        <Logo size="xl" tagline />

        <p className="mt-10 max-w-md text-sm leading-relaxed text-saint-gray">
          Básicos de calidad que se vuelven únicos a través del bordado
          personalizado. Elegancia simple, sin género, con tu identidad.
        </p>

        <Link href="/tienda" className="btn-line mt-10">
          Ver la tienda
        </Link>

        {/* Indicador de scroll */}
        <span className="absolute bottom-8 text-[10px] uppercase tracking-wide2 text-saint-gray/60">
          Deslizá para descubrir
        </span>
      </section>

      {/* CONCEPTO DEL BORDADO */}
      <ConceptSection />

      {/* DESTACADOS */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
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

        <ProductGrid
          products={destacados}
          emptyMessage="Muy pronto vas a ver acá las primeras piezas."
        />
      </section>
    </>
  );
}
