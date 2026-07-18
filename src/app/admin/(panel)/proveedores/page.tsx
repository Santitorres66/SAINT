import Link from "next/link";
import ProveedoresList from "@/components/admin/ProveedoresList";
import { getProveedores } from "@/lib/gestion";

/** Listado de proveedores. */
export default async function ProveedoresPage() {
  const proveedores = await getProveedores();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Proveedores
          </h1>
          <p className="mt-1 text-neutral-500">
            {proveedores.length}{" "}
            {proveedores.length === 1 ? "proveedor" : "proveedores"}
          </p>
        </div>
        <Link
          href="/admin/proveedores/nuevo"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Nuevo proveedor
        </Link>
      </div>

      <ProveedoresList proveedores={proveedores} />
    </div>
  );
}
