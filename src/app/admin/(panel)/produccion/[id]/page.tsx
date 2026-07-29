import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrdenDetalle } from "@/lib/produccion";
import EstadoSelectorDetalle from "@/components/admin/EstadoSelectorDetalle";
import EliminarOrdenBtn from "@/components/admin/EliminarOrdenBtn";
import {
  ESTADOS_PRODUCCION,
  formatNumeroOrden,
  formatPrecio,
  labelEstado,
} from "@/lib/constants";
import type { EstadoProduccion } from "@/lib/types";

function fecha(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </dt>
      <dd className="text-sm text-neutral-800">{valor || "—"}</dd>
    </div>
  );
}

const cardClase = "rounded-2xl border border-neutral-200 bg-white p-6";
const h2Clase = "mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500";

export default async function DetalleOrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalle = await getOrdenDetalle(id);
  if (!detalle) notFound();

  const { orden, imagen_ref_url, archivo_bordado_url, matriz, historial } =
    detalle;
  const chip =
    ESTADOS_PRODUCCION.find((e) => e.value === orden.estado)?.chip ??
    "bg-neutral-200 text-neutral-700";

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/produccion"
            className="text-sm text-neutral-500 transition hover:text-neutral-900"
          >
            ← Volver
          </Link>
          <h1 className="font-mono text-2xl font-semibold text-neutral-900">
            {formatNumeroOrden(orden.numero)}
          </h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${chip}`}>
            {labelEstado(orden.estado)}
          </span>
        </div>
        <EliminarOrdenBtn id={orden.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* BORDADO */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Bordado</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
                {imagen_ref_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagen_ref_url}
                    alt="Referencia del bordado"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-5xl text-neutral-300">
                    🧵
                  </span>
                )}
              </div>
              <dl className="space-y-3">
                <Dato label="Descripción" valor={orden.bordado_descripcion} />
                <Dato label="Ubicación" valor={orden.bordado_ubicacion} />
                <Dato label="Tamaño" valor={orden.bordado_tamano} />
                <Dato
                  label="Colores"
                  valor={orden.bordado_colores || "—"}
                />
                {orden.observaciones && (
                  <Dato label="Observaciones" valor={orden.observaciones} />
                )}
              </dl>
            </div>
          </section>

          {/* PEDIDO */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Pedido</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Dato label="Cliente" valor={orden.cliente} />
              <Dato label="N° de pedido" valor={orden.pedido_referencia} />
              <Dato label="Fecha" valor={fecha(orden.fecha)} />
            </dl>
          </section>

          {/* PRENDA */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Prenda</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Dato
                label="Producto"
                valor={orden.product_nombre || orden.prenda}
              />
              <Dato label="Tipo" valor={orden.tipo_prenda} />
              <Dato label="Talle" valor={orden.talle} />
              <Dato label="Color" valor={orden.color} />
              <Dato label="Cantidad" valor={orden.cantidad} />
            </dl>
          </section>

          {/* ARCHIVOS */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Archivos</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
                <span className="text-sm text-neutral-700">
                  Archivo del bordado
                </span>
                {archivo_bordado_url ? (
                  <a
                    href={archivo_bordado_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    Descargar
                  </a>
                ) : (
                  <span className="text-sm text-neutral-400">Sin archivo</span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
                <span className="text-sm text-neutral-700">
                  Matriz{matriz ? `: ${matriz.nombre}` : ""}
                </span>
                {matriz?.archivo_url ? (
                  <a
                    href={matriz.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    Descargar matriz
                  </a>
                ) : (
                  <span className="text-sm text-neutral-400">
                    {matriz ? "Sin archivo" : "Sin matriz"}
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Barra lateral */}
        <div className="space-y-6">
          {/* PRODUCCIÓN */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Producción</h2>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-neutral-400">
                  Estado
                </p>
                <EstadoSelectorDetalle
                  id={orden.id}
                  estado={orden.estado as EstadoProduccion}
                />
              </div>
              <dl className="space-y-3">
                <Dato label="Inicio producción" valor={fecha(orden.fecha_inicio)} />
                <Dato label="Fabricación" valor={fecha(orden.fecha_fabricacion)} />
              </dl>
            </div>
          </section>

          {/* COSTOS */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Costos</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Prenda</dt>
                <dd>{formatPrecio(orden.costo_prenda)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Matriz</dt>
                <dd>{formatPrecio(orden.costo_matriz)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Bordado</dt>
                <dd>{formatPrecio(orden.costo_bordado)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Otros</dt>
                <dd>{formatPrecio(orden.otros_costos)}</dd>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold text-neutral-900">
                <dt>Total</dt>
                <dd>{formatPrecio(orden.costo_total)}</dd>
              </div>
            </dl>
          </section>

          {/* HISTORIAL */}
          <section className={cardClase}>
            <h2 className={h2Clase}>Historial</h2>
            {historial.length === 0 ? (
              <p className="text-sm text-neutral-400">Sin movimientos.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {historial.map((h) => (
                  <li key={h.id} className="border-l-2 border-neutral-200 pl-3">
                    <p className="text-neutral-800">
                      {h.estado_anterior
                        ? `${labelEstado(h.estado_anterior)} → ${labelEstado(h.estado_nuevo ?? "")}`
                        : `Creada como ${labelEstado(h.estado_nuevo ?? "")}`}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {fecha(h.created_at)}
                      {h.usuario ? ` · ${h.usuario}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
