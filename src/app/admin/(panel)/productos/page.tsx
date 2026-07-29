import Link from "next/link";
import ProductosView from "@/components/admin/ProductosView";
import { getAllProductsAdmin, getAllVariantes } from "@/lib/products";

/** Listado de productos: valorización, filtros, orden y acciones. */
export default async function ProductosPage() {
  const [products, variantes] = await Promise.all([
    getAllProductsAdmin(),
    getAllVariantes(),
  ]);
  const activos = products.filter((p) => p.activo).length;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Tus productos
          </h1>
          <p className="mt-1 text-neutral-500">
            {products.length} en total · {activos} visibles en la web
          </p>
        </div>

        <Link
          href="/admin/nuevo"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Agregar producto
        </Link>
      </div>

      <ProductosView products={products} variantes={variantes} />
    </div>
  );
}
