import Link from "next/link";
import VentasList from "@/components/admin/VentasList";
import { getVentasUnificadas } from "@/lib/gestion";
import { formatPrecio } from "@/lib/constants";

/** Listado de ventas: online (Mercado Pago) + manuales. */
export default async function VentasPage() {
  const ventas = await getVentasUnificadas();
  const total = ventas.reduce((a, v) => a + Number(v.total), 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Ventas</h1>
          <p className="mt-1 text-neutral-500">
            {ventas.length} {ventas.length === 1 ? "venta" : "ventas"} ·{" "}
            {formatPrecio(total)} en total
          </p>
        </div>
        <Link
          href="/admin/ventas/nueva"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Nueva venta manual
        </Link>
      </div>

      <VentasList ventas={ventas} />
    </div>
  );
}
