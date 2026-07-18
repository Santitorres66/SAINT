"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Product, ProductInput, Categoria } from "@/lib/types";
import {
  CATEGORIAS,
  TALLES_SUGERIDOS,
  COLORES_SUGERIDOS,
} from "@/lib/constants";
import { createProduct, updateProduct } from "@/app/admin/actions";
import ImageUploader from "./ImageUploader";

/**
 * Formulario para CREAR o EDITAR un producto.
 * Pensado para uso no técnico: campos con textos guía, validaciones amables
 * y controles simples (botones y chips en vez de escribir listas separadas por comas).
 */
export default function ProductForm({
  initial,
}: {
  /** Si viene, el formulario está en modo edición. */
  initial?: Product;
}) {
  const router = useRouter();
  const esEdicion = Boolean(initial);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // --- Estado del formulario ---
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [categoria, setCategoria] = useState<Categoria>(
    initial?.categoria ?? "buzo",
  );
  const [precio, setPrecio] = useState(String(initial?.precio ?? ""));
  const [costo, setCosto] = useState(String(initial?.costo ?? ""));
  const [stock, setStock] = useState(String(initial?.stock ?? "0"));
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [colores, setColores] = useState<string[]>(initial?.colores ?? []);
  const [talles, setTalles] = useState<string[]>(initial?.talles ?? []);
  const [imagenes, setImagenes] = useState<string[]>(initial?.imagenes ?? []);
  const [activo, setActivo] = useState<boolean>(initial?.activo ?? true);

  // Inputs auxiliares para agregar colores / talles a mano
  const [nuevoColor, setNuevoColor] = useState("");
  const [nuevoTalle, setNuevoTalle] = useState("");

  // --- Helpers de colores ---
  function agregarColor(valor: string) {
    const v = valor.trim();
    if (v && !colores.includes(v)) setColores([...colores, v]);
    setNuevoColor("");
  }
  function quitarColor(c: string) {
    setColores(colores.filter((x) => x !== c));
  }

  // --- Helpers de talles ---
  function toggleTalle(t: string) {
    setTalles(talles.includes(t) ? talles.filter((x) => x !== t) : [...talles, t]);
  }
  function agregarTalle(valor: string) {
    const v = valor.trim();
    if (v && !talles.includes(v)) setTalles([...talles, v]);
    setNuevoTalle("");
  }

  // --- Envío ---
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: ProductInput = {
      nombre,
      categoria,
      precio: Number(precio),
      costo: Number(costo) || 0,
      stock: Number(stock),
      descripcion,
      colores,
      talles,
      imagenes,
      activo,
    };

    startTransition(async () => {
      const res = esEdicion
        ? await updateProduct(initial!.id, input)
        : await createProduct(input);
      // Si hubo error lo mostramos; si salió bien, la action redirige a /admin.
      if (res?.error) setError(res.error);
    });
  }

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Datos básicos */}
      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          Datos del producto
        </h2>

        <div>
          <label htmlFor="nombre" className={labelClase}>
            Nombre *
          </label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputClase}
            placeholder="Ej: Buzo oversized negro"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="categoria" className={labelClase}>
              Categoría *
            </label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className={inputClase}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="stock" className={labelClase}>
              Stock (unidades) *
            </label>
            <input
              id="stock"
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={inputClase}
              placeholder="Ej: 10"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="precio" className={labelClase}>
              Precio de venta (en pesos) *
            </label>
            <input
              id="precio"
              type="number"
              min="0"
              step="1"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className={inputClase}
              placeholder="Ej: 45000"
            />
          </div>

          <div>
            <label htmlFor="costo" className={labelClase}>
              Precio de costo (opcional)
            </label>
            <input
              id="costo"
              type="number"
              min="0"
              step="1"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              className={inputClase}
              placeholder="Ej: 18000"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Lo que te sale comprarlo. Sirve para calcular tu ganancia. Se
              actualiza solo cuando cargás una compra.
            </p>
          </div>
        </div>

        {/* Ganancia calculada */}
        {Number(precio) > 0 && Number(costo) > 0 && (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Ganancia por unidad:{" "}
            <strong>${(Number(precio) - Number(costo)).toLocaleString("es-AR")}</strong>
            {Number(precio) > 0 && (
              <span className="text-emerald-700">
                {" "}
                (
                {Math.round(
                  ((Number(precio) - Number(costo)) / Number(precio)) * 100,
                )}
                % del precio)
              </span>
            )}
          </div>
        )}

        <div>
          <label htmlFor="descripcion" className={labelClase}>
            Descripción
          </label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            className={inputClase}
            placeholder="Contá los detalles de la prenda: material, calce, etc."
          />
        </div>
      </section>

      {/* Talles */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Talles</h2>
          <p className="text-sm text-neutral-500">
            Tocá los talles disponibles. Podés agregar uno personalizado si hace
            falta.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TALLES_SUGERIDOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTalle(t)}
              className={`min-w-[3rem] rounded-lg border px-4 py-2 text-sm font-medium transition ${
                talles.includes(t)
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t}
            </button>
          ))}
          {/* Talles personalizados ya agregados que no están en la lista */}
          {talles
            .filter((t) => !TALLES_SUGERIDOS.includes(t))
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTalle(t)}
                className="min-w-[3rem] rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                {t} ✕
              </button>
            ))}
        </div>

        <div className="flex gap-2">
          <input
            value={nuevoTalle}
            onChange={(e) => setNuevoTalle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarTalle(nuevoTalle);
              }
            }}
            className={inputClase}
            placeholder="Otro talle (ej: 38)"
          />
          <button
            type="button"
            onClick={() => agregarTalle(nuevoTalle)}
            className="whitespace-nowrap rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Agregar
          </button>
        </div>
      </section>

      {/* Colores */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Colores</h2>
          <p className="text-sm text-neutral-500">
            Agregá los colores disponibles. Tocá una sugerencia o escribí el que
            quieras.
          </p>
        </div>

        {/* Colores elegidos */}
        {colores.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {colores.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white"
              >
                {c}
                <button
                  type="button"
                  onClick={() => quitarColor(c)}
                  className="text-white/70 hover:text-white"
                  aria-label={`Quitar ${c}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Sugerencias */}
        <div className="flex flex-wrap gap-2">
          {COLORES_SUGERIDOS.filter((c) => !colores.includes(c)).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => agregarColor(c)}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100"
            >
              + {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={nuevoColor}
            onChange={(e) => setNuevoColor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarColor(nuevoColor);
              }
            }}
            className={inputClase}
            placeholder="Otro color (ej: Bordó)"
          />
          <button
            type="button"
            onClick={() => agregarColor(nuevoColor)}
            className="whitespace-nowrap rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Agregar
          </button>
        </div>
      </section>

      {/* Imágenes */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Fotos</h2>
          <p className="text-sm text-neutral-500">
            Subí una o varias fotos del producto. Se guardan solas al elegirlas.
          </p>
        </div>
        <ImageUploader value={imagenes} onChange={setImagenes} />
      </section>

      {/* Visibilidad */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-lg font-semibold text-neutral-900">
              Mostrar en la web
            </span>
            <span className="text-sm text-neutral-500">
              Si lo apagás, el producto queda guardado pero no aparece en la
              tienda.
            </span>
          </span>
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="h-6 w-6 rounded border-neutral-300 accent-neutral-900"
          />
        </label>
      </section>

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/productos"
          className="rounded-xl border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-neutral-900 px-8 py-3 text-base font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {guardando
            ? "Guardando…"
            : esEdicion
              ? "Guardar cambios"
              : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
