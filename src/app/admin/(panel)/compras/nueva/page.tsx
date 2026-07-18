import Link from "next/link";
import CompraForm from "@/components/admin/CompraForm";
import { getAllProductsAdmin } from "@/lib/products";
import { getProveedores } from "@/lib/gestion";

/** Página para cargar una compra nueva. */
export default async function NuevaCompraPage() {
  const [products, proveedores] = await Promise.all([
    getAllProductsAdmin(),
    getProveedores(),
  ]);

  return (
    <div>
      <Link
        href="/admin/compras"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a compras
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Nueva compra
      </h1>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <p className="text-neutral-700">
            Primero necesitás tener productos cargados.
          </p>
          <Link
            href="/admin/nuevo"
            className="mt-3 inline-block font-medium text-neutral-900 underline"
          >
            Crear un producto
          </Link>
        </div>
      ) : (
        <CompraForm products={products} proveedores={proveedores} />
      )}
    </div>
  );
}
