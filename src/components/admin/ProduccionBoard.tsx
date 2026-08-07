"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { OrdenProduccionVista, EstadoProduccion } from "@/lib/types";
import { ESTADOS_PRODUCCION, formatNumeroOrden } from "@/lib/constants";
import { cambiarEstadoProduccion } from "@/app/admin/produccion-actions";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/* ------------------------------- Tarjeta -------------------------------- */
function Tarjeta({
  orden,
  onMover,
  pending,
}: {
  orden: OrdenProduccionVista;
  onMover: (id: string, e: EstadoProduccion) => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: orden.id });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-sm ${
        isDragging ? "opacity-80 shadow-lg" : ""
      }`}
    >
      {/* Zona agarrable para arrastrar */}
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
            {orden.product_imagen_url || orden.imagen_ref_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={orden.product_imagen_url ?? orden.imagen_ref_url ?? ""}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl text-neutral-300">
                🧵
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-neutral-400">
              {formatNumeroOrden(orden.numero)}
            </p>
            <p className="truncate text-sm font-medium text-neutral-900">
              {orden.product_nombre || orden.prenda || "—"}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {orden.bordado_descripcion || "Sin descripción"}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
          <span>Cant: {orden.cantidad}</span>
          {orden.talle && <span>Talle: {orden.talle}</span>}
          {orden.color && <span>{orden.color}</span>}
          <span>{formatFecha(orden.fecha)}</span>
        </div>
        {orden.cliente && (
          <p className="mt-1 truncate text-xs text-neutral-500">
            👤 {orden.cliente}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {/* Fallback sin arrastrar (ideal en celular) */}
        <select
          value={orden.estado}
          disabled={pending}
          onChange={(e) => onMover(orden.id, e.target.value as EstadoProduccion)}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-900 disabled:opacity-50"
        >
          {ESTADOS_PRODUCCION.map((e) => (
            <option key={e.value} value={e.value}>
              Mover a: {e.label}
            </option>
          ))}
        </select>
        <Link
          href={`/admin/produccion/${orden.id}`}
          className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
        >
          Ver
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------- Columna -------------------------------- */
function Columna({
  estado,
  children,
  count,
}: {
  estado: (typeof ESTADOS_PRODUCCION)[number];
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado.value });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border ${estado.col} p-3 transition ${
        isOver ? "ring-2 ring-neutral-900/30" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-neutral-800">
          {estado.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.chip}`}>
          {count}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* --------------------------------- Board -------------------------------- */
export default function ProduccionBoard({
  ordenes,
}: {
  ordenes: OrdenProduccionVista[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(ordenes);
  const [busqueda, setBusqueda] = useState("");
  const [matrizFiltro, setMatrizFiltro] = useState("");

  // Resincronizar cuando el servidor manda datos nuevos
  useEffect(() => setLocal(ordenes), [ordenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function mover(id: string, estado: EstadoProduccion) {
    const actual = local.find((o) => o.id === id);
    if (!actual || actual.estado === estado) return;
    setError(null);
    // Optimista
    setLocal((prev) =>
      prev.map((o) => (o.id === id ? { ...o, estado } : o)),
    );
    startTransition(async () => {
      const res = await cambiarEstadoProduccion(id, estado);
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    mover(String(active.id), over.id as EstadoProduccion);
  }

  // Matrices presentes (para el filtro)
  const matricesUsadas = Array.from(
    new Map(
      local
        .filter((o) => o.matriz_id && o.matriz_nombre)
        .map((o) => [o.matriz_id, o.matriz_nombre]),
    ).entries(),
  );

  // Filtro de búsqueda + matriz
  const filtradas = local.filter((o) => {
    if (matrizFiltro && o.matriz_id !== matrizFiltro) return false;
    const t = busqueda.toLowerCase().trim();
    if (!t) return true;
    return [
      formatNumeroOrden(o.numero),
      o.cliente,
      o.prenda,
      o.product_nombre,
      o.bordado_descripcion,
      o.pedido_referencia,
    ]
      .join(" ")
      .toLowerCase()
      .includes(t);
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por N° de orden, cliente, prenda o pedido…"
          className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        />
        {matricesUsadas.length > 0 && (
          <select
            value={matrizFiltro}
            onChange={(e) => setMatrizFiltro(e.target.value)}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900 sm:w-64"
          >
            <option value="">Todas las matrices</option>
            {matricesUsadas.map(([id, nombre]) => (
              <option key={id} value={id ?? ""}>
                {nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="text-xs text-neutral-400">
        Arrastrá las tarjetas entre columnas para cambiar el estado (o usá el
        selector de cada tarjeta).
      </p>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {ESTADOS_PRODUCCION.map((estado) => {
            const items = filtradas.filter((o) => o.estado === estado.value);
            return (
              <Columna key={estado.value} estado={estado} count={items.length}>
                {items.map((o) => (
                  <Tarjeta
                    key={o.id}
                    orden={o}
                    onMover={mover}
                    pending={pending}
                  />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-neutral-400">
                    Sin órdenes
                  </p>
                )}
              </Columna>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
