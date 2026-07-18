import Link from "next/link";
import { getDashboardStats } from "@/lib/gestion";
import { formatPrecio } from "@/lib/constants";

/** TABLERO: resumen del negocio (ventas, compras, ganancia, stock bajo). */
export default async function TableroPage() {
  const stats = await getDashboardStats();

  const tarjetas = [
    {
      label: "Ventas del mes",
      valor: formatPrecio(stats.ventasMesTotal),
      detalle: `${stats.ventasMesCantidad} ventas`,
      color: "text-green-700",
    },
    {
      label: "Ganancia estimada",
      valor: formatPrecio(stats.gananciaMesEstimada),
      detalle: "precio de venta − costo",
      color: "text-emerald-700",
    },
    {
      label: "Compras del mes",
      valor: formatPrecio(stats.comprasMesTotal),
      detalle: "a proveedores",
      color: "text-blue-700",
    },
    {
      label: "Productos activos",
      valor: String(stats.productosActivos),
      detalle: "visibles en la web",
      color: "text-neutral-900",
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Tablero</h1>
        <p className="mt-1 text-neutral-500">
          Un vistazo rápido a tu negocio este mes.
        </p>
      </div>

      {/* Tarjetas de números */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <p className="text-sm text-neutral-500">{t.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${t.color}`}>{t.valor}</p>
            <p className="mt-1 text-xs text-neutral-400">{t.detalle}</p>
          </div>
        ))}
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
            {stats.stockBajo.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-3"
              >
                <Link
                  href={`/admin/editar/${p.id}`}
                  className="font-medium text-neutral-800 hover:underline"
                >
                  {p.nombre}
                </Link>
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
            ))}
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
