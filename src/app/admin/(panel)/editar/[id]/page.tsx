import Link from "next/link";
import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { getProductById } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

/**
 * Página para EDITAR un producto. Traemos el producto (incluso si está oculto:
 * como el admin está autenticado, RLS permite ver los inactivos).
 */
export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Lectura directa para incluir productos inactivos (getProductById también
  // sirve, pero acá lo hacemos explícito con la sesión del admin).
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const product = (data as Product) ?? (await getProductById(id));
  if (!product) notFound();

  return (
    <div>
      <Link
        href="/admin"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a la lista
      </Link>

      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Editar producto
      </h1>

      <ProductForm initial={product} />
    </div>
  );
}
