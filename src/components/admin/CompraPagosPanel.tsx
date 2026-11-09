"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Compra, Socio } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { MEDIOS_PAGO } from "@/components/admin/MedioPagoCuotas";
import { SAINT, hoyAR, diaDe, formatDia } from "@/lib/caja";
import {
  registrarPagoCompra,
  deletePagoCompra,
} from "@/app/admin/gestion-actions";

/** Lo pagado y lo que falta de una compra, a partir de sus pagos. */
export function resumenPagos(c: Compra) {
  const pagos = c.pagos ?? [];
  const pagado = pagos.reduce((a, p) => a + p.monto, 0);
  const saldo = Math.max(c.total - pagado, 0);
  const cuotasPagadas =
    c.cuotas > 1 && c.monto_cuota > 0
      ? Math.min(Math.floor(pagado / c.monto_cuota + 0.01), c.cuotas)
      : 0;
  return { pagado, saldo, cuotasPagadas };
}

/**
 * Pagos de una compra: quién puso la plata (SAINT o un socio) y, en las
 * compras en cuotas, cuántas van pagadas. Igual que los cobros de una venta,
 * lo pagado no se tipea: sale de sumar estos pagos.
 */
export default function CompraPagosPanel({
  compra,
  socios,
  onClose,
}: {
  compra: Compra;
  socios: Socio[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { pagado, saldo, cuotasPagadas } = resumenPagos(compra);
  const enCuotas = compra.cuotas > 1 && compra.monto_cuota > 0;
  const montoSugerido = enCuotas ? Math.min(compra.monto_cuota, saldo) : saldo;

  const [fecha, setFecha] = useState(hoyAR());
  const [cuotas, setCuotas] = useState("1");
  const [monto, setMonto] = useState(
    montoSugerido > 0 ? String(Math.round(montoSugerido * 100) / 100) : "",
  );
  const [pagador, setPagador] = useState(SAINT);
  const [medioPago, setMedioPago] = useState(
    compra.medio_pago && MEDIOS_PAGO.includes(compra.medio_pago)
      ? compra.medio_pago
      : "Transferencia",
  );
  const [notas, setNotas] = useState("");

  const nombreDe = (socioId: string | null) =>
    socioId
      ? (socios.find((s) => s.id === socioId)?.nombre ?? "Socio")
      : "SAINT";

  // Cuánto puso cada uno en esta compra
  const porPagador = new Map<string, number>();
  for (const p of compra.pagos ?? []) {
    const k = nombreDe(p.socio_id);
    porPagador.set(k, (porPagador.get(k) ?? 0) + p.monto);
  }

  const nCuotas = Math.max(Math.floor(Number(cuotas) || 1), 1);
  const montoNum = Number(monto) || 0;

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (montoNum <= 0) {
      setError("Poné un monto mayor a 0.");
      return;
    }
    if (montoNum * nCuotas > saldo + 0.01) {
      setError(`Supera lo que falta pagar (${formatPrecio(saldo)}).`);
      return;
    }
    startTransition(async () => {
      const res = await registrarPagoCompra(compra.id, {
        fecha,
        monto: montoNum,
        cuotas: nCuotas,
        socio_id: pagador === SAINT ? null : pagador,
        medio_pago: medioPago,
        notas,
      });
      if (res?.error) setError(res.error);
      else {
        setNotas("");
        setCuotas("1");
        router.refresh();
      }
    });
  }

  function quitar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deletePagoCompra(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">
              Pagos de la compra
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {compra.proveedor_nombre || "Sin proveedor"} ·{" "}
              {formatDia(diaDe(compra.fecha), true)}
              {compra.items[0] && ` · ${compra.items[0].nombre}`}
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

        {/* Resumen */}
        <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Total de la compra</span>
            <span className="font-medium">{formatPrecio(compra.total)}</span>
          </div>
          {enCuotas && (
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">Cuotas</span>
              <span className="font-medium">
                {cuotasPagadas} de {compra.cuotas} pagadas ·{" "}
                {formatPrecio(compra.monto_cuota)} c/u
              </span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Pagado</span>
            <span className="font-medium text-emerald-700">
              {formatPrecio(pagado)}
            </span>
          </div>
          {[...porPagador.entries()].map(([quien, m]) => (
            <div key={quien} className="flex justify-between py-0.5 pl-4">
              <span className="text-neutral-400">{quien}</span>
              <span className="text-neutral-600">{formatPrecio(m)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2">
            <span className="text-neutral-700">Falta pagar</span>
            <span
              className={`font-semibold ${saldo > 0.01 ? "text-amber-700" : "text-neutral-900"}`}
            >
              {formatPrecio(saldo)}
            </span>
          </div>
        </div>

        {/* Pagos registrados */}
        {(compra.pagos ?? []).length > 0 && (
          <ul className="mt-6 divide-y divide-neutral-100 text-sm">
            {(compra.pagos ?? []).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
              >
                <span className="text-neutral-700">
                  {formatDia(diaDe(p.fecha), true)} · {nombreDe(p.socio_id)}
                  {p.medio_pago && (
                    <span className="text-neutral-400"> · {p.medio_pago}</span>
                  )}
                  {p.notas && (
                    <span className="block text-xs text-neutral-400">
                      {p.notas}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">{formatPrecio(p.monto)}</span>
                  <button
                    onClick={() => quitar(p.id)}
                    disabled={pending}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Nuevo pago */}
        {saldo > 0.01 && (
          <form
            onSubmit={agregar}
            className="mt-6 space-y-4 border-t border-neutral-100 pt-6"
          >
            <h4 className="text-sm font-semibold text-neutral-900">
              {enCuotas ? "Registrar cuota" : "Registrar pago"}
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClase}>
                  {nCuotas > 1 ? "Fecha de la primera" : "Fecha"}
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputClase}
                />
              </div>
              <div>
                <label className={labelClase}>¿Quién pagó?</label>
                <select
                  value={pagador}
                  onChange={(e) => setPagador(e.target.value)}
                  className={inputClase}
                >
                  <option value={SAINT}>SAINT (caja)</option>
                  {socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {enCuotas && (
                <div>
                  <label className={labelClase}>Cuántas cuotas</label>
                  <input
                    type="number"
                    min="1"
                    max={compra.cuotas - cuotasPagadas}
                    value={cuotas}
                    onChange={(e) => setCuotas(e.target.value)}
                    className={inputClase}
                  />
                  {nCuotas > 1 && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Se carga una por mes desde la fecha elegida, así la caja
                      las ve en el día en que se pagaron.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className={labelClase}>
                  {enCuotas ? "Monto de cada cuota" : "Monto"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={inputClase}
                />
              </div>
              <div>
                <label className={labelClase}>Medio de pago</label>
                <select
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
              <div>
                <label className={labelClase}>Nota (opcional)</label>
                <input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className={inputClase}
                  placeholder="Ej: resumen de octubre"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-500">
                {nCuotas > 1 &&
                  `${nCuotas} cuotas = ${formatPrecio(montoNum * nCuotas)}`}
              </span>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Registrar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
