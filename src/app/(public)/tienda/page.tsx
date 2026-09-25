import type { Metadata } from "next";
import { Suspense } from "react";
import StoreFilters from "@/components/StoreFilters";
import ProductGrid from "@/components/ProductGrid";
import Reveal from "@/components/Reveal";
import { getActiveProducts, getOpcionesDeCatalogo } from "@/lib/products";
import { agruparModelos } from "@/lib/catalogo";
import { labelCategoria, ordenAgrupado } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Tienda",
  description:
    "Explorá todos los básicos de SAINT: buzos, remeras, crop tops, gorras y sombreros. Únicos a través del bordado personalizado.",
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

  // Lo que se cuenta en pantalla son modelos, no filas de la base: quien mira
  // la tienda ve una gorra que viene en cuatro colores, no cuatro gorras.
  const modelos = agruparModelos(products).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      {/* Encabezado */}
      <div className="mb-12 text-center">
        <h1 className="anim-sube font-serif text-4xl font-light sm:text-5xl">
          Tienda
        </h1>
        <p
          className="anim-sube mt-3 text-sm text-saint-gray"
          style={{ ["--d" as string]: "120ms" }}
        >
          {sp.categoria
            ? labelCategoria(sp.categoria)
            : "Toda la colección · elegí tu pieza y hacela tuya"}
        </p>

        {/* Los dos pasos, dichos al entrar: primero la prenda, después el
            bordado. Es el recorrido completo de la marca en una línea. */}
        <p
          className="anim-sube mt-6 text-[11px] uppercase tracking-wide2 text-saint-gray/70"
          style={{ ["--d" as string]: "240ms" }}
        >
          Paso 1 · elegí la prenda <span className="mx-2">—</span> Paso 2 ·
          elegí el bordado
        </p>
      </div>

      {/* Filtros (Suspense porque usan useSearchParams) */}
      <div className="mb-14">
        <Suspense fallback={null}>
          <StoreFilters opciones={opciones} cantidad={modelos} />
        </Suspense>
      </div>

      <ProductGrid
        products={products}
        secciones={ordenAgrupado(sp.orden)}
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
