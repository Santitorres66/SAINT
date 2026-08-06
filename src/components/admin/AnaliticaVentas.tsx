"use client";

import { useMemo, useState } from "react";
import { formatPrecio } from "@/lib/constants";

type Venta = {
  fecha: string;
  total: number;
  cliente: string;
  canal: "online" | "manual";
};
type Preset = "mes" | "anio" | "12m" | "todo" | "custom";

// Colores por canal (validados para distinguirse incluso con daltonismo).
const COLOR_ONLINE = "#2a78d6"; // Tienda web
const COLOR_MANUAL = "#eb6834"; // Manual

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

export default function AnaliticaVentas({ ventas }: { ventas: Venta[] }) {
  const [preset, setPreset] = useState<Preset>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

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

  // KPIs del período
  const kpi = useMemo(() => {
    const enRango = ventas.filter((v) => {
      const d = new Date(v.fecha);
      return d >= ini && d <= fin;
    });
    const facturado = enRango.reduce((a, v) => a + v.total, 0);
    const cant = enRango.length;
    const clientes = new Set(
      enRango.map((v) => v.cliente).filter((c) => c && c !== "—"),
    ).size;
    return {
      facturado,
      cant,
      promedio: cant ? facturado / cant : 0,
      clientes,
    };
  }, [ventas, ini, fin]);

  // Desglose por canal del período (para el gráfico de torta)
  const porCanal = useMemo(() => {
    const enRango = ventas.filter((v) => {
      const d = new Date(v.fecha);
      return d >= ini && d <= fin;
    });
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
  }, [ventas, ini, fin]);

  // Gráfico: facturado por mes (últimos 12 meses)
  const meses = useMemo(() => {
    const arr: { y: number; m: number; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      arr.push({ y: d.getFullYear(), m: d.getMonth(), total: 0 });
    }
    ventas.forEach((v) => {
      const d = new Date(v.fecha);
      const b = arr.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
      if (b) b.total += v.total;
    });
    return arr;
  }, [ventas, hoy]);

  const maxMes = Math.max(1, ...meses.map((m) => m.total));

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
      {/* Filtro de fecha */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
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

      {/* Gráfico facturado por mes */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Facturación por mes
          </h2>
          <span className="text-xs text-neutral-400">últimos 12 meses</span>
        </div>

        <div className="flex h-48 items-stretch gap-1.5 border-b border-neutral-200">
          {meses.map((m, i) => {
            const h = (m.total / maxMes) * 100;
            return (
              <div
                key={i}
                className="group relative flex flex-1 flex-col items-center justify-end"
              >
                {/* Tooltip */}
                <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white group-hover:block">
                  {MESES[m.m]} {m.y} · {formatPrecio(m.total)}
                </div>
                <div
                  className="w-full rounded-t bg-emerald-600 transition-all group-hover:bg-emerald-700"
                  style={{ height: `${Math.max(h, m.total > 0 ? 3 : 0)}%` }}
                />
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
        <p className="mt-3 text-right text-xs text-neutral-400">
          Máximo del período: {compacto(maxMes)}
        </p>
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
