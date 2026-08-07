import { formatPrecio } from "@/lib/constants";

/** Medios de pago compartidos entre compras (egresos) y ventas (ingresos). */
export const MEDIOS_PAGO = [
  "Efectivo",
  "Transferencia",
  "Tarjeta de débito",
  "Tarjeta de crédito",
  "Otro",
];

/**
 * Medio de pago + cuotas (si es tarjeta de crédito). Pensado para reusarse
 * tal cual en compras y, más adelante, en el cobro de ventas.
 */
export default function MedioPagoCuotas({
  medioPago,
  onMedioPagoChange,
  cuotas,
  onCuotasChange,
  total,
}: {
  medioPago: string;
  onMedioPagoChange: (v: string) => void;
  cuotas: string;
  onCuotasChange: (v: string) => void;
  total: number;
}) {
  const esCredito = medioPago === "Tarjeta de crédito";
  const nCuotas = Number(cuotas) || 1;
  const montoCuota = nCuotas > 0 ? total / nCuotas : 0;

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div>
        <label className={labelClase}>Medio de pago</label>
        <select
          value={medioPago}
          onChange={(e) => onMedioPagoChange(e.target.value)}
          className={inputClase}
        >
          <option value="">— Elegir —</option>
          {MEDIOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {esCredito && (
        <>
          <div>
            <label className={labelClase}>Cantidad de cuotas</label>
            <input
              type="number"
              min="1"
              value={cuotas}
              onChange={(e) => onCuotasChange(e.target.value)}
              className={inputClase}
            />
          </div>
          <div>
            <label className={labelClase}>Monto por cuota</label>
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-700">
              {formatPrecio(montoCuota)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
