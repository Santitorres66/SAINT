import Link from "next/link";
import MatricesList from "@/components/admin/MatricesList";
import { getMatrices } from "@/lib/produccion";

/** Biblioteca de matrices. */
export default async function MatricesPage() {
  const matrices = await getMatrices();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Biblioteca de matrices
          </h1>
          <p className="mt-1 text-neutral-500">
            {matrices.length}{" "}
            {matrices.length === 1 ? "matriz" : "matrices"} · reutilizables en
            las órdenes
          </p>
        </div>
        <Link
          href="/admin/produccion/matrices/nueva"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Nueva matriz
        </Link>
      </div>

      <MatricesList matrices={matrices} />
    </div>
  );
}
