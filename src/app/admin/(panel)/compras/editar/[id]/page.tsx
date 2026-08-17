import Link from "next/link";
import { notFound } from "next/navigation";
import CompraForm from "@/components/admin/CompraForm";
import { getAllProductsAdmin } from "@/lib/products";
import { getCompraById, getProveedores } from "@/lib/gestion";

/** Página para editar una compra ya registrada. */
export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [compra, products, proveedores] = await Promise.all([
    getCompraById(id),
    getAllProductsAdmin(),
    getProveedores(),
  ]);

  if (!compra) notFound();

  return (
    <div>
      <Link
        href="/admin/compras"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a compras
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Editar compra
      </h1>
      <CompraForm
        products={products}
        proveedores={proveedores}
        initial={compra}
      />
    </div>
  );
}
