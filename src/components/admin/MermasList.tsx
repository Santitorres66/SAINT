"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrdenProduccionVista } from "@/lib/types";
import {
  ESTADOS_MERMA,
  RESOLUCIONES_MERMA,
  formatNumeroOrden,
  formatPrecio,
  labelEstado,
  labelMotivoMerma,
  labelResolucionMerma,
  tituloOrden,
} from "@/lib/constants";
import {
  rehacerOrden,
  cerrarMerma,
  volverAProduccion,
} from "@/app/admin/produccion-actions";

type Merma = OrdenProduccionVista & { rehecha_numero: number | null };

function formatFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * Lista de mermas con su seguimiento. Cada caso arranca "abierto" y se
 * resuelve rehaciendo la orden o cerrándolo (qué se hizo con la prenda).
 */
export default function MermasList({ mermas }: { mermas: Merma[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"pendientes" | "todas">("pendientes");

  function correr(accion: () => Promise<{ error?: string } | undefined | void>) {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  const visibles = mermas.filter(
    (m) => filtro === "todas" || m.merma_estado !== "cerrada",
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-neutral-300 p-0.5">
          {(
            [
              ["pendientes", "Pendientes"],
              ["todas", "Todas"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFiltro(v)}
              aria-pressed={filtro === v}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                filtro === v
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          {visibles.length} de {mermas.length}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-sm text-neutral-400">
          {filtro === "pendientes"
            ? "No hay mermas pendientes."
            : "Todavía no se registraron mermas."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((m) => (
            <Fila key={m.id} m={m} pending={pending} correr={correr} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Fila({
  m,
  pending,
  correr,
}: {
  m: Merma;
  pending: boolean;
  correr: (accion: () => Promise<{ error?: string } | undefined | void>) => void;
}) {
  const [resolucion, setResolucion] = useState<string>(
    RESOLUCIONES_MERMA[0].value,
  );
  const estado = m.merma_estado ?? "abierta";
  const chip = ESTADOS_MERMA.find((e) => e.value === estado);
  const btn =
    "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50";

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/produccion/${m.id}`}
              className="font-mono text-xs text-neutral-500 hover:underline"
            >
              {formatNumeroOrden(m.numero)}
            </Link>
            {chip && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.chip}`}
              >
                {chip.label}
                {estado === "cerrada" && m.merma_resolucion
                  ? ` · ${labelResolucionMerma(m.merma_resolucion)}`
                  : ""}
              </span>
            )}
            <span className="text-xs text-neutral-400">
              {formatFecha(m.fecha_merma)}
            </span>
          </div>
          <p className="mt-1 font-medium text-neutral-900">
            {tituloOrden(m)}
            <span className="font-normal text-neutral-500">
              {[m.talle && `talle ${m.talle}`, m.color, `x${m.cantidad}`]
                .filter(Boolean)
                .map((t) => ` · ${t}`)
                .join("")}
            </span>
          </p>
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-red-700">
              {labelMotivoMerma(m.merma_motivo)}
            </span>
            {m.merma_etapa ? ` · en ${labelEstado(m.merma_etapa)}` : ""}
            {m.cliente ? ` · 👤 ${m.cliente}` : ""}
          </p>
          {m.merma_nota && (
            <p className="mt-1 text-sm text-neutral-500">“{m.merma_nota}”</p>
          )}
          {m.rehecha_orden_id && (
            <p className="mt-1 text-sm text-blue-700">
              Rehecha en{" "}
              <Link
                href={`/admin/produccion/${m.rehecha_orden_id}`}
                className="font-medium hover:underline"
              >
                {m.rehecha_numero ? formatNumeroOrden(m.rehecha_numero) : "otra orden"}
              </Link>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-400">Costo perdido</p>
          <p className="font-semibold text-red-700">
            {formatPrecio(Number(m.costo_total) || 0)}
          </p>
        </div>
      </div>

      {estado === "abierta" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => rehacerOrden(m.id))}
            className={`${btn} bg-neutral-900 text-white hover:bg-neutral-700`}
          >
            Rehacer orden
          </button>
          <span className="flex items-center gap-1.5">
            <select
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              aria-label="Qué se hizo con la prenda"
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-900"
            >
              {RESOLUCIONES_MERMA.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => cerrarMerma(m.id, resolucion))}
              className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-100`}
            >
              Cerrar caso
            </button>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("¿Se marcó por error? La orden vuelve a Producción."))
                correr(() => volverAProduccion(m.id));
            }}
            className={`${btn} ml-auto text-neutral-500 hover:bg-neutral-100`}
          >
            Fue un error, volver a producción
          </button>
        </div>
      )}
      {estado === "rehecha" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <span className="text-xs text-neutral-500">
            ¿Qué se hizo con la prenda perdida?
          </span>
          <select
            value={resolucion}
            onChange={(e) => setResolucion(e.target.value)}
            aria-label="Qué se hizo con la prenda"
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-900"
          >
            {RESOLUCIONES_MERMA.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => correr(() => cerrarMerma(m.id, resolucion))}
            className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-100`}
          >
            Cerrar caso
          </button>
        </div>
      )}
    </li>
  );
}
