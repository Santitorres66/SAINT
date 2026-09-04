"use client";

import { useMemo, useState } from "react";
import type { OrderItem } from "@/lib/types";
import {
  formatPrecio,
  labelCategoria,
  categoriaDeItem,
} from "@/lib/constants";

type Venta = {
  fecha: string;
  total: number;
  cliente: string;
  canal: "online" | "manual";
  items: OrderItem[];
};
/** Un cobro: la plata que entró, con la fecha en que entró. */
type Cobro = { fecha: string; monto: number; cliente: string };
/** Una compra ya desglosada por tipo de ítem. */
type Compra = {
  fecha: string;
  mercaderia: number;
  insumos: number;
  activos: number;
};
type Preset = "mes" | "anio" | "12m" | "todo" | "custom";

/** Cuando no se eligió cliente, el filtro vale para todos. */
const TODOS = "__todos__";

// Colores por canal (validados para distinguirse incluso con daltonismo).
const COLOR_ONLINE = "#2a78d6"; // Tienda web
const COLOR_MANUAL = "#eb6834"; // Manual

/* Colores de los gráficos por mes. Elegidos con el validador de contraste y
   daltonismo, no a ojo: el verde azulado que parecía natural para "cobrado"
   resultaba indistinguible del verde de facturación (ΔE 13.7, debajo del piso
   de 15 incluso con visión normal). */
const COLOR_FACTURADO = "#059669"; // verde, el que ya usaba el tablero
const COLOR_COBRADO = "#2a78d6"; // azul · ΔE 21.2 contra el verde
const COLOR_MERCADERIA = "#eb6834";
const COLOR_INSUMOS = "#7b5ea7";
const COLOR_ACTIVOS = "#4d7c0f";

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Formato compacto para el eje ($ 1,2 mill / $ 350 mil). */
function compacto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** Los últimos 12 meses, del más viejo al más nuevo, con los montos en cero. */
function ultimos12(hoy: Date): { y: number; m: number; v: number[] }[] {
  const arr = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    arr.push({ y: d.getFullYear(), m: d.getMonth(), v: [] as number[] });
  }
  return arr;
}

/** El mes de la serie donde cae una fecha, o undefined si quedó fuera. */
function mesDe<T extends { y: number; m: number }>(serie: T[], fecha: string) {
  const d = new Date(fecha);
  return serie.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
}

export default function AnaliticaVentas({
  ventas,
  cobros = [],
  compras = [],
  categoriaPorProducto = {},
}: {
  ventas: Venta[];
  /** Plata que entró, por fecha de cobro. */
  cobros?: Cobro[];
  /** Compras a proveedores, desglosadas por tipo. */
  compras?: Compra[];
  /** `product_id → categoría`, para desglosar qué se vendió. */
  categoriaPorProducto?: Record<string, string>;
}) {
  const [preset, setPreset] = useState<Preset>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cliente, setCliente] = useState<string>(TODOS);

  const hoy = useMemo(() => new Date(), []);

  const [ini, fin] = useMemo<[Date, Date]>(() => {
    const f = new Date(hoy);
    f.setHours(23, 59, 59, 999);
    if (preset === "mes")
      return [new Date(hoy.getFullYear(), hoy.getMonth(), 1), f];
    if (preset === "anio") return [new Date(hoy.getFullYear(), 0, 1), f];
    if (preset === "12m")
      return [new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1), f];
    if (preset === "todo") return [new Date(2000, 0, 1), f];
    return [
      desde ? new Date(desde + "T00:00:00") : new Date(2000, 0, 1),
      hasta ? new Date(hasta + "T23:59:59") : f,
    ];
  }, [preset, desde, hasta, hoy]);

  /* Los clientes que alguna vez compraron, para el selector. Sale de las
     ventas y no de la tabla de clientes: interesa quien tiene movimiento. */
  const clientes = useMemo(() => {
    const set = new Set<string>();
    for (const v of ventas) {
      const c = (v.cliente ?? "").trim();
      if (c && c !== "—") set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [ventas]);

  const hayCliente = cliente !== TODOS;

  // Todo lo que sigue mira estas dos listas, ya filtradas por cliente.
  const ventasCli = useMemo(
    () => (hayCliente ? ventas.filter((v) => v.cliente === cliente) : ventas),
    [ventas, cliente, hayCliente],
  );
  const cobrosCli = useMemo(
    () => (hayCliente ? cobros.filter((c) => c.cliente === cliente) : cobros),
    [cobros, cliente, hayCliente],
  );

  const enRango = useMemo(
    () =>
      ventasCli.filter((v) => {
        const d = new Date(v.fecha);
        return d >= ini && d <= fin;
      }),
    [ventasCli, ini, fin],
  );

  // KPIs del período
  const kpi = useMemo(() => {
    const facturado = enRango.reduce((a, v) => a + v.total, 0);
    const cant = enRango.length;
    const clientesDistintos = new Set(
      enRango.map((v) => v.cliente).filter((c) => c && c !== "—"),
    ).size;
    return {
      facturado,
      cant,
      promedio: cant ? facturado / cant : 0,
      clientes: clientesDistintos,
    };
  }, [enRango]);

  /* Qué se vendió en el período, por rubro: unidades y monto.
     El monto es el de los ítems de cada rubro, no el de la venta entera. */
  const porRubro = useMemo(() => {
    const acc = new Map<string, { unidades: number; monto: number }>();
    let unidadesTotal = 0;
    let montoTotal = 0;

    for (const v of enRango) {
      for (const it of v.items ?? []) {
        const cat = categoriaDeItem(it, categoriaPorProducto);
        const unidades = Number(it.cantidad) || 0;
        const monto = unidades * (Number(it.precio_unitario) || 0);
        const prev = acc.get(cat) ?? { unidades: 0, monto: 0 };
        acc.set(cat, {
          unidades: prev.unidades + unidades,
          monto: prev.monto + monto,
        });
        unidadesTotal += unidades;
        montoTotal += monto;
      }
    }

    return {
      filas: [...acc.entries()]
        .map(([categoria, v]) => ({ categoria, ...v }))
        .sort((a, b) => b.monto - a.monto),
      unidadesTotal,
      montoTotal,
    };
  }, [enRango, categoriaPorProducto]);

  // Desglose por canal del período (para el gráfico de torta)
  const porCanal = useMemo(() => {
    const online = enRango.filter((v) => v.canal === "online");
    const manual = enRango.filter((v) => v.canal === "manual");
    const totalOnline = online.reduce((a, v) => a + v.total, 0);
    const totalManual = manual.reduce((a, v) => a + v.total, 0);
    const total = totalOnline + totalManual;
    return [
      {
        canal: "online" as const,
        label: "Tienda web",
        color: COLOR_ONLINE,
        total: totalOnline,
        cant: online.length,
        pct: total ? (totalOnline / total) * 100 : 0,
      },
      {
        canal: "manual" as const,
        label: "Manual",
        color: COLOR_MANUAL,
        total: totalManual,
        cant: manual.length,
        pct: total ? (totalManual / total) * 100 : 0,
      },
    ];
  }, [enRango]);

  /* --- Las tres series por mes (siempre los últimos 12 meses) --- */

  const mesesFacturado = useMemo(() => {
    const arr = ultimos12(hoy);
    arr.forEach((x) => (x.v = [0]));
    ventasCli.forEach((v) => {
      const b = mesDe(arr, v.fecha);
      if (b) b.v[0] += v.total;
    });
    return arr;
  }, [ventasCli, hoy]);

  const mesesCobrado = useMemo(() => {
    const arr = ultimos12(hoy);
    arr.forEach((x) => (x.v = [0]));
    cobrosCli.forEach((c) => {
      const b = mesDe(arr, c.fecha);
      if (b) b.v[0] += c.monto;
    });
    return arr;
  }, [cobrosCli, hoy]);

  const mesesGasto = useMemo(() => {
    const arr = ultimos12(hoy);
    arr.forEach((x) => (x.v = [0, 0, 0]));
    compras.forEach((c) => {
      const b = mesDe(arr, c.fecha);
      if (b) {
        b.v[0] += c.mercaderia;
        b.v[1] += c.insumos;
        b.v[2] += c.activos;
      }
    });
    return arr;
  }, [compras, hoy]);

  /* Facturado y cobrado comparten la escala vertical. Si cada uno se escalara
     a su propio máximo, un mes en que cobraste el 30% se vería igual de alto
     que uno en que cobraste todo, que es justo lo contrario de lo que hay que
     ver. Los gastos van aparte: miden otra cosa. */
  const maxDinero = Math.max(
    1,
    ...mesesFacturado.map((m) => m.v[0]),
    ...mesesCobrado.map((m) => m.v[0]),
  );
  const maxGasto = Math.max(
    1,
    ...mesesGasto.map((m) => m.v.reduce((a, n) => a + n, 0)),
  );

  const totalFacturado12 = mesesFacturado.reduce((a, m) => a + m.v[0], 0);
  const totalCobrado12 = mesesCobrado.reduce((a, m) => a + m.v[0], 0);
  const totalGasto12 = mesesGasto.reduce(
    (a, m) => a + m.v.reduce((b, n) => b + n, 0),
    0,
  );

  const presets: { k: Preset; label: string }[] = [
    { k: "mes", label: "Este mes" },
    { k: "anio", label: "Este año" },
    { k: "12m", label: "Últimos 12 meses" },
    { k: "todo", label: "Todo" },
    { k: "custom", label: "Personalizado" },
  ];

  const tiles = [
    { label: "Facturado", valor: formatPrecio(kpi.facturado), color: "text-green-700" },
    { label: "Cant. de ventas", valor: String(kpi.cant), color: "text-neutral-900" },
    { label: "Venta promedio", valor: formatPrecio(kpi.promedio), color: "text-neutral-900" },
    { label: "Cant. de clientes", valor: String(kpi.clientes), color: "text-neutral-900" },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros: período y cliente */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.k}
              onClick={() => setPreset(p.k)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                preset === p.k
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {p.label}
            </button>
          ))}

          <label className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
            Cliente
            <select
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="max-w-[16rem] rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-900"
            >
              <option value={TODOS}>Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-neutral-500">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <label className="text-sm text-neutral-500">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {hayCliente && (
          <p className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-600">
            Mostrando solo <strong className="text-neutral-900">{cliente}</strong>
            . Las ventas, los cobros y el detalle por rubro quedan filtrados;{" "}
            <em>Gastos por mes</em> no, porque son compras a proveedores y no
            dependen del cliente.{" "}
            <button
              onClick={() => setCliente(TODOS)}
              className="font-medium text-neutral-900 underline underline-offset-2"
            >
              Ver todos
            </button>
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <p className="text-sm text-neutral-500">{t.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${t.color}`}>{t.valor}</p>
          </div>
        ))}
      </div>

      {/* Facturado por mes */}
      <GraficoMeses
        titulo="Facturación por mes"
        meses={mesesFacturado}
        max={maxDinero}
        series={[{ label: "Facturado", color: COLOR_FACTURADO }]}
        pie={`Máximo: ${compacto(maxDinero)} · total 12 meses: ${formatPrecio(
          totalFacturado12,
        )}`}
      />

      {/* Cobrado por mes — misma escala que facturación, a propósito */}
      <GraficoMeses
        titulo="Cobrado por mes"
        subtitulo="Plata que entró, por fecha de cobro. Una venta de marzo que se termina de pagar en mayo suma en mayo."
        meses={mesesCobrado}
        max={maxDinero}
        series={[{ label: "Cobrado", color: COLOR_COBRADO }]}
        pie={
          totalFacturado12 > 0
            ? `Total 12 meses: ${formatPrecio(
                totalCobrado12,
              )} · ${Math.round(
                (totalCobrado12 / totalFacturado12) * 100,
              )}% de lo facturado · misma escala que el gráfico de arriba`
            : `Total 12 meses: ${formatPrecio(totalCobrado12)}`
        }
      />

      {/* Gastos por mes */}
      <GraficoMeses
        titulo="Gastos por mes"
        subtitulo="Compras a proveedores, según en qué se gastó."
        meses={mesesGasto}
        max={maxGasto}
        series={[
          { label: "Mercadería", color: COLOR_MERCADERIA },
          { label: "Insumos", color: COLOR_INSUMOS },
          { label: "Maquinaria", color: COLOR_ACTIVOS },
        ]}
        pie={`Máximo: ${compacto(maxGasto)} · total 12 meses: ${formatPrecio(
          totalGasto12,
        )}`}
      />

      {/* Qué se vendió, por rubro. Mismo período que los KPIs. */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Qué se vendió
          </h2>
          <p className="text-xs text-neutral-400">
            {porRubro.unidadesTotal} u. · {formatPrecio(porRubro.montoTotal)}
          </p>
        </div>
        <p className="mb-4 text-xs text-neutral-400">
          Unidades y monto por rubro. El monto es el de las prendas de cada
          rubro, no el de la venta completa.
        </p>

        {porRubro.filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">
            No hay ventas en el período elegido.
          </p>
        ) : (
          <ul className="space-y-3">
            {porRubro.filas.map((f) => {
              const pct = porRubro.montoTotal
                ? (f.monto / porRubro.montoTotal) * 100
                : 0;
              return (
                <li key={f.categoria}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-neutral-800">
                      {labelCategoria(f.categoria)}
                    </span>
                    <span className="text-neutral-500">
                      <strong className="text-neutral-900">
                        {f.unidades} u.
                      </strong>{" "}
                      · {formatPrecio(f.monto)}{" "}
                      <span className="text-neutral-400">
                        ({Math.round(pct)}%)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-neutral-800"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Gráfico de torta: ventas por canal, mismo período que los KPIs */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Ventas por canal
          </h2>
          <span className="text-xs text-neutral-400">período seleccionado</span>
        </div>

        {kpi.facturado === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">
            No hay ventas en este período.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
            <DonutCanal datos={porCanal} />
            <ul className="space-y-3">
              {porCanal.map((c) => (
                <li key={c.canal} className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <div className="text-sm">
                    <p className="font-medium text-neutral-800">
                      {c.label}{" "}
                      <span className="text-neutral-400">
                        · {c.pct.toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-neutral-500">
                      {formatPrecio(c.total)} · {c.cant}{" "}
                      {c.cant === 1 ? "venta" : "ventas"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Gráfico de barras --------------------------- */

/**
 * Barras por mes, de una o varias series apiladas.
 *
 * El `max` se recibe en vez de calcularse adentro: dos gráficos que miden lo
 * mismo (facturado y cobrado) tienen que compartir la escala para poder
 * compararse de un vistazo.
 */
function GraficoMeses({
  titulo,
  subtitulo,
  meses,
  max,
  series,
  pie,
}: {
  titulo: string;
  subtitulo?: string;
  meses: { y: number; m: number; v: number[] }[];
  max: number;
  series: { label: string; color: string }[];
  pie: string;
}) {
  const hayDatos = meses.some((m) => m.v.some((n) => n > 0));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">{titulo}</h2>
        <span className="shrink-0 text-xs text-neutral-400">
          últimos 12 meses
        </span>
      </div>
      {subtitulo && (
        <p className="mb-4 text-xs text-neutral-400">{subtitulo}</p>
      )}

      {/* Con dos o más series la identidad no puede quedar solo en el color */}
      {series.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="text-neutral-600">{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      {!hayDatos ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Todavía no hay movimientos para mostrar acá.
        </p>
      ) : (
        <>
          <div className="flex h-48 items-stretch gap-1.5 border-b border-neutral-200">
            {meses.map((m, i) => {
              const total = m.v.reduce((a, n) => a + n, 0);
              // Un mes con movimiento nunca queda invisible: piso de 3%.
              const alto = total > 0 ? Math.max((total / max) * 100, 3) : 0;
              const visibles = series
                .map((s, j) => ({ ...s, valor: m.v[j] ?? 0 }))
                .filter((s) => s.valor > 0);

              return (
                <div
                  key={i}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                >
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs text-white group-hover:block">
                    <p className="font-medium">
                      {MESES[m.m]} {m.y}
                    </p>
                    {series.length > 1 ? (
                      <>
                        {visibles.map((s) => (
                          <p key={s.label} className="text-white/80">
                            {s.label}: {formatPrecio(s.valor)}
                          </p>
                        ))}
                        <p className="mt-0.5 border-t border-white/20 pt-0.5">
                          Total: {formatPrecio(total)}
                        </p>
                      </>
                    ) : (
                      <p className="text-white/80">{formatPrecio(total)}</p>
                    )}
                  </div>

                  {/* Barra apilada. `flex-col-reverse` deja la primera serie
                      abajo; el hueco de 2px separa los tramos. */}
                  <div
                    className="flex w-full flex-col-reverse gap-[2px]"
                    style={{ height: `${alto}%` }}
                    role="img"
                    aria-label={`${MESES[m.m]} ${m.y}: ${
                      visibles.length
                        ? visibles
                            .map((s) => `${s.label} ${formatPrecio(s.valor)}`)
                            .join(", ")
                        : "sin movimientos"
                    }`}
                  >
                    {visibles.map((s, j) => (
                      <div
                        key={s.label}
                        className={`w-full transition-opacity group-hover:opacity-90 ${
                          j === visibles.length - 1 ? "rounded-t" : ""
                        }`}
                        style={{
                          flexGrow: s.valor,
                          flexBasis: 0,
                          minHeight: 2,
                          backgroundColor: s.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Etiquetas de meses */}
          <div className="mt-2 flex gap-1.5">
            {meses.map((m, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[10px] text-neutral-400"
              >
                {MESES[m.m]}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-3 text-right text-xs text-neutral-400">{pie}</p>
    </div>
  );
}

/** Gráfico de torta (donut) de 2 segmentos: ventas online vs. manuales. */
function DonutCanal({
  datos,
}: {
  datos: { canal: string; color: string; total: number; pct: number }[];
}) {
  const r = 60;
  const sw = 26;
  const C = 2 * Math.PI * r;
  const GAP = datos.filter((d) => d.pct > 0).length > 1 ? 3 : 0;

  let acumulado = 0;
  const segmentos = datos
    .filter((d) => d.pct > 0)
    .map((d) => {
      const largo = (d.pct / 100) * C;
      const dash = Math.max(largo - GAP, 0);
      const offset = -acumulado;
      acumulado += largo;
      return { ...d, dash, offset };
    });

  const total = datos.reduce((a, d) => a + d.total, 0);

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        <circle
          cx={70}
          cy={70}
          r={r}
          fill="none"
          stroke="#e1e0d9"
          strokeWidth={sw}
        />
        {segmentos.map((s) => (
          <circle
            key={s.canal}
            cx={70}
            cy={70}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={s.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-neutral-400">Total</span>
        <span className="text-sm font-semibold text-neutral-900">
          {formatPrecio(total)}
        </span>
      </div>
    </div>
  );
}
