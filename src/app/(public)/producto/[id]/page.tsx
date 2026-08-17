import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import { getProductById, getProductVariantes } from "@/lib/products";

/**
 * SEO dinámico por producto. Si el link llega con talle/color (lo compartió
 * alguien desde el panel), lo nombramos en el título: la previsualización de
 * WhatsApp muestra la combinación concreta que le interesó.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ talle?: string; color?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Producto no encontrado" };

  const { talle, color } = await searchParams;
  const detalle = [
    talle && product.talles.includes(talle) ? `talle ${talle}` : null,
    color && product.colores.includes(color) ? color : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const titulo = detalle ? `${product.nombre} (${detalle})` : product.nombre;

  return {
    title: titulo,
    description:
      product.descripcion?.slice(0, 155) ||
      `${product.nombre} — SAINT. Único a través del bordado personalizado.`,
    openGraph: {
      title: `${titulo} · SAINT`,
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ talle?: string; color?: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) notFound();

  const variantes = await getProductVariantes(id);

  // Talle y color del link compartido. Los validamos contra el producto para
  // no arrancar con una combinación que no existe.
  const { talle, color } = await searchParams;
  const talleInicial = talle && product.talles.includes(talle) ? talle : null;
  const colorInicial = color && product.colores.includes(color) ? color : null;

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
        <ProductPurchasePanel
          product={product}
          variantes={variantes}
          talleInicial={talleInicial}
          colorInicial={colorInicial}
        />
      </div>
    </div>
  );
}
