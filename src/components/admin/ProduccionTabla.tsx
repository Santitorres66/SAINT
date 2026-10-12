"use client";

import { useState } from "react";
import Link from "next/link";
import type { OrdenProduccionVista } from "@/lib/types";
import {
  COLUMNAS_PRODUCCION,
  PRIORIDADES_PRODUCCION,
  chipCobro,
  labelCobro,
  columnaDeEstado,
  estaAtrasada,
  formatNumeroOrden,
  formatPrecio,
} from "@/lib/constants";

/** Por qué columna está ordenada la tabla. */
type Criterio = "numero" | "trabajo" | "cliente" | "fecha" | "estado";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/** Cómo se llama el trabajo de una orden en una lista. */
function tituloOrden(o: OrdenProduccionVista): string {
  return (
    o.product_nombre ||
    o.prenda ||
    (o.es_servicio ? o.bordado_descripcion : "") ||
    "—"
  );
}

/** Talle, color y cantidad en una línea. */
function detalleOrden(o: OrdenProduccionVista): string {
  return [o.talle && `Talle ${o.talle}`, o.color, `Cant. ${o.cantidad}`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Los botones del final de cada fila. Además de "Ver", el paso que la orden
 * tiene pendiente: desde la tabla también se tiene que poder cerrar el
 * circuito, no solo desde el Kanban.
 */
function Acciones({ orden }: { orden: OrdenProduccionVista }) {
  const btn =
    "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition";
  return (
    <div className="flex justify-end gap-1.5">
      {orden.estado === "entregado" && !orden.venta_id && (
        <Link
          href={`/admin/ventas/nueva?orden=${orden.id}`}
          className={`${btn} bg-neutral-900 text-white hover:bg-neutral-700`}
        >
          Vender
        </Link>
      )}
      {orden.venta_id && (orden.venta_saldo ?? 0) > 0 && (
        <Link
          href={`/admin/ventas?cobrar=${orden.venta_id}`}
          className={`${btn} bg-neutral-900 text-white hover:bg-neutral-700`}
        >
          Cobrar
        </Link>
      )}
      <Link
        href={`/admin/produccion/${orden.id}`}
        className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-100`}
      >
        Ver
      </Link>
    </div>
  );
}

/** El selector de estado, igual que el de la tarjeta del Kanban. */
function SelectorEstado({
  orden,
  onMover,
  pending,
  className,
}: {
  orden: OrdenProduccionVista;
  onMover: (id: string, columnaId: string) => void;
  pending: boolean;
  className: string;
}) {
  return (
    <select
      value={columnaDeEstado(orden.estado).id}
      disabled={pending}
      onChange={(e) => onMover(orden.id, e.target.value)}
      aria-label={`Estado de la orden ${formatNumeroOrden(orden.numero)}`}
      className={`truncate rounded-lg border border-neutral-300 bg-white outline-none focus:border-neutral-900 disabled:opacity-50 ${className}`}
    >
      {COLUMNAS_PRODUCCION.map((c) => (
        <option key={c.id} value={c.id}>
          {c.labelCorto ?? c.label}
        </option>
      ))}
    </select>
  );
}

/**
 * La vista de tabla: una fila por orden.
 *
 * El Kanban muestra bien en qué anda cada cosa, pero con muchas tarjetas hay
 * que scrollear en dos ejes para encontrar una orden. Acá entran todas juntas
 * y se pueden ordenar por cualquier columna. En pantalla chica la tabla se
 * reemplaza por filas apiladas: una tabla de seis columnas en un celular
 * obliga al scroll lateral que es justo lo que se quería evitar.
 */
export default function ProduccionTabla({
  ordenes,
  onMover,
  pending,
}: {
  ordenes: OrdenProduccionVista[];
  /** Mueve la orden a una columna del tablero (por id de columna). */
  onMover: (id: string, columnaId: string) => void;
  pending: boolean;
}) {
  const [criterio, setCriterio] = useState<Criterio>("numero");
  const [asc, setAsc] = useState(false);

  function ordenarPor(c: Criterio) {
    if (c === criterio) {
      setAsc((v) => !v);
      return;
    }
    setCriterio(c);
    // El número arranca de mayor a menor (lo último cargado primero); el
    // resto, de la A a la Z, que es como se busca a ojo.
    setAsc(c !== "numero");
  }

  const ordenadas = [...ordenes].sort((a, b) => {
    const dir = asc ? 1 : -1;
    switch (criterio) {
      case "trabajo":
        return tituloOrden(a).localeCompare(tituloOrden(b), "es") * dir;
      case "cliente":
        return (a.cliente || "").localeCompare(b.cliente || "", "es") * dir;
      case "fecha":
        return (
          (new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) * dir
        );
      case "estado": {
        // Por el avance real del circuito, no alfabético: "Entregado" no va
        // antes que "Fabricado" solo porque la E viene antes que la F.
        const paso = (o: OrdenProduccionVista) =>
          COLUMNAS_PRODUCCION.findIndex((c) =>
            (c.estados as string[]).includes(o.estado),
          );
        return (paso(a) - paso(b)) * dir;
      }
      default:
        return (a.numero - b.numero) * dir;
    }
  });

  if (ordenes.length === 0)
    return (
      <p className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-sm text-neutral-400">
        Sin órdenes
      </p>
    );

  const th =
    "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-400";

  function Encabezado({
    c,
    children,
  }: {
    c: Criterio;
    children: React.ReactNode;
  }) {
    return (
      <th className={th}>
        <button
          type="button"
          onClick={() => ordenarPor(c)}
          className="inline-flex items-center gap-1 transition hover:text-neutral-900"
        >
          {children}
          {/* Siempre ocupa lugar: si apareciera solo en la columna activa, los
              encabezados se correrían de lugar al cambiar el orden. */}
          <span className={criterio === c ? "" : "invisible"}>
            {asc ? "▲" : "▼"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {/* Pantalla grande: tabla */}
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-neutral-100">
          <tr>
            <Encabezado c="numero">N°</Encabezado>
            <Encabezado c="trabajo">Trabajo</Encabezado>
            <Encabezado c="cliente">Cliente</Encabezado>
            <Encabezado c="fecha">Fecha</Encabezado>
            <Encabezado c="estado">Estado</Encabezado>
            <th className={`${th} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {ordenadas.map((o) => {
            const atrasada = estaAtrasada(o.fecha_estimada_entrega, o.estado);
            const prio = PRIORIDADES_PRODUCCION.find(
              (p) => p.value === o.prioridad,
            );
            return (
              <tr key={o.id} className={atrasada ? "bg-red-50/60" : undefined}>
                <td className="px-3 py-2.5 align-top font-mono text-xs text-neutral-400">
                  {formatNumeroOrden(o.numero)}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-neutral-900">
                      {tituloOrden(o)}
                    </span>
                    {o.es_servicio && (
                      <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                        Servicio
                      </span>
                    )}
                    {prio && prio.value !== "media" && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${prio.chip}`}
                      >
                        {prio.label}
                      </span>
                    )}
                    {atrasada && (
                      <span className="text-[11px] font-medium text-red-600">
                        ⚠ Atrasada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {[o.bordado_descripcion, detalleOrden(o)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </td>
                <td className="px-3 py-2.5 align-top text-neutral-700">
                  {o.cliente || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top text-neutral-500">
                  {formatFecha(o.fecha)}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <SelectorEstado
                    orden={o}
                    onMover={onMover}
                    pending={pending}
                    className="w-full max-w-[150px] px-2 py-1 text-xs"
                  />
                  {o.venta_id && o.venta_estado_cobro && (
                    <span
                      className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${chipCobro(o.venta_estado_cobro)}`}
                    >
                      {labelCobro(o.venta_estado_cobro)}{" "}
                      {formatPrecio(o.venta_total ?? 0)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <Acciones orden={o} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Celular: una ficha por orden, sin scroll lateral */}
      <div className="divide-y divide-neutral-100 md:hidden">
        {ordenadas.map((o) => {
          const atrasada = estaAtrasada(o.fecha_estimada_entrega, o.estado);
          return (
            <div key={o.id} className={`p-3 ${atrasada ? "bg-red-50/60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-neutral-400">
                  {formatNumeroOrden(o.numero)}
                </span>
                {o.es_servicio && (
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                    Servicio
                  </span>
                )}
              </div>
              <p className="font-medium text-neutral-900">{tituloOrden(o)}</p>
              <p className="text-xs text-neutral-500">
                {[o.bordado_descripcion, detalleOrden(o)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {[o.cliente, formatFecha(o.fecha)].filter(Boolean).join(" · ")}
                {atrasada && (
                  <span className="ml-1 font-medium text-red-600">
                    ⚠ Atrasada
                  </span>
                )}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <SelectorEstado
                  orden={o}
                  onMover={onMover}
                  pending={pending}
                  className="min-w-0 flex-1 px-2 py-1.5 text-xs"
                />
                <Acciones orden={o} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
