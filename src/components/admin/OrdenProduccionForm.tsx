"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Product, Matriz, Cliente, ProductVariante } from "@/lib/types";
import { nombreCompleto } from "@/lib/types";
import { formatPrecio, labelCategoria } from "@/lib/constants";
import { createOrdenProduccion } from "@/app/admin/produccion-actions";
import ProduccionFileInput from "./ProduccionFileInput";

type MatrizModo = "ninguna" | "existente" | "nueva";

/** Formulario para crear una orden de producción de bordado. */
export default function OrdenProduccionForm({
  products,
  matrices,
  clientes,
  variantes,
}: {
  products: Product[];
  matrices: Matriz[];
  clientes: Cliente[];
  variantes: ProductVariante[];
}) {
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);

  // Pedido
  const [pedidoRef, setPedidoRef] = useState("");
  const [cliente, setCliente] = useState("");
  const [clienteId, setClienteId] = useState("");

  function elegirCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c) setCliente(nombreCompleto(c));
  }
  const [fecha, setFecha] = useState(hoy);
  const [modelo, setModelo] = useState(""); // nombre del producto (o "__mano__")
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

  // Cascada: modelo (nombre) → color (producto) → talle (variante), solo con stock
  const modelos = useMemo(() => {
    const m = new Map<
      string,
      { nombre: string; categoria: string; stock: number }
    >();
    products.forEach((p) => {
      const e = m.get(p.nombre) ?? {
        nombre: p.nombre,
        categoria: p.categoria,
        stock: 0,
      };
      e.stock += p.stock;
      m.set(p.nombre, e);
    });
    return [...m.values()]
      .filter((x) => x.stock > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [products]);

  const coloresModelo = useMemo(() => {
    if (!modelo || modelo === "__mano__") return [];
    return products
      .filter((p) => p.nombre === modelo && p.stock > 0)
      .map((p) => ({ color: p.colores[0] ?? "", productId: p.id, stock: p.stock }))
      .sort((a, b) => a.color.localeCompare(b.color));
  }, [products, modelo]);

  const tallesColor = useMemo(() => {
    if (!productId) return [];
    return variantes
      .filter((v) => v.product_id === productId && v.stock > 0)
      .map((v) => ({ talle: v.talle, stock: v.stock }))
      .sort((a, b) => a.talle.localeCompare(b.talle));
  }, [variantes, productId]);

  const esManual = modelo === "__mano__";

  function elegirModelo(v: string) {
    setColor("");
    setTalle("");
    setProductId("");
    if (v === "__mano__") {
      setModelo("__mano__");
      setPrenda("");
      setTipoPrenda("");
      return;
    }
    setModelo(v);
    const first = products.find((p) => p.nombre === v);
    setPrenda(v);
    setTipoPrenda(first ? labelCategoria(first.categoria) : "");
  }

  function elegirColorProducto(pid: string) {
    setProductId(pid);
    const p = products.find((x) => x.id === pid);
    setColor(p?.colores[0] ?? "");
    setCostoPrenda(String(p?.costo || ""));
    const ts = variantes.filter((v) => v.product_id === pid && v.stock > 0);
    setTalle(ts.length === 1 ? ts[0].talle : "");
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

    if (!esManual && modelo) {
      if (!productId) {
        setError("Elegí el color de la prenda.");
        return;
      }
      if (tallesColor.length > 0 && !talle) {
        setError("Elegí el talle.");
        return;
      }
    }

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
        cliente_id: clienteId || null,
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
            {clientes.length > 0 && (
              <select
                value={clienteId}
                onChange={(e) => elegirCliente(e.target.value)}
                className={input + " mb-2"}
              >
                <option value="">— Elegir del master —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nombreCompleto(c)}
                  </option>
                ))}
              </select>
            )}
            <input
              value={cliente}
              onChange={(e) => {
                setCliente(e.target.value);
                setClienteId("");
              }}
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

        {/* 1) Modelo (siempre trae lo que hay en stock) */}
        <div>
          <label className={label}>Prenda</label>
          <select
            value={modelo}
            onChange={(e) => elegirModelo(e.target.value)}
            className={input}
          >
            <option value="">— Elegí la prenda —</option>
            {modelos.map((m) => (
              <option key={m.nombre} value={m.nombre}>
                {m.nombre} — {m.stock} en stock
              </option>
            ))}
            <option value="__mano__">Otra (escribir a mano)</option>
          </select>
        </div>

        {/* 2) A mano */}
        {esManual && (
          <div className="space-y-6">
            <div>
              <label className={label}>Nombre de la prenda</label>
              <input
                value={prenda}
                onChange={(e) => setPrenda(e.target.value)}
                className={input}
                placeholder="Ej: Remera oversize"
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
          </div>
        )}

        {/* 2) Con producto: color → talle (solo con stock) */}
        {modelo && !esManual && (
          <div className="grid gap-6 sm:grid-cols-4">
            <div>
              <label className={label}>Color</label>
              <select
                value={productId}
                onChange={(e) => elegirColorProducto(e.target.value)}
                className={input}
              >
                <option value="">Elegir color</option>
                {coloresModelo.map((c) => (
                  <option key={c.productId} value={c.productId}>
                    {c.color || "—"} ({c.stock} en stock)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Talle</label>
              <select
                value={talle}
                onChange={(e) => setTalle(e.target.value)}
                className={input}
                disabled={!productId}
              >
                <option value="">Elegir talle</option>
                {tallesColor.map((t) => (
                  <option key={t.talle} value={t.talle}>
                    {t.talle || "Único"} ({t.stock} en stock)
                  </option>
                ))}
              </select>
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
            <div className="flex items-end pb-1">
              <p className="text-xs text-neutral-500">
                Se descuenta esta variante del stock al crear la orden.
              </p>
            </div>
          </div>
        )}
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
