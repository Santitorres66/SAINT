"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Product,
  ProductInput,
  Categoria,
  Molde,
  ProductVariante,
  VarianteInput,
  StockCorreccion,
} from "@/lib/types";
import {
  CATEGORIAS,
  CATEGORIAS_CON_MOLDE,
  MOLDES,
  MOLDE_POR_DEFECTO,
  TALLES_SUGERIDOS,
  COLORES_SUGERIDOS,
} from "@/lib/constants";
import { createProduct, updateProduct } from "@/app/admin/actions";
import ImageUploader from "./ImageUploader";

function formatFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * Formulario para CREAR o EDITAR un producto.
 * Pensado para uso no técnico: campos con textos guía, validaciones amables
 * y controles simples (botones y chips en vez de escribir listas separadas por comas).
 *
 * En edición, el stock no se "edita": se CORRIGE. Cambiar un número exige un
 * motivo y queda asentado, porque el movimiento normal del stock son las
 * compras, las ventas y las pérdidas.
 */
export default function ProductForm({
  initial,
  variantesIniciales,
  correccionesPrevias = [],
}: {
  /** Si viene, el formulario está en modo edición. */
  initial?: Product;
  /** Stock por variante existente (en edición). */
  variantesIniciales?: ProductVariante[];
  /** Historial de correcciones manuales de este producto. */
  correccionesPrevias?: StockCorreccion[];
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
  const [molde, setMolde] = useState<Molde>(
    initial?.molde ?? MOLDE_POR_DEFECTO,
  );
  // Sólo algunas categorías vienen en más de un molde; en el resto el selector
  // no se muestra y el valor queda en el molde por defecto.
  const eligeMolde = CATEGORIAS_CON_MOLDE.includes(categoria);
  const [precio, setPrecio] = useState(String(initial?.precio ?? ""));
  const [costo, setCosto] = useState(String(initial?.costo ?? ""));
  // Stock por variante (talle + color). Clave: `${talle}|||${color}`
  const [stockVar, setStockVar] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    (variantesIniciales ?? []).forEach((v) => {
      m[`${v.talle}|||${v.color}`] = String(v.stock);
    });
    return m;
  });
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

  // --- Combinaciones de stock (talle × color) ---
  const keyVar = (t: string, c: string) => `${t}|||${c}`;
  const tallesEff = talles.length ? talles : [""];
  const coloresEff = colores.length ? colores : [""];
  const combos = tallesEff.flatMap((t) =>
    coloresEff.map((c) => ({ talle: t, color: c })),
  );
  const totalStock = combos.reduce(
    (a, cmb) => a + (Number(stockVar[keyVar(cmb.talle, cmb.color)]) || 0),
    0,
  );

  /* --- Correcciones de stock ---
     El stock de una variante que ya existe no se edita "a mano": se corrige.
     Guardamos el valor con el que abrió el formulario para saber qué cambió
     de verdad y pedir el motivo solo en ese caso. */
  const stockOriginal = new Map(
    (variantesIniciales ?? []).map((v) => [keyVar(v.talle, v.color), v.stock]),
  );
  const [motivo, setMotivo] = useState("");

  /** Variantes ya existentes cuyo número cambió respecto del original. */
  const correcciones = combos
    .filter((c) => stockOriginal.has(keyVar(c.talle, c.color)))
    .map((c) => {
      const k = keyVar(c.talle, c.color);
      const anterior = stockOriginal.get(k)!;
      const nuevo = Number(stockVar[k]) || 0;
      return { talle: c.talle, color: c.color, anterior, nuevo };
    })
    .filter((c) => c.nuevo !== c.anterior);

  const hayCorrecciones = correcciones.length > 0;

  // --- Envío ---
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (hayCorrecciones && !motivo.trim()) {
      setError(
        "Estás corrigiendo el stock: escribí el motivo (por qué no coincidía).",
      );
      return;
    }

    const variantes: VarianteInput[] = combos.map((c) => ({
      talle: c.talle,
      color: c.color,
      stock: Number(stockVar[keyVar(c.talle, c.color)]) || 0,
    }));

    const input: ProductInput = {
      nombre,
      categoria,
      molde: eligeMolde ? molde : MOLDE_POR_DEFECTO,
      precio: Number(precio),
      costo: Number(costo) || 0,
      stock: totalStock,
      descripcion,
      colores,
      talles,
      imagenes,
      activo,
    };

    startTransition(async () => {
      const res = esEdicion
        ? await updateProduct(
            initial!.id,
            input,
            variantes,
            correcciones.map((c) => ({
              talle: c.talle,
              color: c.color,
              stock_nuevo: c.nuevo,
            })),
            motivo,
          )
        : await createProduct(input, variantes);
      // Si hubo error lo mostramos; si salió bien, la action redirige.
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

        {eligeMolde && (
          <div>
            <label htmlFor="molde" className={labelClase}>
              Molde *
            </label>
            <select
              id="molde"
              value={molde}
              onChange={(e) => setMolde(e.target.value as Molde)}
              className={inputClase}
            >
              {MOLDES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-sm text-neutral-500">
              Define qué tabla de talles ve el cliente en la web.
            </p>
          </div>
        )}

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

      {/* Stock por variante */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            {esEdicion ? "Corrección de stock" : "Stock inicial"}
          </h2>
          <p className="text-sm text-neutral-500">
            {esEdicion ? (
              <>
                El stock se mueve solo: <strong>suma</strong> con las compras y{" "}
                <strong>resta</strong> con las ventas y las pérdidas. Tocá estos
                números únicamente para corregir una diferencia con lo que
                contaste en el depósito — queda registrada con su motivo.
              </>
            ) : (
              <>
                Cargá cuántas unidades tenés hoy de cada combinación. El total se
                calcula solo. (Si agregás/quitás talles o colores, la grilla se
                actualiza.)
              </>
            )}
          </p>
        </div>

        <div className="space-y-2">
          {combos.map((c) => {
            const k = keyVar(c.talle, c.color);
            const etiqueta =
              [c.talle, c.color].filter(Boolean).join(" · ") || "General";
            const anterior = stockOriginal.get(k);
            const esNueva = anterior === undefined;
            const nuevo = Number(stockVar[k]) || 0;
            const delta = esNueva ? 0 : nuevo - anterior;

            return (
              <div
                key={k}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2 ${
                  delta !== 0 ? "bg-amber-50" : "bg-neutral-50"
                }`}
              >
                <span className="text-sm text-neutral-700">
                  {etiqueta}
                  {esEdicion && esNueva && (
                    <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
                      combinación nueva
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-3">
                  {esEdicion && !esNueva && (
                    <span className="text-xs text-neutral-500">
                      en sistema: <strong>{anterior}</strong>
                    </span>
                  )}
                  {delta !== 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        delta > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                  <input
                    type="number"
                    min="0"
                    value={stockVar[k] ?? ""}
                    onChange={(e) =>
                      setStockVar((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    placeholder="0"
                    aria-label={`Stock de ${etiqueta}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
          <span className="text-neutral-500">Stock total</span>
          <span className="font-semibold text-neutral-900">{totalStock} u.</span>
        </div>

        {/* Motivo: obligatorio en cuanto un número cambió */}
        {hayCorrecciones && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              Vas a corregir{" "}
              <strong>
                {correcciones.length}{" "}
                {correcciones.length === 1 ? "variante" : "variantes"}
              </strong>
              :{" "}
              {correcciones
                .map((c) => {
                  const et =
                    [c.talle, c.color].filter(Boolean).join(" · ") || "General";
                  return `${et} ${c.anterior} → ${c.nuevo}`;
                })
                .join(", ")}
              .
            </p>
            <div>
              <label htmlFor="motivo" className={labelClase}>
                Motivo de la corrección *
              </label>
              <textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                className={inputClase}
                placeholder="Ej: conteo de depósito, se habían cargado mal 2 unidades, devolución de un cliente…"
              />
              <p className="mt-1 text-xs text-amber-800">
                Queda guardado con tu usuario y la fecha, para saber después por
                qué cambió el número.
              </p>
            </div>
          </div>
        )}

        {/* Historial */}
        {esEdicion && correccionesPrevias.length > 0 && (
          <details className="border-t border-neutral-100 pt-3">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600">
              Correcciones anteriores ({correccionesPrevias.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {correccionesPrevias.map((c) => {
                const et =
                  [c.talle, c.color].filter(Boolean).join(" · ") || "General";
                return (
                  <li
                    key={c.id}
                    className="rounded-lg bg-neutral-50 px-4 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-neutral-700">
                        {et}: {c.stock_anterior} → {c.stock_nuevo}{" "}
                        <span
                          className={
                            c.diferencia > 0
                              ? "text-emerald-700"
                              : "text-red-600"
                          }
                        >
                          ({c.diferencia > 0 ? `+${c.diferencia}` : c.diferencia}
                          )
                        </span>
                      </span>
                      <span className="text-xs text-neutral-400">
                        {formatFechaHora(c.created_at)}
                        {c.usuario ? ` · ${c.usuario}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">{c.motivo}</p>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
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
