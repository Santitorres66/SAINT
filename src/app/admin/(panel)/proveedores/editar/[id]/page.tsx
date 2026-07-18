import Link from "next/link";
import { notFound } from "next/navigation";
import ProveedorForm from "@/components/admin/ProveedorForm";
import { getProveedorById } from "@/lib/gestion";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proveedor = await getProveedorById(id);
  if (!proveedor) notFound();

  return (
    <div>
      <Link
        href="/admin/proveedores"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a proveedores
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Editar proveedor
      </h1>
      <ProveedorForm initial={proveedor} />
    </div>
  );
}
