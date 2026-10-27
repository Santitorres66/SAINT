"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type {
  Product,
  Matriz,
  Cliente,
  ProductVariante,
  OrdenProduccionVista,
  PrioridadProduccion,
} from "@/lib/types";
import { nombreCompleto } from "@/lib/types";
import {
  formatPrecio,
  labelCategoria,
  PRIORIDADES_PRODUCCION,
} from "@/lib/constants";
import {
  createOrdenProduccion,
  updateOrdenProduccion,
} from "@/app/admin/produccion-actions";
import ProduccionFileInput from "./ProduccionFileInput";
import Buscador from "./Buscador";

type MatrizModo = "ninguna" | "existente" | "nueva";

/** Formulario para crear o editar una orden de producción de bordado. */
export default function OrdenProduccionForm({
  products,
  matrices,
  clientes,
  variantes,
  orden,
}: {
  products: Product[];
  matrices: Matriz[];
  clientes: Cliente[];
  variantes: ProductVariante[];
  /** Si se pasa, el formulario edita esta orden en vez de crear una nueva. */
  orden?: OrdenProduccionVista;
}) {
  const editando = Boolean(orden);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);

  // Pedido
  const [pedidoRef, setPedidoRef] = useState(orden?.pedido_referencia ?? "");
  const [cliente, setCliente] = useState(orden?.cliente ?? "");
  const [clienteId, setClienteId] = useState(orden?.cliente_id ?? "");

  function elegirCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c) setCliente(nombreCompleto(c));
  }
  const [fecha, setFecha] = useState(orden?.fecha?.slice(0, 10) ?? hoy);
  const [prioridad, setPrioridad] = useState<PrioridadProduccion>(
    orden?.prioridad ?? "media",
  );
  const [fechaEntrega, setFechaEntrega] = useState(
    orden?.fecha_estimada_entrega?.slice(0, 10) ?? "",
  );
  /**
   * Servicio de bordado en vez de producción de una prenda propia. No tiene
   * nada que ver con el stock —un servicio puede salir del catálogo o hacerse
   * sobre la prenda del cliente—: lo que cambia es cómo se reporta el ingreso.
   */
  const [esServicio, setEsServicio] = useState(orden?.es_servicio ?? false);
  const [modelo, setModelo] = useState(""); // nombre del producto (o "__mano__")
  const [productId, setProductId] = useState("");
  const [prenda, setPrenda] = useState("");
  const [tipoPrenda, setTipoPrenda] = useState("");
  const [talle, setTalle] = useState("");
  const [color, setColor] = useState("");
  const [cantidad, setCantidad] = useState("1");

  // Bordado
  const [bDescripcion, setBDescripcion] = useState(
    orden?.bordado_descripcion ?? "",
  );
  const [bUbicacion, setBUbicacion] = useState(orden?.bordado_ubicacion ?? "");
  const [bTamano, setBTamano] = useState(orden?.bordado_tamano ?? "");
  const [bColores, setBColores] = useState(
    orden?.bordado_colores ? String(orden.bordado_colores) : "",
  );
  const [observaciones, setObservaciones] = useState(orden?.observaciones ?? "");

  // Archivos
  const [imagenRef, setImagenRef] = useState<string | null>(
    orden?.imagen_ref_path ?? null,
  );
  const [archivoBordado, setArchivoBordado] = useState<string | null>(
    orden?.archivo_bordado_path ?? null,
  );

  // Matriz
  const [matrizModo, setMatrizModo] = useState<MatrizModo>(
    orden?.matriz_id ? "existente" : "ninguna",
  );
  const [matrizId, setMatrizId] = useState(orden?.matriz_id ?? "");
  const [mNombre, setMNombre] = useState("");
  const [mCosto, setMCosto] = useState("");
  const [mObs, setMObs] = useState("");
  const [mImagen, setMImagen] = useState<string | null>(null);
  const [mArchivo, setMArchivo] = useState<string | null>(null);

  // Costos
  const [costoPrenda, setCostoPrenda] = useState(
    orden?.costo_prenda ? String(orden.costo_prenda) : "",
  );
  const [costoMatriz, setCostoMatriz] = useState(
    orden?.costo_matriz ? String(orden.costo_matriz) : "",
  );
  const [costoBordado, setCostoBordado] = useState(
    orden?.costo_bordado ? String(orden.costo_bordado) : "",
  );
  const [otrosCostos, setOtrosCostos] = useState(
    orden?.otros_costos ? String(orden.otros_costos) : "",
  );

  // Cascada: modelo (nombre) → color (producto) → talle (variante). Se listan
  // también las que no tienen stock: el pedido se puede tomar igual, con
  // aviso, y queda esperando que se reponga la prenda.
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
    // Primero lo que hay en stock, después lo que habría que reponer
    return [...m.values()].sort(
      (a, b) =>
        Number(b.stock > 0) - Number(a.stock > 0) ||
        a.nombre.localeCompare(b.nombre),
    );
  }, [products]);

  const coloresModelo = useMemo(() => {
    if (!modelo || modelo === "__mano__") return [];
    return products
      .filter((p) => p.nombre === modelo)
      .map((p) => ({ color: p.colores[0] ?? "", productId: p.id, stock: p.stock }))
      .sort((a, b) => a.color.localeCompare(b.color));
  }, [products, modelo]);

  // Los talles del producto más los que tengan variante cargada, con su stock
  // (0 si la variante no existe todavía).
  const tallesColor = useMemo(() => {
    if (!productId) return [];
    const stock = new Map<string, number>();
    products
      .find((p) => p.id === productId)
      ?.talles.forEach((t) => stock.set(t, 0));
    variantes
      .filter((v) => v.product_id === productId)
      .forEach((v) => stock.set(v.talle, (stock.get(v.talle) ?? 0) + v.stock));
    return [...stock.entries()]
      // El talle vacío (prenda sin talles) solo se lista si tiene stock,
      // como antes: si no, pediría elegir un talle que no existe.
      .filter(([talle, s]) => talle !== "" || s > 0)
      .map(([talle, s]) => ({ talle, stock: s }))
      .sort((a, b) => a.talle.localeCompare(b.talle));
  }, [products, variantes, productId]);

  // Aviso de stock para la variante elegida
  const [sinStock, setSinStock] = useState(false);
  const stockElegido =
    productId && (talle || tallesColor.length === 0)
      ? tallesColor.find((t) => t.talle === talle)?.stock ?? 0
      : null;
  const faltante =
    stockElegido === null
      ? 0
      : Math.max((Number(cantidad) || 1) - stockElegido, 0);

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
    const ts = new Set(
      [
        ...(p?.talles ?? []),
        ...variantes.filter((v) => v.product_id === pid).map((v) => v.talle),
      ].filter(Boolean),
    );
    setTalle(ts.size === 1 ? [...ts][0] : "");
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

    if (!editando && !esManual && modelo) {
      if (!productId) {
        setError("Elegí el color de la prenda.");
        return;
      }
      if (tallesColor.length > 0 && !talle) {
        setError("Elegí el talle.");
        return;
      }
      if (faltante > 0 && !sinStock) {
        setError(
          "No hay stock suficiente de esa prenda. Marcá “Tomar el pedido igual” para cargarlo y reponer después.",
        );
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

    const comun = {
      pedido_referencia: pedidoRef,
      cliente,
      cliente_id: clienteId || null,
      fecha,
      es_servicio: esServicio,
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
      prioridad,
      fecha_estimada_entrega: fechaEntrega || null,
      costo_prenda: Number(costoPrenda) || 0,
      costo_matriz: Number(costoMatriz) || 0,
      costo_bordado: Number(costoBordado) || 0,
      otros_costos: Number(otrosCostos) || 0,
    };

    startTransition(async () => {
      const res = editando
        ? await updateOrdenProduccion(orden!.id, comun)
        : await createOrdenProduccion({
            ...comun,
            product_id: productId || null,
            prenda,
            tipo_prenda: tipoPrenda,
            talle,
            color,
            cantidad: Number(cantidad) || 1,
            permitir_sin_stock: sinStock,
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

      {/* TIPO DE ORDEN */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className={h2}>Tipo de orden</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              [false, "Prenda propia", "Sale de tu producción y se vende como producto."],
              [true, "Servicio de bordado", "Le cobrás el trabajo al cliente."],
            ] as const
          ).map(([valor, titulo, detalle]) => (
            <button
              key={String(valor)}
              type="button"
              onClick={() => setEsServicio(valor)}
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition sm:flex-none sm:w-64 ${
                esServicio === valor
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span className="block text-sm font-medium">{titulo}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  esServicio === valor ? "text-neutral-300" : "text-neutral-500"
                }`}
              >
                {detalle}
              </span>
            </button>
          ))}
        </div>
        {esServicio && (
          <p className="text-xs text-neutral-500">
            La prenda es opcional: si la trae el cliente, dejala vacía y no se
            toca tu stock. Si la ponés vos, elegila del catálogo y se descuenta
            como en cualquier orden. El ingreso queda marcado como servicio en
            los reportes.
          </p>
        )}
      </section>

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
            {/* Sin clientes cargados el buscador no tendría nada que buscar:
                ahí queda solo el campo de abajo, para escribir el nombre. */}
            {clientes.length > 0 && (
              <Buscador
                opciones={clientes.map((c) => ({
                  value: c.id,
                  label: nombreCompleto(c),
                }))}
                value={clienteId}
                onSelect={(o) => elegirCliente(o?.value ?? "")}
                placeholder="Buscá el cliente"
                vacio="— Sin cliente del master —"
                className="mb-2"
              />
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

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label className={label}>Prioridad</label>
            <select
              value={prioridad}
              onChange={(e) =>
                setPrioridad(e.target.value as PrioridadProduccion)
              }
              className={input}
            >
              {PRIORIDADES_PRODUCCION.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Fecha estimada de entrega</label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className={input}
            />
            <p className="mt-1 text-xs text-neutral-400">
              Opcional. Si se pasa la fecha y el pedido no se entregó, se
              marca como atrasado.
            </p>
          </div>
        </div>

        {/* Prenda: en edición es de solo lectura (ya descontó stock) */}
        {editando && orden ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-400">
              Prenda (no editable)
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700 sm:grid-cols-4">
              <span>{orden.product_nombre || orden.prenda || "—"}</span>
              <span>{orden.tipo_prenda || "—"}</span>
              <span>Talle: {orden.talle || "—"}</span>
              <span>Color: {orden.color || "—"}</span>
              <span>Cantidad: {orden.cantidad}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              La prenda, el talle, el color y la cantidad no se pueden
              modificar porque ya se descontó el stock. Si están mal, eliminá
              la orden y creála de nuevo.
            </p>
          </div>
        ) : (
          <>
            {/* 1) Modelo (primero lo que hay en stock) */}
            <div>
              <label className={label}>
                {esServicio ? "Prenda sobre la que se borda" : "Prenda"}
              </label>
              <Buscador
                opciones={[
                  ...modelos.map((m) => ({
                    value: m.nombre,
                    label: m.nombre,
                    detalle: m.stock > 0 ? `${m.stock} en stock` : "sin stock",
                  })),
                  { value: "__mano__", label: "Otra (escribir a mano)" },
                ]}
                value={modelo}
                onSelect={(o) => elegirModelo(o?.value ?? "")}
                placeholder="Buscá la prenda"
                vacio={
                  esServicio
                    ? "— La trae el cliente —"
                    : "— Elegí la prenda —"
                }
              />
            </div>
          </>
        )}

        {/* 2) A mano */}
        {!editando && esManual && (
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

        {/* 2) Con producto: color → talle (con su stock, aunque sea 0) */}
        {!editando && modelo && !esManual && (
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
                    {c.color || "—"} ({c.stock > 0 ? `${c.stock} en stock` : "sin stock"})
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
                    {t.talle || "Único"} ({t.stock > 0 ? `${t.stock} en stock` : "sin stock"})
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

        {/* Aviso: no alcanza el stock de la variante elegida */}
        {!editando && modelo && !esManual && faltante > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">
              ⚠ No hay stock suficiente de esta prenda: hay {stockElegido}, el
              pedido necesita {Number(cantidad) || 1}.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Podés tomar el pedido igual. Se descuenta lo que haya y faltan{" "}
              {faltante}: la orden queda en “Pendiente” marcada como{" "}
              <strong>sin stock</strong> y no se puede pasar a producción hasta
              que repongas la prenda (con una compra o corrigiendo el stock).
              Cuando la muevas a “En producción”, se descuenta en ese momento.
            </p>
            <label className="mt-3 flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={sinStock}
                onChange={(e) => setSinStock(e.target.checked)}
                className="h-4 w-4"
              />
              Tomar el pedido igual
            </label>
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
            <Buscador
              opciones={matrices.map((m) => ({ value: m.id, label: m.nombre }))}
              value={matrizId}
              onSelect={(o) => setMatrizId(o?.value ?? "")}
              placeholder="Buscá la matriz"
              vacio="— Elegir —"
            />
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
            <label className={label}>
              {esServicio ? "Costo de materiales" : "Costo prenda"}
            </label>
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
          href={editando ? `/admin/produccion/${orden!.id}` : "/admin/produccion"}
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
            : editando
              ? "Guardar cambios"
              : "Crear orden de producción"}
        </button>
      </div>
    </form>
  );
}
