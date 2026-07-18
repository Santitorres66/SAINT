import Link from "next/link";
import { getAllOrders } from "@/lib/orders";
import { formatPrecio } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";

/** Etiqueta y color de cada estado de orden. */
const ESTADOS: Record<string, { label: string; clase: string }> = {
  approved: { label: "Pagada", clase: "bg-green-100 text-green-800" },
  pending: { label: "Pendiente", clase: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rechazada", clase: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelada", clase: "bg-neutral-100 text-neutral-500" },
};

function estadoInfo(status: OrderStatus | string) {
  return ESTADOS[status] ?? { label: status, clase: "bg-neutral-100 text-neutral-600" };
}

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Vista de órdenes del panel admin. */
export default async function OrdenesPage() {
  const orders = await getAllOrders();
  const pagadas = orders.filter((o) => o.status === "approved").length;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Órdenes</h1>
          <p className="mt-1 text-neutral-500">
            {orders.length} en total · {pagadas} pagadas
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          ← Productos
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
          <p className="text-lg font-medium text-neutral-700">
            Todavía no hay órdenes.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Cuando alguien compre, la venta aparece acá automáticamente.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const info = estadoInfo(o.status);
            return (
              <li
                key={o.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-neutral-400">
                      #{o.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {formatFecha(o.created_at)}
                    </p>
                    {o.comprador?.email && (
                      <p className="mt-1 text-sm text-neutral-600">
                        {o.comprador.nombre
                          ? `${o.comprador.nombre} · `
                          : ""}
                        {o.comprador.email}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${info.clase}`}
                    >
                      {info.label}
                    </span>
                    <p className="mt-2 text-lg font-semibold text-neutral-900">
                      {formatPrecio(o.total)}
                    </p>
                  </div>
                </div>

                {/* Detalle de ítems */}
                <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
                  {o.items.map((it, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span>
                        {it.cantidad}× {it.nombre}
                        {[it.talle, it.color].filter(Boolean).length > 0 && (
                          <span className="text-neutral-400">
                            {" "}
                            ({[it.talle, it.color].filter(Boolean).join(" · ")})
                          </span>
                        )}
                      </span>
                      <span>{formatPrecio(it.precio_unitario * it.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
