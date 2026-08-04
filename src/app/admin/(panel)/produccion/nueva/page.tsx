import Link from "next/link";
import OrdenProduccionForm from "@/components/admin/OrdenProduccionForm";
import { getAllProductsAdmin, getAllVariantes } from "@/lib/products";
import { getMatricesSimple } from "@/lib/produccion";
import { getClientes } from "@/lib/clientes";

/** Alta de una orden de producción. */
export default async function NuevaOrdenPage() {
  const [products, matrices, clientes, variantes] = await Promise.all([
    getAllProductsAdmin(),
    getMatricesSimple(),
    getClientes(),
    getAllVariantes(),
  ]);

  return (
    <div>
      <Link
        href="/admin/produccion"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a producción
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Nueva orden de producción
      </h1>
      <OrdenProduccionForm
        products={products}
        matrices={matrices}
        clientes={clientes}
        variantes={variantes}
      />
    </div>
  );
}
