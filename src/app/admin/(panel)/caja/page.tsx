import Link from "next/link";
import { getCaja } from "@/lib/caja-datos";
import { formatPrecio } from "@/lib/constants";
import { LABEL_CUENTA, formatDia, diaDe, hoyAR } from "@/lib/caja";
import {
  ControlBrubank,
  NuevoMovimiento,
  BorrarMovimiento,
  GraficoSaldo,
} from "@/components/admin/CajaPanel";

const PERIODOS = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
  { value: "todo", label: "Todo" },
];

const ORIGEN_CHIP: Record<string, string> = {
  cobro: "bg-emerald-50 text-emerald-700",
  pago_compra: "bg-neutral-100 text-neutral-600",
  manual: "bg-violet-50 text-violet-700",
};

/**
 * Caja: cuánta plata hay (Brubank + efectivo), cómo cambió día a día
 * (cobrado − pagado) y el control contra el saldo real de Brubank.
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: p } = await searchParams;
  const periodo = PERIODOS.some((x) => x.value === p) ? p! : "30";
  const caja = await getCaja();

  if (!caja.lista) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Caja</h1>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          Falta correr <code>supabase/caja-socios.sql</code> en Supabase → SQL
          Editor. Después de eso esta pantalla muestra la caja.
        </div>
      </div>
    );
  }

  const hoy = hoyAR();
  const desde =
    periodo === "todo"
      ? ""
      : new Date(Date.parse(`${hoy}T00:00:00Z`) - (Number(periodo) - 1) * 86_400_000)
          .toISOString()
          .slice(0, 10);
  const dias = caja.dias.filter((d) => d.dia >= desde);
  const movimientos = caja.movimientos.filter((m) => m.dia >= desde);
  const cobrado = dias.reduce((a, d) => a + d.cobrado, 0);
  const pagado = dias.reduce((a, d) => a + d.pagado, 0);
  const otros = dias.reduce((a, d) => a + d.otros, 0);
  const deudaCompras = caja.porPagar.reduce((a, c) => a + c.saldo, 0);
  const ultimoControl = caja.controles[0];

  const tarjeta = "rounded-2xl border border-neutral-200 bg-white p-5";
  const titulo =
    "mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Caja</h1>
          <p className="mt-1 text-neutral-500">
            Lo cobrado menos lo pagado. Comparalo siempre con Brubank.
          </p>
        </div>
        <nav className="flex gap-1 rounded-xl bg-neutral-100 p-1 text-sm">
          {PERIODOS.map((x) => (
            <Link
              key={x.value}
              href={`/admin/caja?periodo=${x.value}`}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                periodo === x.value
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Disponible */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-900 bg-neutral-900 p-5 text-white">
          <p className="text-sm text-white/70">Disponible</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatPrecio(caja.saldo.total)}
          </p>
          <p className="mt-1 text-xs text-white/60">Brubank + efectivo</p>
        </div>
        <div className={tarjeta}>
          <p className="text-sm text-neutral-500">En Brubank (sistema)</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatPrecio(caja.saldo.brubank)}
          </p>
          {ultimoControl && (
            <p className="mt-1 text-xs text-neutral-400">
              Último control {formatDia(diaDe(ultimoControl.fecha))}:{" "}
              {formatPrecio(ultimoControl.saldo_real)}
            </p>
          )}
        </div>
        <div className={tarjeta}>
          <p className="text-sm text-neutral-500">En efectivo</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatPrecio(caja.saldo.efectivo)}
          </p>
        </div>
        <div className={tarjeta}>
          <p className="text-sm text-neutral-500">
            Neto del período
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              cobrado - pagado + otros >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatPrecio(cobrado - pagado + otros)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            cobrado {formatPrecio(cobrado)} · pagado {formatPrecio(pagado)}
            {otros !== 0 && ` · otros ${formatPrecio(otros)}`}
          </p>
        </div>
      </div>

      {/* Evolución */}
      <section className={`${tarjeta} mb-8`}>
        <h2 className={titulo}>Saldo de caja día a día</h2>
        <GraficoSaldo dias={dias} />
      </section>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        {/* Control contra Brubank */}
        <section className={tarjeta}>
          <h2 className={titulo}>Control con Brubank</h2>
          <p className="mb-4 text-sm text-neutral-500">
            Según el sistema, en Brubank tiene que haber{" "}
            <strong className="text-neutral-900">
              {formatPrecio(caja.saldo.brubank)}
            </strong>
            .
          </p>
          <ControlBrubank saldoSistema={caja.saldo.brubank} />
          {caja.controles.length > 0 && (
            <ul className="mt-5 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
              {caja.controles.map((c) => {
                const dif = c.saldo_real - c.saldo_sistema;
                return (
                  <li key={c.id} className="flex justify-between gap-3 py-2">
                    <span className="text-neutral-600">
                      {formatDia(diaDe(c.fecha), true)} · banco{" "}
                      {formatPrecio(c.saldo_real)}
                      {c.notas && (
                        <span className="block text-xs text-neutral-400">
                          {c.notas}
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        Math.abs(dif) < 1
                          ? "text-emerald-700"
                          : "font-medium text-amber-700"
                      }
                    >
                      {Math.abs(dif) < 1 ? "✓ cuadraba" : formatPrecio(dif)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Movimiento manual */}
        <section className={tarjeta}>
          <h2 className={titulo}>Cargar movimiento</h2>
          <p className="mb-4 text-sm text-neutral-500">
            Los cobros y los pagos de compras entran solos. Acá va lo demás:
            aportes y devoluciones a socios, gastos, depósitos de efectivo.
          </p>
          <NuevoMovimiento socios={caja.socios} />
        </section>
      </div>

      <div className="mb-8 grid gap-8 lg:grid-cols-2">
        {/* Socios */}
        <section className={tarjeta}>
          <h2 className={titulo}>Socios</h2>
          <ul className="space-y-4 text-sm">
            {caja.socios.map((s) => (
              <li key={s.id} className="rounded-xl bg-neutral-50 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-neutral-900">
                    {s.nombre}
                  </span>
                  <span className="text-xs text-neutral-400">DNI {s.dni}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-neutral-600">
                  <span>Puso en compras</span>
                  <span className="text-right">{formatPrecio(s.enCompras)}</span>
                  <span>Aportes a caja</span>
                  <span className="text-right">{formatPrecio(s.aportes)}</span>
                  <span>Se le devolvió</span>
                  <span className="text-right">{formatPrecio(s.devuelto)}</span>
                  {s.retirado > 0 && (
                    <>
                      <span>Retiros de ganancia</span>
                      <span className="text-right">
                        {formatPrecio(s.retirado)}
                      </span>
                    </>
                  )}
                  <span className="font-medium text-neutral-900">
                    SAINT le debe
                  </span>
                  <span className="text-right font-semibold text-neutral-900">
                    {formatPrecio(s.aFavor)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Lo que falta pagar */}
        <section className={tarjeta}>
          <h2 className={titulo}>Compras por pagar</h2>
          {caja.porPagar.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No hay compras con saldo pendiente.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-neutral-500">
                Total que se debe a proveedores:{" "}
                <strong className="text-amber-700">
                  {formatPrecio(deudaCompras)}
                </strong>
              </p>
              <ul className="divide-y divide-neutral-100 text-sm">
                {caja.porPagar.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 py-2">
                    <span className="text-neutral-700">
                      {c.descripcion || c.proveedor}
                      <span className="block text-xs text-neutral-400">
                        {c.proveedor} · {formatDia(diaDe(c.fecha), true)}
                        {c.cuotas > 1 &&
                          ` · cuota ${c.cuotasPagadas}/${c.cuotas} de ${formatPrecio(c.montoCuota)}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-amber-700">
                      {formatPrecio(c.saldo)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/compras"
                className="mt-3 inline-block text-xs font-medium text-neutral-600 hover:underline"
              >
                Registrar pagos desde Compras →
              </Link>
            </>
          )}
        </section>
      </div>

      {/* Día por día */}
      <section className={`${tarjeta} mb-8`}>
        <h2 className={titulo}>Día por día</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2 font-medium">Día</th>
                <th className="py-2 text-right font-medium">Cobrado</th>
                <th className="py-2 text-right font-medium">Pagado</th>
                <th className="py-2 text-right font-medium">Otros</th>
                <th className="py-2 text-right font-medium">Neto</th>
                <th className="py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[...dias]
                .reverse()
                .filter((d) => d.cobrado || d.pagado || d.otros)
                .map((d) => (
                  <tr key={d.dia}>
                    <td className="py-2 text-neutral-700">
                      {formatDia(d.dia, true)}
                    </td>
                    <td className="py-2 text-right text-emerald-700">
                      {d.cobrado ? formatPrecio(d.cobrado) : "—"}
                    </td>
                    <td className="py-2 text-right text-neutral-700">
                      {d.pagado ? formatPrecio(-d.pagado) : "—"}
                    </td>
                    <td className="py-2 text-right text-violet-700">
                      {d.otros ? formatPrecio(d.otros) : "—"}
                    </td>
                    <td
                      className={`py-2 text-right font-medium ${
                        d.neto >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {formatPrecio(d.neto)}
                    </td>
                    <td className="py-2 text-right font-medium text-neutral-900">
                      {formatPrecio(d.saldo)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Movimientos */}
      <section className={tarjeta}>
        <h2 className={titulo}>Movimientos ({movimientos.length})</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No hubo movimientos en este período.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {movimientos.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
              >
                <span className="text-neutral-700">
                  <span className="text-neutral-400">
                    {formatDia(m.dia)} ·{" "}
                  </span>
                  <span
                    className={`mr-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${ORIGEN_CHIP[m.origen]}`}
                  >
                    {m.concepto}
                  </span>
                  {m.detalle}
                  <span className="ml-1.5 text-xs text-neutral-400">
                    {LABEL_CUENTA[m.cuenta]}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`font-medium ${
                      m.monto >= 0 ? "text-emerald-700" : "text-neutral-900"
                    }`}
                  >
                    {m.monto >= 0 ? "+" : ""}
                    {formatPrecio(m.monto)}
                  </span>
                  {m.manualId && <BorrarMovimiento id={m.manualId} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
