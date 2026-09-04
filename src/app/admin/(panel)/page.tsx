import Link from "next/link";
import AnaliticaVentas from "@/components/admin/AnaliticaVentas";
import {
  getDashboardStats,
  getVentasParaAnalitica,
  getCobrosParaAnalitica,
  getComprasParaAnalitica,
} from "@/lib/gestion";
import { getCategoriaPorProducto } from "@/lib/products";
import { formatPrecio } from "@/lib/constants";

/** TABLERO: analítica de ventas (con filtro de fecha) + stock y capital. */
export default async function TableroPage() {
  const [stats, ventas, cobros, compras, categoriaPorProducto] =
    await Promise.all([
      getDashboardStats(),
      getVentasParaAnalitica(),
      getCobrosParaAnalitica(),
      getComprasParaAnalitica(),
      getCategoriaPorProducto(),
    ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Tablero</h1>
        <p className="mt-1 text-neutral-500">
          Filtrá por período y por cliente, y mirá cómo viene tu negocio.
        </p>
      </div>

      {/* Analítica de ventas (KPIs + gráfico, con filtro de fecha) */}
      <AnaliticaVentas
        ventas={ventas}
        cobros={cobros}
        compras={compras}
        categoriaPorProducto={categoriaPorProducto}
      />

      {/* Cobranza: facturar no es cobrar. Estos números separan lo que
          vendiste de la plata que realmente entró. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Facturado este mes</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatPrecio(stats.ventasMesTotal)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {stats.ventasMesCantidad}{" "}
            {stats.ventasMesCantidad === 1 ? "venta" : "ventas"}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Cobrado este mes</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">
            {formatPrecio(stats.cobradoMesTotal)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            plata que entró, por fecha de cobro
          </p>
        </div>
        <Link
          href="/admin/ventas"
          className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
        >
          <p className="text-sm text-neutral-500">Pendiente de cobro</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">
            {formatPrecio(stats.pendienteCobroTotal)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {stats.pendienteCobroCantidad}{" "}
            {stats.pendienteCobroCantidad === 1 ? "venta" : "ventas"} con saldo
          </p>
        </Link>
      </div>

      {/* Rentabilidad: de lo vendido al resultado, restando costo e insumos */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Rentabilidad de este mes
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Del precio de venta se descuenta el costo de la mercadería y después
          los insumos que compraste.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Margen bruto</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {formatPrecio(stats.margenBrutoMes)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              lo vendido menos el costo de esa mercadería
              {stats.ventasMesTotal > 0 && (
                <>
                  {" · "}
                  {Math.round(
                    (stats.margenBrutoMes / stats.ventasMesTotal) * 100,
                  )}
                  % de lo facturado
                </>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">Insumos del mes</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              −{formatPrecio(stats.comprasMesInsumos)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              hilos, entretelas, bolsas, etiquetas…
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              stats.resultadoMes >= 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <p className="text-sm text-neutral-600">Resultado del mes</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                stats.resultadoMes >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {formatPrecio(stats.resultadoMes)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              margen bruto menos insumos
            </p>
          </div>
        </div>
      </div>

      {/* Compras: separadas por para qué se compró */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Compras</h2>
        <p className="mt-1 text-sm text-neutral-500">
          La maquinaria va aparte: es una inversión, no un gasto del mes en que
          la pagaste.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/compras"
            className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400 hover:shadow-sm"
          >
            <p className="text-sm text-neutral-500">Comprado este mes</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {formatPrecio(stats.comprasMesTotal)}
            </p>
            <dl className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs">
              <Fila
                label="Mercadería para vender"
                valor={stats.comprasMesMercaderia}
              />
              <Fila label="Insumos" valor={stats.comprasMesInsumos} />
              <Fila
                label="Maquinaria y herramientas"
                valor={stats.comprasMesActivos}
              />
            </dl>
          </Link>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-sm text-neutral-500">
              Comprado desde el inicio
            </p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {formatPrecio(stats.comprasHistTotal)}
            </p>
            <dl className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs">
              <Fila
                label="Mercadería para vender"
                valor={stats.comprasHistMercaderia}
              />
              <Fila label="Insumos" valor={stats.comprasHistInsumos} />
              <Fila
                label="Maquinaria y herramientas"
                valor={stats.comprasHistActivos}
              />
            </dl>
          </div>
        </div>
      </div>

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

/** Una línea del desglose de compras. */
function Fila({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd
        className={valor > 0 ? "font-medium text-neutral-800" : "text-neutral-300"}
      >
        {formatPrecio(valor)}
      </dd>
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
