import Link from "next/link";
import { notFound } from "next/navigation";
import VentaManualForm from "@/components/admin/VentaManualForm";
import { getAllProductsAdmin } from "@/lib/products";
import { getVentaManualById } from "@/lib/gestion";

/** Página para editar una venta manual. */
export default async function EditarVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venta, products] = await Promise.all([
    getVentaManualById(id),
    getAllProductsAdmin(),
  ]);

  if (!venta) notFound();

  return (
    <div>
      <Link
        href="/admin/ventas"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a ventas
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Editar venta
      </h1>
      <VentaManualForm products={products} initial={venta} />
    </div>
  );
}
