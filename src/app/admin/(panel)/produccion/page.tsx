import Link from "next/link";
import ProduccionBoard from "@/components/admin/ProduccionBoard";
import { getOrdenesProduccion } from "@/lib/produccion";

/** Producción / Bordados — tablero de órdenes por estado. */
export default async function ProduccionPage() {
  const ordenes = await getOrdenesProduccion();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Producción / Bordados
          </h1>
          <p className="mt-1 text-neutral-500">
            {ordenes.length}{" "}
            {ordenes.length === 1 ? "orden" : "órdenes"} de producción
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/produccion/matrices"
            className="rounded-xl border border-neutral-300 px-5 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Matrices
          </Link>
          <Link
            href="/admin/produccion/nueva"
            className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
          >
            + Nueva orden
          </Link>
        </div>
      </div>

      <ProduccionBoard ordenes={ordenes} />
    </div>
  );
}
