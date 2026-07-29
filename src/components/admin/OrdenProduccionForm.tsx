"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Product, Matriz } from "@/lib/types";
import { formatPrecio, labelCategoria } from "@/lib/constants";
import { createOrdenProduccion } from "@/app/admin/produccion-actions";
import ProduccionFileInput from "./ProduccionFileInput";

type MatrizModo = "ninguna" | "existente" | "nueva";

/** Formulario para crear una orden de producción de bordado. */
export default function OrdenProduccionForm({
  products,
  matrices,
}: {
  products: Product[];
  matrices: Matriz[];
}) {
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);

  // Pedido
  const [pedidoRef, setPedidoRef] = useState("");
  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [productId, setProductId] = useState("");
  const [prenda, setPrenda] = useState("");
  const [tipoPrenda, setTipoPrenda] = useState("");
  const [talle, setTalle] = useState("");
  const [color, setColor] = useState("");
  const [cantidad, setCantidad] = useState("1");

  // Bordado
  const [bDescripcion, setBDescripcion] = useState("");
  const [bUbicacion, setBUbicacion] = useState("");
  const [bTamano, setBTamano] = useState("");
  const [bColores, setBColores] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Archivos
  const [imagenRef, setImagenRef] = useState<string | null>(null);
  const [archivoBordado, setArchivoBordado] = useState<string | null>(null);

  // Matriz
  const [matrizModo, setMatrizModo] = useState<MatrizModo>("ninguna");
  const [matrizId, setMatrizId] = useState("");
  const [mNombre, setMNombre] = useState("");
  const [mCosto, setMCosto] = useState("");
  const [mObs, setMObs] = useState("");
  const [mImagen, setMImagen] = useState<string | null>(null);
  const [mArchivo, setMArchivo] = useState<string | null>(null);

  // Costos
  const [costoPrenda, setCostoPrenda] = useState("");
  const [costoMatriz, setCostoMatriz] = useState("");
  const [costoBordado, setCostoBordado] = useState("");
  const [otrosCostos, setOtrosCostos] = useState("");

  function elegirProducto(id: string) {
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setPrenda(prod.nombre);
      setTipoPrenda(labelCategoria(prod.categoria));
      if (!costoPrenda) setCostoPrenda(String(prod.costo || ""));
    }
  }

  function cambiarMatrizModo(modo: MatrizModo) {
    setMatrizModo(modo);
    // Al reutilizar una matriz existente NO se recobra el costo de matriz
    if (modo === "existente") setCostoMatriz("0");
    if (modo === "ninguna") setCostoMatriz("");
  }

  const costoTotal =
    (Number(costoPrenda) || 0) +
    (Number(costoMatriz) || 0) +
    (Number(costoBordado) || 0) +
    (Number(otrosCostos) || 0);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (matrizModo === "existente" && !matrizId) {
      setError("Elegí una matriz de la lista o cambiá la opción.");
      return;
    }
    if (matrizModo === "nueva" && !mNombre.trim()) {
      setError("Poné un nombre para la matriz nueva.");
      return;
    }

    startTransition(async () => {
      const res = await createOrdenProduccion({
        pedido_referencia: pedidoRef,
        cliente,
        fecha,
        product_id: productId || null,
        prenda,
        tipo_prenda: tipoPrenda,
        talle,
        color,
        cantidad: Number(cantidad) || 1,
        bordado_descripcion: bDescripcion,
        bordado_ubicacion: bUbicacion,
        bordado_tamano: bTamano,
        bordado_colores: Number(bColores) || 0,
        observaciones,
        imagen_ref_path: imagenRef,
        archivo_bordado_path: archivoBordado,
        matriz_modo: matrizModo,
        matriz_id: matrizModo === "existente" ? matrizId : null,
        matriz_nueva:
          matrizModo === "nueva"
            ? {
                nombre: mNombre,
                costo: Number(mCosto) || 0,
                observaciones: mObs,
                imagen_path: mImagen,
                archivo_path: mArchivo,
              }
            : null,
        costo_prenda: Number(costoPrenda) || 0,
        costo_matriz: Number(costoMatriz) || 0,
        costo_bordado: Number(costoBordado) || 0,
        otros_costos: Number(otrosCostos) || 0,
      });
      if (res?.error) setError(res.error);
    });
  }

  const label = "mb-1.5 block text-sm font-medium text-neutral-700";
  const input =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";
  const h2 = "text-lg font-semibold text-neutral-900";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* PEDIDO */}
      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className={h2}>Pedido</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label className={label}>N° de pedido relacionado</label>
            <input
              value={pedidoRef}
              onChange={(e) => setPedidoRef(e.target.value)}
              className={input}
              placeholder="Ej: venta #123 (opcional)"
            />
          </div>
          <div>
            <label className={label}>Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className={input}
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <label className={label}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div>
          <label className={label}>Prenda (elegí un producto o escribila)</label>
          <select
            value={productId}
            onChange={(e) => elegirProducto(e.target.value)}
            className={input + " mb-2"}
          >
            <option value="">— Sin producto (escribir a mano) —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            value={prenda}
            onChange={(e) => setPrenda(e.target.value)}
            className={input}
            placeholder="Nombre de la prenda"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-4">
          <div>
            <label className={label}>Tipo de prenda</label>
            <input
              value={tipoPrenda}
              onChange={(e) => setTipoPrenda(e.target.value)}
              className={input}
              placeholder="Ej: Remera"
            />
          </div>
          <div>
            <label className={label}>Talle</label>
            <input
              value={talle}
              onChange={(e) => setTalle(e.target.value)}
              className={input}
              placeholder="Ej: L"
            />
          </div>
          <div>
            <label className={label}>Color</label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={input}
              placeholder="Ej: Negro"
            />
          </div>
          <div>
            <label className={label}>Cantidad</label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={input}
            />
          </div>
        </div>
      </section>

      {/* BORDADO */}
      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className={h2}>Bordado</h2>
        <div>
          <label className={label}>Nombre / descripción del bordado</label>
          <input
            value={bDescripcion}
            onChange={(e) => setBDescripcion(e.target.value)}
            className={input}
            placeholder="Ej: Logo empresa / Iniciales JC"
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label className={label}>Ubicación</label>
            <input
              list="ubicaciones"
              value={bUbicacion}
              onChange={(e) => setBUbicacion(e.target.value)}
              className={input}
              placeholder="Pecho, espalda, manga…"
            />
            <datalist id="ubicaciones">
              <option value="Pecho izquierdo" />
              <option value="Pecho" />
              <option value="Espalda" />
              <option value="Manga" />
              <option value="Gorra (frente)" />
            </datalist>
          </div>
          <div>
            <label className={label}>Tamaño aproximado</label>
            <input
              value={bTamano}
              onChange={(e) => setBTamano(e.target.value)}
              className={input}
              placeholder="Ej: 8 x 5 cm"
            />
          </div>
          <div>
            <label className={label}>Cantidad de colores</label>
            <input
              type="number"
              min="0"
              value={bColores}
              onChange={(e) => setBColores(e.target.value)}
              className={input}
              placeholder="Ej: 3"
            />
          </div>
        </div>
        <div>
          <label className={label}>Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className={input}
            placeholder="Detalles para producción…"
          />
        </div>
      </section>

      {/* ARCHIVOS */}
      <section className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <ProduccionFileInput
          label="Imagen de referencia del bordado"
          value={imagenRef}
          onChange={setImagenRef}
          carpeta="ordenes"
          accept="image/*"
          esImagen
          ayuda="JPG, PNG o WEBP"
        />
        <ProduccionFileInput
          label="Archivo del bordado"
          value={archivoBordado}
          onChange={setArchivoBordado}
          carpeta="ordenes"
          accept=".dst,.emb,.pdf,.png,.jpg,.jpeg,.zip"
          ayuda="DST, EMB, PDF, PNG, JPG o ZIP"
        />
      </section>

      {/* MATRIZ */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className={h2}>Matriz</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ninguna", "Sin matriz"],
              ["existente", "Usar existente"],
              ["nueva", "Matriz nueva"],
            ] as [MatrizModo, string][]
          ).map(([modo, txt]) => (
            <button
              key={modo}
              type="button"
              onClick={() => cambiarMatrizModo(modo)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                matrizModo === modo
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {txt}
            </button>
          ))}
        </div>

        {matrizModo === "existente" && (
          <div>
            <label className={label}>Elegí la matriz</label>
            <select
              value={matrizId}
              onChange={(e) => setMatrizId(e.target.value)}
              className={input}
            >
              <option value="">— Elegir —</option>
              {matrices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-400">
              Al reutilizar una matriz no se vuelve a cobrar su costo.
            </p>
          </div>
        )}

        {matrizModo === "nueva" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Nombre de la matriz</label>
                <input
                  value={mNombre}
                  onChange={(e) => setMNombre(e.target.value)}
                  className={input}
                  placeholder="Ej: Logo empresa XYZ"
                />
              </div>
              <div>
                <label className={label}>Costo de realización</label>
                <input
                  type="number"
                  min="0"
                  value={mCosto}
                  onChange={(e) => {
                    setMCosto(e.target.value);
                    setCostoMatriz(e.target.value);
                  }}
                  className={input}
                  placeholder="Ej: 8000"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProduccionFileInput
                label="Imagen de la matriz"
                value={mImagen}
                onChange={setMImagen}
                carpeta="matrices"
                accept="image/*"
                esImagen
              />
              <ProduccionFileInput
                label="Archivo de la matriz"
                value={mArchivo}
                onChange={setMArchivo}
                carpeta="matrices"
                accept=".dst,.emb,.pdf,.png,.jpg,.jpeg,.zip"
              />
            </div>
            <div>
              <label className={label}>Observaciones de la matriz</label>
              <input
                value={mObs}
                onChange={(e) => setMObs(e.target.value)}
                className={input}
              />
            </div>
          </div>
        )}
      </section>

      {/* COSTOS */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className={h2}>Costos</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className={label}>Costo prenda</label>
            <input
              type="number"
              min="0"
              value={costoPrenda}
              onChange={(e) => setCostoPrenda(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Costo matriz</label>
            <input
              type="number"
              min="0"
              value={costoMatriz}
              onChange={(e) => setCostoMatriz(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Costo bordado</label>
            <input
              type="number"
              min="0"
              value={costoBordado}
              onChange={(e) => setCostoBordado(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Otros costos</label>
            <input
              type="number"
              min="0"
              value={otrosCostos}
              onChange={(e) => setOtrosCostos(e.target.value)}
              className={input}
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <span className="text-sm text-neutral-500">Costo total</span>
          <span className="text-xl font-semibold text-neutral-900">
            {formatPrecio(costoTotal)}
          </span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/produccion"
          className="rounded-xl border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-neutral-900 px-8 py-3 text-base font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Crear orden de producción"}
        </button>
      </div>
    </form>
  );
}
