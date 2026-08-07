import Link from "next/link";
import AnaliticaVentas from "@/components/admin/AnaliticaVentas";
import { getDashboardStats, getVentasParaAnalitica } from "@/lib/gestion";
import { formatPrecio } from "@/lib/constants";

/** TABLERO: analítica de ventas (con filtro de fecha) + stock y capital. */
export default async function TableroPage() {
  const [stats, ventas] = await Promise.all([
    getDashboardStats(),
    getVentasParaAnalitica(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Tablero</h1>
        <p className="mt-1 text-neutral-500">
          Filtrá por período y mirá cómo viene tu negocio.
        </p>
      </div>

      {/* Analítica de ventas (KPIs + gráfico, con filtro de fecha) */}
      <AnaliticaVentas ventas={ventas} />

      {/* Stock valorizado (capital) */}
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-900 to-neutral-700 p-6 text-white">
        <p className="text-sm text-white/70">
          Stock valorizado · capital en mercadería
        </p>
        <p className="mt-2 text-3xl font-semibold">
          {formatPrecio(stats.stockValorizadoCosto)}
        </p>
        <p className="mt-1 text-sm text-white/60">
          a precio de costo · {stats.unidadesEnStock} unidades en stock ·{" "}
          {stats.productosActivos} productos activos
        </p>
        <p className="mt-3 border-t border-white/15 pt-3 text-sm text-white/80">
          Valor a precio de venta:{" "}
          <strong>{formatPrecio(stats.stockValorizadoVenta)}</strong>
        </p>
      </div>

      {/* Accesos rápidos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/admin/ventas/nueva"
          titulo="Registrar una venta"
          desc="Cargá una venta manual (efectivo, transferencia…)"
        />
        <QuickLink
          href="/admin/compras/nueva"
          titulo="Cargar una compra"
          desc="Sumá stock comprándole a un proveedor"
        />
        <QuickLink
          href="/admin/nuevo"
          titulo="Agregar producto"
          desc="Creá una prenda nueva para tu tienda"
        />
      </div>

      {/* Stock bajo */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          Productos con poco stock
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Prendas activas con 3 unidades o menos. Puede ser hora de reponer.
        </p>

        {stats.stockBajo.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-400">
            Todo en orden — no hay productos con stock bajo. 👌
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {stats.stockBajo.map((p) => {
              const detalle = [p.color, p.talle && `Talle ${p.talle}`]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={`${p.id}-${p.talle}-${p.color}`}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <Link
                      href={`/admin/editar/${p.id}`}
                      className="font-medium text-neutral-800 hover:underline"
                    >
                      {p.nombre}
                    </Link>
                    {detalle && (
                      <p className="text-xs text-neutral-400">{detalle}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      p.stock === 0
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {p.stock === 0 ? "Sin stock" : `${p.stock} u.`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  titulo,
  desc,
}: {
  href: string;
  titulo: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
    >
      <p className="font-semibold text-neutral-900">{titulo}</p>
      <p className="mt-1 text-sm text-neutral-500">{desc}</p>
    </Link>
  );
}
