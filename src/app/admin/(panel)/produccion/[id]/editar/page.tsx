import Link from "next/link";
import { notFound } from "next/navigation";
import OrdenProduccionForm from "@/components/admin/OrdenProduccionForm";
import { getAllProductsAdmin, getAllVariantes } from "@/lib/products";
import { getMatricesSimple, getOrdenProduccionById } from "@/lib/produccion";
import { getClientes } from "@/lib/clientes";
import { formatNumeroOrden } from "@/lib/constants";

/** Edición de una orden de producción existente. */
export default async function EditarOrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [orden, products, matrices, clientes, variantes] = await Promise.all([
    getOrdenProduccionById(id),
    getAllProductsAdmin(),
    getMatricesSimple(),
    getClientes(),
    getAllVariantes(),
  ]);
  if (!orden) notFound();

  return (
    <div>
      <Link
        href={`/admin/produccion/${id}`}
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver al detalle
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Editar orden {formatNumeroOrden(orden.numero)}
      </h1>
      <OrdenProduccionForm
        products={products}
        matrices={matrices}
        clientes={clientes}
        variantes={variantes}
        orden={orden}
      />
    </div>
  );
}
