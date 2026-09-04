import type { Metadata } from "next";
import { Suspense } from "react";
import StoreFilters from "@/components/StoreFilters";
import ProductGrid from "@/components/ProductGrid";
import { getActiveProducts, getOpcionesDeCatalogo } from "@/lib/products";
import { labelCategoria } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Tienda",
  description:
    "Explorá todos los básicos de SAINT: buzos, remeras oversized, crops, canguros y gorras. Únicos a través del bordado personalizado.",
};

/** Los params de la URL llegan como string; acá se vuelven filtros usables. */
type Params = {
  categoria?: string;
  q?: string;
  talle?: string;
  color?: string;
  min?: string;
  max?: string;
  orden?: string;
};

/** "S,M" → ["S","M"]. Descarta vacíos para que ",," no filtre por nada. */
function lista(valor?: string): string[] | undefined {
  const items = (valor ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** Un número de la URL, o undefined si vino vacío o con cualquier cosa. */
function numero(valor?: string): number | undefined {
  if (!valor?.trim()) return undefined;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * CATÁLOGO — grilla de productos activos, con filtros por categoría, talle,
 * color, precio y texto, más el criterio de orden. Todo viaja en la URL.
 */
export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;

  const filtros = {
    categoria: sp.categoria,
    q: sp.q,
    talles: lista(sp.talle),
    colores: lista(sp.color),
    precioMin: numero(sp.min),
    precioMax: numero(sp.max),
    orden: sp.orden,
  };

  // Las dos consultas son independientes: van juntas y no una después de otra.
  const [products, opciones] = await Promise.all([
    getActiveProducts(filtros),
    getOpcionesDeCatalogo(sp.categoria),
  ]);

  // Con filtros puestos, "no hay nada" significa otra cosa: no es que el rubro
  // esté vacío, es que la búsqueda no encontró. El mensaje lo tiene que decir.
  const hayFiltros = Boolean(
    sp.q || sp.talle || sp.color || sp.min || sp.max,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      {/* Encabezado */}
      <div className="mb-12 text-center">
        <h1 className="font-serif text-4xl font-light sm:text-5xl">Tienda</h1>
        <p className="mt-3 text-sm text-saint-gray">
          {sp.categoria
            ? labelCategoria(sp.categoria)
            : "Toda la colección · elegí tu pieza y hacela tuya"}
        </p>
      </div>

      {/* Filtros (Suspense porque usan useSearchParams) */}
      <div className="mb-14">
        <Suspense fallback={null}>
          <StoreFilters opciones={opciones} cantidad={products.length} />
        </Suspense>
      </div>

      <ProductGrid
        products={products}
        emptyMessage={
          hayFiltros
            ? "No encontramos piezas con esos filtros. Probá quitando alguno."
            : sp.categoria
              ? "No hay productos en esta categoría por ahora."
              : "Muy pronto vas a ver acá las primeras piezas."
        }
      />
    </div>
  );
}
