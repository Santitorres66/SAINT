import Link from "next/link";
import VentaManualForm from "@/components/admin/VentaManualForm";
import { getAllProductsAdmin } from "@/lib/products";

/** Página para registrar una venta manual. */
export default async function NuevaVentaPage() {
  const products = await getAllProductsAdmin();

  return (
    <div>
      <Link
        href="/admin/ventas"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a ventas
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Nueva venta manual
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
        <VentaManualForm products={products} />
      )}
    </div>
  );
}
