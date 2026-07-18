import Link from "next/link";
import ComprasList from "@/components/admin/ComprasList";
import { getCompras } from "@/lib/gestion";

/** Listado de compras a proveedores. */
export default async function ComprasPage() {
  const compras = await getCompras();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Compras</h1>
          <p className="mt-1 text-neutral-500">
            {compras.length}{" "}
            {compras.length === 1 ? "compra registrada" : "compras registradas"}
          </p>
        </div>
        <Link
          href="/admin/compras/nueva"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Nueva compra
        </Link>
      </div>

      <ComprasList compras={compras} />
    </div>
  );
}
