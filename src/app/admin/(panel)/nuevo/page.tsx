import Link from "next/link";
import ProductForm from "@/components/admin/ProductForm";

/** Página para CREAR un producto nuevo. */
export default function NuevoProductoPage() {
  return (
    <div>
      <Link
        href="/admin"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a la lista
      </Link>

      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Agregar producto
      </h1>

      <ProductForm />
    </div>
  );
}
