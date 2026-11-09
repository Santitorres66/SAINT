import type { CuentaCaja } from "./types";

/**
 * Piezas de la Caja que usan tanto el servidor como los formularios (sin
 * nada de Supabase, así se pueden importar desde un componente cliente).
 */

/** SAINT no es un socio: en los pagos se representa con socio_id null. */
export const SAINT = "saint";

export const LABEL_CUENTA: Record<CuentaCaja, string> = {
  brubank: "Brubank",
  efectivo: "Efectivo",
};

/**
 * A qué cuenta va (o de cuál sale) la plata según el medio de pago. Todo lo
 * que no es efectivo pasa por Brubank: transferencias, débito, y el resumen
 * de la tarjeta de crédito se paga desde ahí.
 */
export function cuentaDeMedio(medio: string | null | undefined): CuentaCaja {
  return (medio ?? "").trim().toLowerCase() === "efectivo"
    ? "efectivo"
    : "brubank";
}

/**
 * Movimientos manuales de caja. `signo` 1 entra, -1 sale, 0 lo elige quien
 * carga (ajuste) o mueve entre cuentas (depósito).
 */
export const CONCEPTOS_CAJA: {
  value: string;
  label: string;
  signo: 1 | -1 | 0;
  socio: boolean;
}[] = [
  { value: "aporte_socio", label: "Aporte de un socio", signo: 1, socio: true },
  { value: "devolucion_socio", label: "Devolución a un socio", signo: -1, socio: true },
  { value: "retiro_socio", label: "Retiro de ganancia de un socio", signo: -1, socio: true },
  { value: "gasto", label: "Gasto (comisión, servicio, flete…)", signo: -1, socio: false },
  { value: "otro_ingreso", label: "Otro ingreso", signo: 1, socio: false },
  { value: "deposito", label: "Depositar efectivo en Brubank", signo: 0, socio: false },
  { value: "ajuste", label: "Ajuste de saldo", signo: 0, socio: false },
];

export function labelConcepto(value: string): string {
  return CONCEPTOS_CAJA.find((c) => c.value === value)?.label ?? value;
}

const TZ = "America/Argentina/Buenos_Aires";

/**
 * Día (AAAA-MM-DD) en que pasó un movimiento.
 *
 * Las fechas que se eligen en un formulario se guardan como medianoche UTC
 * ("2026-11-09" → 2026-11-09T00:00Z), que en Argentina es la noche del día
 * anterior: esas se toman tal cual. Las que guardó la base con la hora real
 * (pagos web, por ejemplo) se pasan a hora argentina.
 */
export function diaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  )
    return d.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function hoyAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** "2026-11-09" → "9 nov" (o "9 nov 2026" con año). */
export function formatDia(dia: string, conAnio = false): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Suma n meses a un día AAAA-MM-DD (para fechar cuotas consecutivas). */
export function sumarMeses(dia: string, n: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  // Si el mes destino es más corto (31 → febrero), queda en su último día.
  const ultimo = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return base.toISOString().slice(0, 10);
}
