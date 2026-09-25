import type { Product } from "@/lib/types";
import { agruparEnSecciones, agruparModelos } from "@/lib/catalogo";
import type { Modelo } from "@/lib/catalogo";
import ProductCard from "./ProductCard";
import Reveal from "./Reveal";

/**
 * La vitrina: agrupa los productos en modelos y los muestra.
 *
 * Con `secciones`, el catálogo se separa en bloques con título (Buzos,
 * Remeras, Gorras, Pilusos, Sombreros). Sin eso —cuando se pidió un orden por
 * precio o por nombre— va todo de corrido, que es lo que se pidió.
 */
export default function ProductGrid({
  products,
  emptyMessage = "Todavía no hay productos para mostrar.",
  secciones = false,
  maxModelos,
}: {
  products: Product[];
  emptyMessage?: string;
  secciones?: boolean;
  /**
   * Corta la grilla en esta cantidad de modelos. Lo usa la home: se piden más
   * productos de los que se muestran porque recién al agruparlos se sabe
   * cuántas tarjetas son, y ahí se recorta a lo que entra prolijo.
   */
  maxModelos?: number;
}) {
  if (!products.length) {
    return (
      <p className="py-24 text-center text-sm uppercase tracking-wide2 text-saint-gray">
        {emptyMessage}
      </p>
    );
  }

  const todos = agruparModelos(products);
  const modelos = maxModelos ? todos.slice(0, maxModelos) : todos;

  if (!secciones) return <Grilla modelos={modelos} />;

  const bloques = agruparEnSecciones(modelos);

  // Un solo bloque no es una sección: es todo lo que hay. El título sobra.
  if (bloques.length < 2) return <Grilla modelos={bloques[0]?.modelos ?? []} />;

  return (
    <div className="space-y-20">
      {bloques.map((bloque) => (
        <section key={bloque.clave}>
          <Reveal>
            <div className="mb-8 flex items-baseline gap-4">
              <h2 className="font-serif text-2xl font-light">{bloque.titulo}</h2>
              <span className="hairline flex-1" />
              <span className="text-[10px] uppercase tracking-wide2 text-saint-gray">
                {bloque.modelos.length === 1
                  ? "1 modelo"
                  : `${bloque.modelos.length} modelos`}
              </span>
            </div>
          </Reveal>
          <Grilla modelos={bloque.modelos} />
        </section>
      ))}
    </div>
  );
}

/**
 * La grilla propiamente dicha. Las tarjetas entran escalonadas de a fila: el
 * retraso se reinicia cada cuatro para que la última no llegue tardísimo.
 */
function Grilla({ modelos }: { modelos: Modelo[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {modelos.map((modelo, i) => (
        <Reveal key={modelo.clave} delay={(i % 4) * 90}>
          <ProductCard modelo={modelo} />
        </Reveal>
      ))}
    </div>
  );
}
