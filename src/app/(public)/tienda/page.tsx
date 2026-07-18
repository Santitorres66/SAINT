import type { Metadata } from "next";
import { Suspense } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import ProductGrid from "@/components/ProductGrid";
import { getActiveProducts } from "@/lib/products";
import { labelCategoria } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Tienda",
  description:
    "Explorá todos los básicos de SAINT: buzos, remeras oversized, crops, canguros y gorras. Únicos a través del bordado personalizado.",
};

/**
 * CATÁLOGO — grilla de todos los productos activos, con filtro por categoría.
 */
export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const products = await getActiveProducts(categoria);

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      {/* Encabezado */}
      <div className="mb-12 text-center">
        <h1 className="font-serif text-4xl font-light sm:text-5xl">Tienda</h1>
        <p className="mt-3 text-sm text-saint-gray">
          {categoria
            ? labelCategoria(categoria)
            : "Toda la colección · elegí tu pieza y hacela tuya"}
        </p>
      </div>

      {/* Filtro (Suspense porque usa useSearchParams) */}
      <div className="mb-14">
        <Suspense fallback={null}>
          <CategoryFilter />
        </Suspense>
      </div>

      <ProductGrid
        products={products}
        emptyMessage={
          categoria
            ? "No hay productos en esta categoría por ahora."
            : "Muy pronto vas a ver acá las primeras piezas."
        }
      />
    </div>
  );
}
