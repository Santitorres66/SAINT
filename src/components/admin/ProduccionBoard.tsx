"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import {
  COLUMNAS_PRODUCCION,
  COLUMNAS_TABLERO,
  PRIORIDADES_PRODUCCION,
  chipCobro,
  labelCobro,
  labelEstado,
  columnaDeEstado,
  estaAtrasada,
  formatNumeroOrden,
  formatPrecio,
  ordenarTalles,
  tituloOrden,
} from "@/lib/constants";
import { cambiarEstadoProduccion } from "@/app/admin/produccion-actions";
import { saldarVentaSinSaldo } from "@/app/admin/gestion-actions";
import ProduccionTabla from "./ProduccionTabla";

/** Las vistas del modulo. El tablero muestra el avance; la tabla, el volumen. */
type Vista = "tablero" | "tabla";

/** Donde se recuerda la vista elegida, para no volver al tablero cada vez. */
const CLAVE_VISTA = "saint:produccion:vista";

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
  /** Mueve la orden a una columna del tablero (por id de columna). */
  onMover: (id: string, columnaId: string) => void;
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

  const atrasada = estaAtrasada(orden.fecha_estimada_entrega, orden.estado);
  const prio = PRIORIDADES_PRODUCCION.find((p) => p.value === orden.prioridad);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-3 shadow-sm ${
        atrasada
          ? "border-red-300 bg-red-50 ring-1 ring-red-200"
          : "border-neutral-200 bg-white"
      } ${isDragging ? "opacity-80 shadow-lg" : ""}`}
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
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="font-mono text-xs text-neutral-400">
                  {formatNumeroOrden(orden.numero)}
                </p>
                {orden.es_servicio && (
                  <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                    Servicio
                  </span>
                )}
              </div>
              {prio && prio.value !== "media" && (
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${prio.chip}`}
                >
                  {prio.label}
                </span>
              )}
            </div>
            <p className="truncate text-sm font-medium text-neutral-900">
              {orden.product_nombre ||
                orden.prenda ||
                (orden.es_servicio ? orden.bordado_descripcion : "") ||
                "—"}
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
        {orden.fecha_estimada_entrega && (
          <p
            className={`mt-1 text-xs font-medium ${
              atrasada ? "text-red-600" : "text-neutral-500"
            }`}
          >
            {atrasada ? "⚠ Atrasado — entrega" : "Entrega"}:{" "}
            {formatFecha(orden.fecha_estimada_entrega)}
          </p>
        )}
      </div>

      {/* Estado de la plata, una vez que la orden se vendió */}
      {orden.venta_id && orden.venta_estado_cobro && (
        <div className="mt-2 rounded-lg bg-neutral-50 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${chipCobro(orden.venta_estado_cobro)}`}
            >
              {labelCobro(orden.venta_estado_cobro)}
            </span>
            <span className="text-xs font-medium text-neutral-700">
              {formatPrecio(orden.venta_total ?? 0)}
            </span>
          </div>
          {(orden.venta_saldo ?? 0) > 0 && (
            <p className="mt-1 text-[11px] text-amber-700">
              Falta cobrar {formatPrecio(orden.venta_saldo ?? 0)}
            </p>
          )}
        </div>
      )}

      {/* La columna agrupa varios estados: acá se aclara en cuál está. */}
      {columnaDeEstado(orden.estado).estados.length > 1 && (
        <span
          className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
            orden.venta_id
              ? "bg-purple-100 text-purple-800"
              : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {labelEstado(orden.estado)}
        </span>
      )}

      {/* Cierre del circuito: vender lo entregado, cobrar lo vendido */}
      {orden.estado === "entregado" && !orden.venta_id && (
        <Link
          href={`/admin/ventas/nueva?orden=${orden.id}`}
          className="mt-2 block rounded-lg bg-neutral-900 px-2 py-1.5 text-center text-xs font-medium text-white transition hover:bg-neutral-700"
        >
          Cargar como vendido
        </Link>
      )}
      {orden.venta_id && (orden.venta_saldo ?? 0) > 0 && (
        <Link
          href={`/admin/ventas?cobrar=${orden.venta_id}`}
          className="mt-2 block rounded-lg bg-neutral-900 px-2 py-1.5 text-center text-xs font-medium text-white transition hover:bg-neutral-700"
        >
          Registrar cobro
        </Link>
      )}

      <div className="mt-2 flex items-center gap-2">
        {/* Fallback sin arrastrar (ideal en celular).
            `min-w-0` es lo que le permite encogerse: sin eso, un select no baja
            del ancho de su opción más larga y empuja el "Ver" fuera de la
            tarjeta. */}
        <select
          value={columnaDeEstado(orden.estado).id}
          disabled={pending}
          onChange={(e) => onMover(orden.id, e.target.value)}
          aria-label="Cambiar estado de la orden"
          className="min-w-0 flex-1 truncate rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-900 disabled:opacity-50"
        >
          {COLUMNAS_PRODUCCION.map((c) => (
            <option key={c.id} value={c.id}>
              {c.labelCorto ?? c.label}
            </option>
          ))}
        </select>
        <Link
          href={`/admin/produccion/${orden.id}`}
          className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
        >
          Ver
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------- Columna -------------------------------- */
function Columna({
  columna,
  children,
  count,
}: {
  columna: (typeof COLUMNAS_PRODUCCION)[number];
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.id });
  return (
    <div
      ref={setNodeRef}
      // Ancho fijo + scroll horizontal en el contenedor: una grilla que
      // reparta el ancho dejaría las tarjetas ilegibles.
      className={`w-[275px] shrink-0 rounded-2xl border ${columna.col} p-3 transition ${
        isOver ? "ring-2 ring-neutral-900/30" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-neutral-800">
          {columna.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${columna.chip}`}>
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

  /* La vista arranca siempre en "tablero" y la preferencia guardada se aplica
     despues de montar: leer localStorage durante el render haria que el HTML
     del servidor y el del navegador no coincidan. */
  const [vista, setVista] = useState<Vista>("tablero");
  useEffect(() => {
    if (localStorage.getItem(CLAVE_VISTA) === "tabla") setVista("tabla");
  }, []);

  function elegirVista(v: Vista) {
    setVista(v);
    localStorage.setItem(CLAVE_VISTA, v);
  }

  const [fCliente, setFCliente] = useState("");
  const [fColumna, setFColumna] = useState("");
  const [fPrioridad, setFPrioridad] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fPrenda, setFPrenda] = useState("");
  const [fTalle, setFTalle] = useState("");

  // Resincronizar cuando el servidor manda datos nuevos
  useEffect(() => setLocal(ordenes), [ordenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  /* --- Barra de scroll espejo, arriba del tablero ---
     El tablero es alto: para correrlo al costado había que bajar hasta el
     final a buscar la barra. Esta es una segunda barra arriba, sincronizada
     con la de abajo en los dos sentidos. */
  const barraRef = useRef<HTMLDivElement>(null);
  const tableroRef = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState({ scroll: 0, visible: 0 });
  // Evita el rebote entre los dos onScroll (uno mueve al otro y vuelve).
  const sincronizando = useRef(false);

  function espejar(desde: HTMLDivElement | null, hacia: HTMLDivElement | null) {
    if (!desde || !hacia || sincronizando.current) return;
    sincronizando.current = true;
    hacia.scrollLeft = desde.scrollLeft;
    requestAnimationFrame(() => {
      sincronizando.current = false;
    });
  }

  const hayQueScrollear = medidas.scroll > medidas.visible + 1;

  function mover(id: string, estado: EstadoProduccion) {
    const actual = local.find((o) => o.id === id);
    if (!actual || actual.estado === estado) return;
    setError(null);

    // "Vendido" y "Cobrado" no se marcan a mano: los produce la venta y su
    // cobro. Si el usuario los elige, lo llevamos a donde se cargan de verdad.
    if ((estado === "vendido" || estado === "cobrado") && !actual.venta_id) {
      router.push(`/admin/ventas/nueva?orden=${id}`);
      return;
    }
    if (estado === "cobrado" && actual.venta_id) {
      // Venta sin saldo (ej. en $0): no hay nada que cobrar, se cierra directo.
      if (actual.venta_saldo !== null && actual.venta_saldo <= 0.01) {
        const ventaId = actual.venta_id;
        setLocal((prev) =>
          prev.map((o) => (o.id === id ? { ...o, estado } : o)),
        );
        startTransition(async () => {
          const res = await saldarVentaSinSaldo(ventaId);
          if (res?.error) {
            setError(res.error);
            setLocal((prev) =>
              prev.map((o) =>
                o.id === id ? { ...o, estado: actual.estado } : o,
              ),
            );
          }
          router.refresh();
        });
        return;
      }
      router.push(`/admin/ventas?cobrar=${actual.venta_id}`);
      return;
    }

    // Optimista
    setLocal((prev) =>
      prev.map((o) => (o.id === id ? { ...o, estado } : o)),
    );
    startTransition(async () => {
      const res = await cambiarEstadoProduccion(id, estado);
      if (res?.error) {
        setError(res.error);
        // El servidor rechazó el cambio: deshacemos el movimiento optimista
        // para no mostrar la tarjeta en una columna donde no está.
        setLocal((prev) =>
          prev.map((o) => (o.id === id ? { ...o, estado: actual.estado } : o)),
        );
      }
      router.refresh();
    });
  }

  /**
   * Mueve una orden a la columna indicada. Como una columna puede agrupar más
   * de un estado ("Entregado / Vendido"), si la orden ya está en esa columna no
   * hacemos nada: soltar una orden vendida en su propia columna no la puede
   * degradar a "entregado".
   */
  function moverAColumna(id: string, columnaId: string) {
    const columna = COLUMNAS_PRODUCCION.find((c) => c.id === columnaId);
    if (!columna) return;
    const actual = local.find((o) => o.id === id);
    if (actual && (columna.estados as string[]).includes(actual.estado)) return;
    mover(id, columna.destino);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    moverAColumna(String(active.id), String(over.id));
  }

  // Matrices presentes (para el filtro)
  const matricesUsadas = Array.from(
    new Map(
      local
        .filter((o) => o.matriz_id && o.matriz_nombre)
        .map((o) => [o.matriz_id, o.matriz_nombre]),
    ).entries(),
  );

  // Clientes con al menos una orden (no el master entero: acá solo sirven
  // los que efectivamente tienen trabajo cargado).
  const clientesConOrden = [
    ...new Set(local.map((o) => o.cliente).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  // Prendas y talles que efectivamente aparecen en alguna orden: una lista
  // con todo el catálogo tendría opciones que no filtran nada.
  const prendasConOrden = [
    ...new Set(local.map((o) => tituloOrden(o)).filter((t) => t !== "—")),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const tallesConOrden = ordenarTalles([
    ...new Set(local.map((o) => o.talle).filter(Boolean)),
  ]);

  const hayFiltros = Boolean(
    busqueda ||
      matrizFiltro ||
      fCliente ||
      fColumna ||
      fPrioridad ||
      fTipo ||
      fPrenda ||
      fTalle,
  );

  function limpiarFiltros() {
    setBusqueda("");
    setMatrizFiltro("");
    setFCliente("");
    setFColumna("");
    setFPrioridad("");
    setFTipo("");
    setFPrenda("");
    setFTalle("");
  }

  const filtradas = local.filter((o) => {
    if (matrizFiltro && o.matriz_id !== matrizFiltro) return false;
    if (fCliente && o.cliente !== fCliente) return false;
    // El filtro de estado es por columna, no por estado suelto: "Entregado /
    // Vendido" son una sola cosa para quien mira el tablero.
    if (fColumna && columnaDeEstado(o.estado).id !== fColumna) return false;
    if (fPrioridad && o.prioridad !== fPrioridad) return false;
    if (fTipo === "servicio" && !o.es_servicio) return false;
    if (fTipo === "prenda" && o.es_servicio) return false;
    if (fPrenda && tituloOrden(o) !== fPrenda) return false;
    if (fTalle && o.talle !== fTalle) return false;
    const t = busqueda.toLowerCase().trim();
    if (!t) return true;
    return [
      formatNumeroOrden(o.numero),
      o.cliente,
      o.prenda,
      o.product_nombre,
      o.bordado_descripcion,
      o.pedido_referencia,
      o.es_servicio ? "servicio" : "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(t);
  });

  // Medimos el tablero para saber cuánto tiene que "durar" la barra de arriba.
  // Se remide cuando cambian las tarjetas visibles y cuando cambia la ventana.
  useEffect(() => {
    const el = tableroRef.current;
    if (!el) return;
    const medir = () =>
      setMedidas({ scroll: el.scrollWidth, visible: el.clientWidth });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filtradas.length]);

  return (
    <div className="space-y-4">
      {/* Cambio de vista: el tablero muestra el avance, la tabla el volumen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-neutral-300 p-0.5">
          {(
            [
              ["tablero", "Tablero"],
              ["tabla", "Tabla"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => elegirVista(v)}
              aria-pressed={vista === v}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                vista === v
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          {filtradas.length}
          {filtradas.length === local.length
            ? " órdenes"
            : ` de ${local.length} órdenes`}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por N° de orden, cliente, prenda o pedido…"
          className="w-full min-w-[220px] flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        />
        <select
          value={fColumna}
          onChange={(e) => setFColumna(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="">Todos los estados</option>
          {COLUMNAS_PRODUCCION.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {prendasConOrden.length > 0 && (
          <select
            value={fPrenda}
            onChange={(e) => setFPrenda(e.target.value)}
            className="max-w-[220px] rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
          >
            <option value="">Todas las prendas</option>
            {prendasConOrden.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {tallesConOrden.length > 0 && (
          <select
            value={fTalle}
            onChange={(e) => setFTalle(e.target.value)}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
          >
            <option value="">Todos los talles</option>
            {tallesConOrden.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {clientesConOrden.length > 0 && (
          <select
            value={fCliente}
            onChange={(e) => setFCliente(e.target.value)}
            className="max-w-[220px] rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
          >
            <option value="">Todos los clientes</option>
            {clientesConOrden.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          value={fPrioridad}
          onChange={(e) => setFPrioridad(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="">Toda prioridad</option>
          {PRIORIDADES_PRODUCCION.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={fTipo}
          onChange={(e) => setFTipo(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="">Prendas y servicios</option>
          <option value="prenda">Solo prendas</option>
          <option value="servicio">Solo servicios</option>
        </select>
        {matricesUsadas.length > 0 && (
          <select
            value={matrizFiltro}
            onChange={(e) => setMatrizFiltro(e.target.value)}
            className="max-w-[220px] rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
          >
            <option value="">Todas las matrices</option>
            {matricesUsadas.map(([id, nombre]) => (
              <option key={id} value={id ?? ""}>
                {nombre}
              </option>
            ))}
          </select>
        )}
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {vista === "tablero" && (
        <p className="text-xs text-neutral-400">
          Arrastrá las tarjetas entre columnas para cambiar el estado (o usá el
          selector de cada tarjeta). “Entregado” y “Vendido” comparten columna: la
          tarjeta aclara en cuál está y pasa a <em>Vendido</em> sola al cargar la
          venta. Al registrar el cobro la orden pasa a <em>Cobrado</em> y sale
          del tablero (sigue en la vista Tabla). Lo que se rompió o salió mal va
          a <em>Perdido</em>.
        </p>
      )}

      {/* Barra de scroll de arriba: solo si el tablero no entra en pantalla.
          Es un duplicado de la de abajo, así que no la anunciamos. */}
      {vista === "tablero" && hayQueScrollear && (
        <div
          ref={barraRef}
          onScroll={() => espejar(barraRef.current, tableroRef.current)}
          aria-hidden
          className="overflow-x-auto"
        >
          <div style={{ width: medidas.scroll, height: 1 }} />
        </div>
      )}

      {vista === "tabla" && (
        <ProduccionTabla
          ordenes={filtradas}
          onMover={moverAColumna}
          pending={pending}
        />
      )}

      {vista === "tablero" && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div
            ref={tableroRef}
            onScroll={() => espejar(tableroRef.current, barraRef.current)}
            className="flex gap-4 overflow-x-auto pb-3"
          >
            {COLUMNAS_TABLERO.map((columna) => {
              const items = filtradas.filter((o) =>
                (columna.estados as string[]).includes(o.estado),
              );
              return (
                <Columna key={columna.id} columna={columna} count={items.length}>
                  {items.map((o) => (
                    <Tarjeta
                      key={o.id}
                      orden={o}
                      onMover={moverAColumna}
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
      )}
    </div>
  );
}
