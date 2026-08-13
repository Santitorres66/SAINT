"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VentaUnificada } from "@/lib/types";
import {
  formatPrecio,
  chipCobro,
  labelCobro,
  formatNumeroOrden,
} from "@/lib/constants";
import { MEDIOS_PAGO } from "@/components/admin/MedioPagoCuotas";
import {
  registrarCobro,
  deleteCobro,
  actualizarDescuentoVenta,
} from "@/app/admin/gestion-actions";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * Cobros de una venta. Una venta se puede cobrar en varias veces (seña,
 * saldo, cuotas): acá se ven los cobros ya registrados, el saldo que falta
 * y el formulario para agregar uno nuevo.
 *
 * El estado de cobro no se elige a mano: lo calcula la base a partir de los
 * cobros, así el estado nunca miente sobre la plata que entró.
 */
export default function CobrosPanel({
  venta,
  onClose,
}: {
  venta: VentaUnificada;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState(String(venta.saldo || ""));
  const [medioPago, setMedioPago] = useState(
    venta.medio_pago && MEDIOS_PAGO.includes(venta.medio_pago)
      ? venta.medio_pago
      : "Efectivo",
  );
  const [cuotas, setCuotas] = useState("1");
  const [notas, setNotas] = useState("");

  const [editandoDesc, setEditandoDesc] = useState(false);
  const [descuento, setDescuento] = useState(String(venta.descuento || 0));

  const esCredito = medioPago === "Tarjeta de crédito";
  const nCuotas = Math.max(Number(cuotas) || 1, 1);
  const montoNum = Number(monto) || 0;

  function agregarCobro(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (montoNum <= 0) {
      setError("Poné un monto mayor a 0.");
      return;
    }
    if (montoNum > venta.saldo + 0.01) {
      setError(
        `El cobro no puede superar el saldo pendiente (${formatPrecio(venta.saldo)}).`,
      );
      return;
    }
    startTransition(async () => {
      const res = await registrarCobro(venta.id, {
        fecha,
        monto: montoNum,
        medio_pago: medioPago,
        cuotas: esCredito ? nCuotas : 1,
        notas,
      });
      if (res?.error) setError(res.error);
      else {
        setNotas("");
        router.refresh();
      }
    });
  }

  function quitarCobro(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteCobro(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function guardarDescuento() {
    setError(null);
    startTransition(async () => {
      const res = await actualizarDescuentoVenta(venta.id, Number(descuento) || 0);
      if (res?.error) setError(res.error);
      else {
        setEditandoDesc(false);
        router.refresh();
      }
    });
  }

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">
              Cobros de la venta
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {venta.cliente} · {formatFecha(venta.fecha)}
              {venta.orden_numero !== null && (
                <>
                  {" "}
                  · orden{" "}
                  <span className="font-mono">
                    {formatNumeroOrden(venta.orden_numero)}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-lg border border-neutral-300 text-neutral-500 transition hover:bg-neutral-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Resumen de la plata */}
        <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Total facturado</span>
            <span className="font-medium">{formatPrecio(venta.total)}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-neutral-500">Descuento</span>
            {editandoDesc ? (
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  className="w-32 rounded-lg border border-neutral-300 px-2 py-1 text-right text-sm outline-none focus:border-neutral-900"
                />
                <button
                  onClick={guardarDescuento}
                  disabled={pending}
                  className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setEditandoDesc(false);
                    setDescuento(String(venta.descuento || 0));
                  }}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <span className="font-medium">
                  {venta.descuento > 0 ? `− ${formatPrecio(venta.descuento)}` : "—"}
                </span>
                <button
                  onClick={() => setEditandoDesc(true)}
                  className="text-xs font-medium text-neutral-600 hover:underline"
                >
                  Editar
                </button>
              </span>
            )}
          </div>

          <div className="flex justify-between border-t border-neutral-200 py-1 pt-2">
            <span className="text-neutral-500">Ya cobrado</span>
            <span className="font-medium text-emerald-700">
              {formatPrecio(venta.total_cobrado)}
            </span>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold">
            <span>Saldo pendiente</span>
            <span className={venta.saldo > 0 ? "text-amber-700" : "text-emerald-700"}>
              {formatPrecio(venta.saldo)}
            </span>
          </div>
          <p className="mt-3 border-t border-neutral-200 pt-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${chipCobro(venta.estado_cobro)}`}
            >
              {labelCobro(venta.estado_cobro)}
            </span>
          </p>
        </div>

        {/* Cobros ya registrados */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Cobros registrados
          </h4>
          {venta.cobros.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">
              Todavía no entró plata de esta venta.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {venta.cobros.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800">
                      {formatFecha(c.fecha)} ·{" "}
                      <span className="font-medium">{formatPrecio(c.monto)}</span>
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {c.medio_pago || "—"}
                      {c.cuotas > 1 &&
                        ` · ${c.cuotas} cuotas de ${formatPrecio(c.monto_cuota)}`}
                      {c.notas && ` · ${c.notas}`}
                    </p>
                  </div>
                  <button
                    onClick={() => quitarCobro(c.id)}
                    disabled={pending}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Nuevo cobro */}
        {venta.saldo > 0.01 ? (
          <form
            onSubmit={agregarCobro}
            className="mt-6 space-y-4 rounded-xl border border-neutral-200 p-4"
          >
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Registrar un cobro
            </h4>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="cobro-fecha" className={labelClase}>
                  Fecha del cobro
                </label>
                <input
                  id="cobro-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputClase}
                />
              </div>
              <div>
                <label htmlFor="cobro-monto" className={labelClase}>
                  Monto
                </label>
                <input
                  id="cobro-monto"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={inputClase}
                />
              </div>
              <div>
                <label htmlFor="cobro-medio" className={labelClase}>
                  Medio de pago
                </label>
                <select
                  id="cobro-medio"
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  className={inputClase}
                >
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {esCredito && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="cobro-cuotas" className={labelClase}>
                    Cuotas
                  </label>
                  <input
                    id="cobro-cuotas"
                    type="number"
                    min="1"
                    value={cuotas}
                    onChange={(e) => setCuotas(e.target.value)}
                    className={inputClase}
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className={labelClase}>Monto por cuota</span>
                  <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
                    {formatPrecio(montoNum / nCuotas)}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="cobro-notas" className={labelClase}>
                Nota (opcional)
              </label>
              <input
                id="cobro-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className={inputClase}
                placeholder="Ej: seña, saldo, transferencia de la madre…"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMonto(String(venta.saldo))}
                className="text-xs font-medium text-neutral-600 hover:underline"
              >
                Cobrar el saldo completo ({formatPrecio(venta.saldo)})
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Registrar cobro"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Esta venta está saldada. ✓
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-6 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
