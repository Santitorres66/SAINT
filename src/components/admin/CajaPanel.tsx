"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CuentaCaja, Socio } from "@/lib/types";
import type { DiaCaja } from "@/lib/caja-datos";
import { formatPrecio } from "@/lib/constants";
import { CONCEPTOS_CAJA, formatDia, hoyAR } from "@/lib/caja";
import {
  registrarMovimientoCaja,
  deleteMovimientoCaja,
  registrarControlCaja,
} from "@/app/admin/gestion-actions";

const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
const inputClase =
  "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900";

/* ------------------------- Control contra Brubank ------------------------- */

/**
 * Se escribe el saldo que muestra la app de Brubank y se ve al instante la
 * diferencia con el sistema. Se puede guardar el control (queda el
 * historial) y, si la diferencia es conocida, ajustar el sistema al banco.
 */
export function ControlBrubank({ saldoSistema }: { saldoSistema: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [real, setReal] = useState("");
  const [notas, setNotas] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const hayReal = real.trim() !== "" && !Number.isNaN(Number(real));
  const diferencia = hayReal ? Number(real) - saldoSistema : 0;
  const cuadra = hayReal && Math.abs(diferencia) < 1;

  function guardar(ajustar: boolean) {
    setMsg(null);
    startTransition(async () => {
      const res = await registrarControlCaja({
        saldo_real: Number(real),
        saldo_sistema: saldoSistema,
        notas,
      });
      if (res?.error) return setMsg({ ok: false, texto: res.error });
      if (ajustar && !cuadra) {
        const aj = await registrarMovimientoCaja({
          fecha: hoyAR(),
          concepto: "ajuste",
          cuenta: "brubank",
          monto: Math.abs(diferencia),
          sentido: diferencia > 0 ? 1 : -1,
          socio_id: null,
          notas: notas || "Ajuste para igualar el saldo de Brubank",
        });
        if (aj?.error) return setMsg({ ok: false, texto: aj.error });
      }
      setReal("");
      setNotas("");
      setMsg({
        ok: true,
        texto: ajustar ? "Control guardado y sistema ajustado." : "Control guardado.",
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClase}>Saldo real en Brubank hoy</label>
          <input
            type="number"
            step="0.01"
            value={real}
            onChange={(e) => setReal(e.target.value)}
            className={inputClase}
            placeholder="Lo que dice la app"
          />
        </div>
        <div>
          <label className={labelClase}>Nota (opcional)</label>
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={inputClase}
            placeholder="Ej: falta cargar la comisión"
          />
        </div>
      </div>

      {hayReal && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            cuadra
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {cuadra ? (
            <>✓ Coincide con el sistema.</>
          ) : (
            <>
              Diferencia: <strong>{formatPrecio(diferencia)}</strong>{" "}
              {diferencia > 0
                ? "— en el banco hay MÁS de lo que dice el sistema (¿falta cargar un cobro o un aporte?)."
                : "— en el banco hay MENOS de lo que dice el sistema (¿falta cargar un pago, gasto o comisión?)."}
            </>
          )}
        </div>
      )}

      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {msg.texto}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => guardar(false)}
          disabled={!hayReal || pending}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          Guardar control
        </button>
        {hayReal && !cuadra && (
          <button
            onClick={() => guardar(true)}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
            title="Carga un ajuste por la diferencia para que el sistema quede igual que el banco"
          >
            Guardar y ajustar el sistema
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Nuevo movimiento ---------------------------- */

export function NuevoMovimiento({ socios }: { socios: Socio[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(hoyAR());
  const [concepto, setConcepto] = useState(CONCEPTOS_CAJA[0].value);
  const [cuenta, setCuenta] = useState<CuentaCaja>("brubank");
  const [monto, setMonto] = useState("");
  const [sentido, setSentido] = useState<1 | -1>(1);
  const [socioId, setSocioId] = useState(socios[0]?.id ?? "");
  const [notas, setNotas] = useState("");

  const def = CONCEPTOS_CAJA.find((c) => c.value === concepto)!;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await registrarMovimientoCaja({
        fecha,
        concepto,
        cuenta,
        monto: Number(monto) || 0,
        sentido,
        socio_id: def.socio ? socioId : null,
        notas,
      });
      if (res?.error) setError(res.error);
      else {
        setMonto("");
        setNotas("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClase}>Qué es</label>
          <select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className={inputClase}
          >
            {CONCEPTOS_CAJA.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {def.socio && (
          <div>
            <label className={labelClase}>Socio</label>
            <select
              value={socioId}
              onChange={(e) => setSocioId(e.target.value)}
              className={inputClase}
            >
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        {def.value === "ajuste" && (
          <div>
            <label className={labelClase}>Sentido</label>
            <select
              value={sentido}
              onChange={(e) => setSentido(Number(e.target.value) as 1 | -1)}
              className={inputClase}
            >
              <option value={1}>Suma al saldo</option>
              <option value={-1}>Resta al saldo</option>
            </select>
          </div>
        )}
        {def.value !== "deposito" && (
          <div>
            <label className={labelClase}>Cuenta</label>
            <select
              value={cuenta}
              onChange={(e) => setCuenta(e.target.value as CuentaCaja)}
              className={inputClase}
            >
              <option value="brubank">Brubank</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>
        )}
        <div>
          <label className={labelClase}>Monto</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={inputClase}
            placeholder="$"
          />
        </div>
        <div>
          <label className={labelClase}>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputClase}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClase}>Nota (opcional)</label>
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={inputClase}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Registrar movimiento"}
        </button>
      </div>
    </form>
  );
}

export function BorrarMovimiento({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("¿Eliminar este movimiento de caja?")) return;
        startTransition(async () => {
          const res = await deleteMovimientoCaja(id);
          if (res?.error) alert(res.error);
          else router.refresh();
        });
      }}
      disabled={pending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      Quitar
    </button>
  );
}

/* --------------------------- Gráfico del saldo ---------------------------- */

/**
 * Saldo de caja al cierre de cada día. Una sola serie, así que no lleva
 * leyenda: el título la nombra. Pasando el mouse (o el dedo) se ve el día
 * con lo cobrado, lo pagado y el saldo.
 */
export function GraficoSaldo({ dias }: { dias: DiaCaja[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  if (dias.length < 2)
    return (
      <p className="py-12 text-center text-sm text-neutral-400">
        Todavía no hay suficientes días para dibujar la evolución.
      </p>
    );

  const W = 720;
  const H = 200;
  const PAD = 4;
  const valores = dias.map((d) => d.saldo);
  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);
  const rango = max - min || 1;
  const x = (i: number) => (i / (dias.length - 1)) * W;
  const y = (v: number) => PAD + (1 - (v - min) / rango) * (H - PAD * 2);
  const linea = dias.map((d, i) => `${x(i)},${y(d.saldo)}`).join(" ");
  const area = `0,${y(0)} ${linea} ${W},${y(0)}`;

  const d = activo !== null ? dias[activo] : dias[dias.length - 1];
  const i = activo ?? dias.length - 1;

  return (
    <div>
      {/* Lectura del día señalado (por defecto, hoy) */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
        <span className="font-medium text-neutral-900">
          {formatDia(d.dia, true)}: {formatPrecio(d.saldo)}
        </span>
        <span className="text-neutral-500">
          cobrado {formatPrecio(d.cobrado)} · pagado {formatPrecio(d.pagado)}
          {d.otros !== 0 && ` · otros ${formatPrecio(d.otros)}`}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-48 w-full touch-none"
          role="img"
          aria-label={`Saldo de caja por día, de ${formatDia(dias[0].dia, true)} a ${formatDia(dias[dias.length - 1].dia, true)}`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - r.left) / r.width;
            setActivo(
              Math.min(
                Math.max(Math.round(pos * (dias.length - 1)), 0),
                dias.length - 1,
              ),
            );
          }}
          onPointerLeave={() => setActivo(null)}
        >
          {/* Línea del cero: debajo, la caja está en rojo */}
          <line
            x1={0}
            x2={W}
            y1={y(0)}
            y2={y(0)}
            stroke="#d4d4d4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <polygon points={area} fill="#171717" fillOpacity={0.06} />
          <polyline
            points={linea}
            fill="none"
            stroke="#171717"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {activo !== null && (
            <line
              x1={x(i)}
              x2={x(i)}
              y1={0}
              y2={H}
              stroke="#a3a3a3"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* El punto va en HTML para que no se deforme con el SVG estirado */}
        <span
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-900"
          style={{
            left: `${(x(i) / W) * 100}%`,
            top: `${(y(d.saldo) / H) * 100}%`,
          }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-400">
        <span>{formatDia(dias[0].dia)}</span>
        <span>{formatDia(dias[dias.length - 1].dia)}</span>
      </div>
    </div>
  );
}
