import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatPrecio, labelCategoria } from "@/lib/constants";

/**
 * Card elegante de producto para las grillas (home y catálogo).
 * Imagen con zoom suave al hover; tipografía sobria.
 */
export default function ProductCard({ product }: { product: Product }) {
  const portada = product.imagenes?.[0];
  const sinStock = product.stock <= 0;

  return (
    <Link href={`/producto/${product.id}`} className="group block">
      {/* Imagen */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-saint-ink">
        {portada ? (
          <Image
            src={portada}
            alt={product.nombre}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="brand text-2xl text-saint-line">SAINT</span>
          </div>
        )}

        {sinStock && (
          <span className="absolute left-3 top-3 bg-saint-black/80 px-3 py-1 text-[10px] uppercase tracking-wide2 text-saint-gray">
            Agotado
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wide2 text-saint-gray">
          {labelCategoria(product.categoria)}
        </p>
        <h3 className="font-serif text-lg transition-colors duration-300 group-hover:text-saint-gray">
          {product.nombre}
        </h3>
        <p className="text-sm text-saint-gray">{formatPrecio(product.precio)}</p>
      </div>
    </Link>
  );
}
