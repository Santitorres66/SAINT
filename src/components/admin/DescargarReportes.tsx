"use client";

import { useState } from "react";

/**
 * Descarga de reportes en Excel desde el tablero.
 *
 * El período aplica a ventas y compras; el stock es siempre la foto de hoy.
 * Sin fechas, se baja todo el historial.
 */

const REPORTES = [
  {
    tipo: "ventas",
    titulo: "Ventas",
    desc: "Fecha, cliente, producto, talle, color, precio, ganancia y si está cobrado. Con resumen por producto, por cliente y los cobros.",
    usaPeriodo: true,
  },
  {
    tipo: "compras",
    titulo: "Compras",
    desc: "Fecha, proveedor, ítem, tipo (mercadería, insumo, maquinaria), cantidades, costos y forma de pago.",
    usaPeriodo: true,
  },
  {
    tipo: "stock",
    titulo: "Disponibilidad de stock",
    desc: "Stock actual por talle y color, lo agotado y lo que está por agotarse, y el valor a costo y a venta.",
    usaPeriodo: false,
  },
] as const;

/** Fecha de hoy en Argentina, como la pide un <input type="date">. */
function hoyAR() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function DescargarReportes() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function atajo(dias: number | "mes" | "anio" | "todo") {
    const hoy = hoyAR();
    if (dias === "todo") {
      setDesde("");
      setHasta("");
      return;
    }
    if (dias === "mes") setDesde(`${hoy.slice(0, 7)}-01`);
    else if (dias === "anio") setDesde(`${hoy.slice(0, 4)}-01-01`);
    else {
      const d = new Date(`${hoy}T12:00:00`);
      d.setDate(d.getDate() - dias);
      setDesde(d.toISOString().slice(0, 10));
    }
    setHasta(hoy);
  }

  function href(tipo: string, usaPeriodo: boolean) {
    const qs = new URLSearchParams();
    if (usaPeriodo && desde) qs.set("desde", desde);
    if (usaPeriodo && hasta) qs.set("hasta", hasta);
    const q = qs.toString();
    return `/admin/reportes/${tipo}${q ? `?${q}` : ""}`;
  }

  const rangoInvalido = !!desde && !!hasta && desde > hasta;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">
        Descargar reportes en Excel
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Elegí el período (o dejalo vacío para bajar todo el historial). El
        stock siempre sale como está hoy.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-neutral-500">Desde</span>
          <input
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-neutral-500">Hasta</span>
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ["Este mes", "mes"],
              ["Últimos 30 días", 30],
              ["Este año", "anio"],
              ["Todo", "todo"],
            ] as const
          ).map(([label, valor]) => (
            <button
              key={label}
              type="button"
              onClick={() => atajo(valor)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-neutral-600 transition hover:border-neutral-500 hover:text-neutral-900"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {rangoInvalido && (
        <p className="mt-2 text-sm text-red-600">
          La fecha &quot;desde&quot; es posterior a &quot;hasta&quot;.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {REPORTES.map((r) => {
          const deshabilitado = r.usaPeriodo && rangoInvalido;
          return (
            <div
              key={r.tipo}
              className="flex flex-col rounded-xl border border-neutral-200 p-4"
            >
              <p className="font-semibold text-neutral-900">{r.titulo}</p>
              <p className="mt-1 flex-1 text-sm text-neutral-500">{r.desc}</p>
              <a
                href={deshabilitado ? undefined : href(r.tipo, r.usaPeriodo)}
                aria-disabled={deshabilitado}
                className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                  deshabilitado
                    ? "pointer-events-none bg-neutral-300"
                    : "bg-neutral-900 hover:bg-neutral-700"
                }`}
              >
                ↓ Descargar Excel
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
