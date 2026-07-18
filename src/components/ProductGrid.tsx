import type { Product } from "@/lib/types";
import ProductCard from "./ProductCard";

/**
 * Grilla responsive de productos. Muestra un mensaje sobrio si está vacía.
 */
export default function ProductGrid({
  products,
  emptyMessage = "Todavía no hay productos para mostrar.",
}: {
  products: Product[];
  emptyMessage?: string;
}) {
  if (!products.length) {
    return (
      <p className="py-24 text-center text-sm uppercase tracking-wide2 text-saint-gray">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
