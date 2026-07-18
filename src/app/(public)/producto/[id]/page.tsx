import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import { getProductById } from "@/lib/products";

/** SEO dinámico por producto. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Producto no encontrado" };

  return {
    title: product.nombre,
    description:
      product.descripcion?.slice(0, 155) ||
      `${product.nombre} — SAINT. Único a través del bordado personalizado.`,
    openGraph: {
      title: `${product.nombre} · SAINT`,
      description: product.descripcion?.slice(0, 155),
      images: product.imagenes?.[0] ? [product.imagenes[0]] : [],
    },
  };
}

/**
 * DETALLE DE PRODUCTO — galería + panel de compra (talle, color, bordado,
 * botón agregar al carrito). El detalle de compra vive en un client component.
 */
export default async function ProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Volver */}
      <Link
        href="/tienda"
        className="mb-10 inline-block text-xs uppercase tracking-wide2 text-saint-gray transition-colors duration-300 hover:text-saint-white"
      >
        ← Volver a la tienda
      </Link>

      <div className="grid gap-12 lg:grid-cols-2">
        <Gallery imagenes={product.imagenes} nombre={product.nombre} />
        <ProductPurchasePanel product={product} />
      </div>
    </div>
  );
}
