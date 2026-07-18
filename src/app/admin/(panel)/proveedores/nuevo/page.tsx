import Link from "next/link";
import ProveedorForm from "@/components/admin/ProveedorForm";

export default function NuevoProveedorPage() {
  return (
    <div>
      <Link
        href="/admin/proveedores"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a proveedores
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Nuevo proveedor
      </h1>
      <ProveedorForm />
    </div>
  );
}
