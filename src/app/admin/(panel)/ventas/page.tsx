import Link from "next/link";
import VentasList from "@/components/admin/VentasList";
import { getVentasUnificadas } from "@/lib/gestion";
import { getCategoriaPorProducto } from "@/lib/products";
import { formatPrecio } from "@/lib/constants";

/** Listado de ventas: online (Mercado Pago) + manuales, con su cobro. */
export default async function VentasPage({
  searchParams,
}: {
  /** ?cobrar=<id> abre directo el panel de cobros de esa venta. */
  searchParams: Promise<{ cobrar?: string }>;
}) {
  const [ventas, categoriaPorProducto, { cobrar }] = await Promise.all([
    getVentasUnificadas(),
    getCategoriaPorProducto(),
    searchParams,
  ]);

  const total = ventas.reduce((a, v) => a + Number(v.total), 0);
  const cobrado = ventas.reduce((a, v) => a + Number(v.total_cobrado), 0);
  const pendiente = ventas.reduce((a, v) => a + Number(v.saldo), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Ventas</h1>
          <p className="mt-1 text-neutral-500">
            {ventas.length} {ventas.length === 1 ? "venta" : "ventas"} ·{" "}
            {formatPrecio(total)} facturado
          </p>
        </div>
        <Link
          href="/admin/ventas/nueva"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Nueva venta manual
        </Link>
      </div>

      {/* Facturado ≠ cobrado: lo primero es lo que vendiste, lo segundo la
          plata que realmente entró. */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Resumen titulo="Facturado" valor={total} />
        <Resumen titulo="Cobrado" valor={cobrado} tono="verde" />
        <Resumen titulo="Pendiente de cobro" valor={pendiente} tono="ambar" />
      </div>

      <VentasList
        ventas={ventas}
        abrirCobroId={cobrar}
        categoriaPorProducto={categoriaPorProducto}
      />
    </div>
  );
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: number;
  tono?: "verde" | "ambar";
}) {
  const color =
    tono === "verde"
      ? "text-emerald-700"
      : tono === "ambar"
        ? "text-amber-700"
        : "text-neutral-900";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>
        {formatPrecio(valor)}
      </p>
    </div>
  );
}
