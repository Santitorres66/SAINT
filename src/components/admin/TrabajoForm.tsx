"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Cliente, TrabajoGaleria, TrabajoInput } from "@/lib/types";
import { nombreCompleto } from "@/lib/types";
import { etiquetaProducto } from "@/lib/catalogo";
import ImageUploader from "./ImageUploader";
import Buscador from "./Buscador";
import { createTrabajo, updateTrabajo } from "@/app/admin/galeria-actions";

/**
 * Carga y edición de un trabajo de la galería.
 *
 * Lo único obligatorio es la foto. Todo lo demás —el título, la historia, el
 * nombre del cliente— suma, pero si esperás a tener el texto perfecto la
 * galería no se llena nunca, y una foto sin título vale mil veces más que una
 * galería vacía.
 */
export default function TrabajoForm({
  trabajo,
  productos,
  clientes,
}: {
  /** Si viene, se edita; si no, se carga uno nuevo. */
  trabajo?: TrabajoGaleria;
  /** El catálogo, para poder enlazar el trabajo con la prenda que se vende. */
  productos: { id: string; nombre: string; colores: string[] }[];
  /** El master de clientes, para no tener que escribir el nombre de memoria. */
  clientes: Cliente[];
}) {
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [imagenes, setImagenes] = useState<string[]>(trabajo?.imagenes ?? []);
  const [titulo, setTitulo] = useState(trabajo?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(trabajo?.descripcion ?? "");
  const [cliente, setCliente] = useState(trabajo?.cliente ?? "");
  const [prenda, setPrenda] = useState(trabajo?.prenda ?? "");
  const [productId, setProductId] = useState(trabajo?.product_id ?? "");
  const [destacado, setDestacado] = useState(trabajo?.destacado ?? false);
  const [orden, setOrden] = useState(String(trabajo?.orden ?? 0));
  const [activo, setActivo] = useState(trabajo?.activo ?? true);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: TrabajoInput = {
      titulo,
      descripcion,
      imagenes,
      cliente,
      prenda,
      product_id: productId || null,
      destacado,
      orden: Number(orden) || 0,
      activo,
    };

    startTransition(async () => {
      const res = trabajo
        ? await updateTrabajo(trabajo.id, input)
        : await createTrabajo(input);
      // Si salió bien, la action redirige al listado y esto no se ejecuta.
      if (res?.error) setError(res.error);
    });
  }

  const opcionesProductos = productos.map((p) => ({
    value: p.id,
    label: etiquetaProducto(p),
  }));

  const opcionesClientes = clientes.map((c) => ({
    value: c.id,
    label: nombreCompleto(c),
  }));

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* LAS FOTOS: lo primero, porque es lo único imprescindible */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-medium">Fotos del trabajo *</h2>
          <p className="mt-1 text-sm text-neutral-500">
            La prenda terminada, y mejor todavía si está puesta. La primera foto
            es la que se ve en el mosaico de la galería.
          </p>
        </div>
        <ImageUploader value={imagenes} onChange={setImagenes} />
      </section>

      {/* LA HISTORIA */}
      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <label htmlFor="titulo" className={labelClase}>
            Título
          </label>
          <input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClase}
            placeholder="Ej: Retrato de Cuca en el pecho"
          />
        </div>

        <div>
          <label htmlFor="descripcion" className={labelClase}>
            La historia
          </label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className={inputClase}
            placeholder="Qué pidió, para qué era, algún detalle del bordado."
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            Dos renglones alcanzan. Lo que hace que una foto emocione es la
            historia, no la ficha técnica.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="cliente" className={labelClase}>
              Cliente
            </label>
            {/* Busca en el master, pero deja escribir libre: el trabajo puede
                ser de alguien que nunca cargaste como cliente. */}
            <Buscador
              id="cliente"
              opciones={opcionesClientes}
              value=""
              textoLibre={cliente}
              libre
              onSelect={(o) => setCliente(o?.label ?? "")}
              placeholder="Buscá o escribí el nombre"
              vacio="— Sin nombrar —"
            />
            <p className="mt-1.5 text-xs text-neutral-400">
              Dejalo vacío si no te dio permiso para nombrarla.
            </p>
          </div>

          <div>
            <label htmlFor="prenda" className={labelClase}>
              Prenda
            </label>
            <input
              id="prenda"
              value={prenda}
              onChange={(e) => setPrenda(e.target.value)}
              className={inputClase}
              placeholder="Ej: Buzo oversize negro"
            />
          </div>
        </div>

        <div>
          <label htmlFor="producto" className={labelClase}>
            Prenda del catálogo (opcional)
          </label>
          <Buscador
            id="producto"
            opciones={opcionesProductos}
            value={productId}
            onSelect={(o) => setProductId(o?.value ?? "")}
            placeholder="Buscá la prenda por nombre o color"
            vacio="— Sin enlazar —"
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            Si la enlazás, la foto lleva un botón para comprar esa misma prenda.
            Es el camino más corto entre “qué lindo” y el carrito.
          </p>
        </div>
      </section>

      {/* DÓNDE Y CUÁNDO SE VE */}
      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={destacado}
            onChange={(e) => setDestacado(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium text-neutral-700">
              Mostrar en la home
            </span>
            <span className="text-xs text-neutral-400">
              Los destacados son los que se ven en la portada. Si no marcás
              ninguno, la home muestra los últimos cargados.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium text-neutral-700">
              Visible en la web
            </span>
            <span className="text-xs text-neutral-400">
              Destildalo para ocultarlo sin perderlo.
            </span>
          </span>
        </label>

        <div className="max-w-[12rem]">
          <label htmlFor="orden" className={labelClase}>
            Orden
          </label>
          <input
            id="orden"
            type="number"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className={inputClase}
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            Más chico, más arriba. Con 0 en todos, manda lo más nuevo.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : trabajo ? "Guardar cambios" : "Publicar trabajo"}
        </button>
        <Link
          href="/admin/galeria"
          className="text-sm text-neutral-500 transition hover:text-neutral-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
