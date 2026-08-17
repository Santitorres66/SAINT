"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type {
  Product,
  Proveedor,
  Compra,
  CompraItem,
  TipoItemCompra,
} from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { createCompra, updateCompra } from "@/app/admin/gestion-actions";
import MedioPagoCuotas from "./MedioPagoCuotas";

const TIPOS_ITEM: { value: TipoItemCompra; label: string }[] = [
  { value: "mercaderia", label: "Mercadería (para vender)" },
  { value: "insumo", label: "Insumo (hilos, telas…)" },
  { value: "activo_fijo", label: "Activo fijo (maquinaria)" },
];

type Linea = {
  tipo: TipoItemCompra;
  product_id: string;
  descripcion: string; // solo para insumo / activo_fijo
  talle: string;
  color: string;
  cantidad: string;
  costo_unitario: string;
};

const LINEA_VACIA: Linea = {
  tipo: "mercaderia",
  product_id: "",
  descripcion: "",
  talle: "",
  color: "",
  cantidad: "1",
  costo_unitario: "",
};

/** Pasa un ítem guardado al formato editable del formulario. */
function itemToLinea(it: CompraItem): Linea {
  const tipo = it.tipo ?? "mercaderia";
  return {
    tipo,
    product_id: it.product_id ?? "",
    descripcion: tipo === "mercaderia" ? "" : it.nombre,
    talle: it.talle ?? "",
    color: it.color ?? "",
    cantidad: String(it.cantidad),
    costo_unitario: String(it.costo_unitario),
  };
}

/**
 * Formulario para cargar o EDITAR una compra a un proveedor (suma stock).
 * Al editar, la acción revierte el stock viejo antes de aplicar el nuevo.
 */
export default function CompraForm({
  products,
  proveedores,
  initial,
}: {
  products: Product[];
  proveedores: Proveedor[];
  initial?: Compra;
}) {
  const esEdicion = Boolean(initial);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const [proveedorId, setProveedorId] = useState(initial?.proveedor_id ?? "");
  const [fecha, setFecha] = useState(
    initial?.fecha ? initial.fecha.slice(0, 10) : hoy,
  );
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [medioPago, setMedioPago] = useState(initial?.medio_pago ?? "");
  const [cuotas, setCuotas] = useState(String(initial?.cuotas ?? 1));
  const lineaVacia = LINEA_VACIA;
  const [lineas, setLineas] = useState<Linea[]>(
    initial?.items?.length
      ? initial.items.map(itemToLinea)
      : [{ ...lineaVacia }],
  );

  function actualizar(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const nueva = { ...l, [campo]: valor };
        // Al elegir producto, prellenamos el costo con el del producto
        if (campo === "product_id") {
          const prod = products.find((p) => p.id === valor);
          if (prod && prod.costo > 0)
            nueva.costo_unitario = String(prod.costo);
          nueva.talle = prod && prod.talles.length === 1 ? prod.talles[0] : "";
          nueva.color = prod && prod.colores.length === 1 ? prod.colores[0] : "";
        }
        // Al cambiar de tipo, limpiamos lo que no aplica al nuevo tipo
        if (campo === "tipo") {
          nueva.product_id = "";
          nueva.descripcion = "";
          nueva.talle = "";
          nueva.color = "";
        }
        return nueva;
      }),
    );
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...lineaVacia }]);
  }
  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lineas.reduce(
    (a, l) => a + (Number(l.cantidad) || 0) * (Number(l.costo_unitario) || 0),
    0,
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items: CompraItem[] = lineas
      .filter((l) =>
        l.tipo === "mercaderia"
          ? l.product_id && Number(l.cantidad) > 0
          : l.descripcion.trim() && Number(l.cantidad) > 0,
      )
      .map((l) => {
        if (l.tipo === "mercaderia") {
          const prod = products.find((p) => p.id === l.product_id)!;
          return {
            tipo: l.tipo,
            product_id: l.product_id,
            nombre: prod.nombre,
            talle: l.talle || null,
            color: l.color || null,
            cantidad: Number(l.cantidad),
            costo_unitario: Number(l.costo_unitario) || 0,
          };
        }
        return {
          tipo: l.tipo,
          product_id: null,
          nombre: l.descripcion.trim(),
          talle: null,
          color: null,
          cantidad: Number(l.cantidad),
          costo_unitario: Number(l.costo_unitario) || 0,
        };
      });

    if (!items.length) {
      setError("Agregá al menos un ítem con cantidad.");
      return;
    }

    const nCuotas = Number(cuotas) || 1;

    const payload = {
      proveedor_id: proveedorId || null,
      fecha,
      items,
      medio_pago: medioPago,
      cuotas: nCuotas,
      monto_cuota: nCuotas > 0 ? total / nCuotas : 0,
      notas,
    };

    startTransition(async () => {
      const res = esEdicion
        ? await updateCompra(initial!.id, payload)
        : await createCompra(payload);
      if (res?.error) setError(res.error);
    });
  }

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

      {esEdicion && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Al guardar, se <strong>revierte el stock</strong> que había sumado
          esta compra y se aplica el de los ítems que dejes acá.
        </p>
      )}

      {/* Datos generales */}
      <section className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <label htmlFor="proveedor" className={labelClase}>
            Proveedor
          </label>
          <select
            id="proveedor"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={inputClase}
          >
            <option value="">— Sin proveedor —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {proveedores.length === 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              Todavía no tenés proveedores.{" "}
              <Link href="/admin/proveedores/nuevo" className="underline">
                Crear uno
              </Link>
            </p>
          )}
        </div>
        <div>
          <label htmlFor="fecha" className={labelClase}>
            Fecha de la compra
          </label>
          <input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputClase}
          />
        </div>
      </section>

      {/* Ítems de la compra */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            Ítems de la compra
          </h2>
          <p className="text-sm text-neutral-500">
            Elegí un producto del catálogo (suma stock) o describí un insumo
            (hilos, telas) o activo fijo (maquinaria) que no se revende.
          </p>
        </div>

        <div className="space-y-3">
          {lineas.map((l, i) => {
            const prod = products.find((p) => p.id === l.product_id);
            const esMercaderia = l.tipo === "mercaderia";
            return (
              <div key={i} className="space-y-3 rounded-xl bg-neutral-50 p-3">
                <div className="w-full sm:w-64">
                  <label className="mb-1 block text-xs text-neutral-500">
                    Tipo
                  </label>
                  <select
                    value={l.tipo}
                    onChange={(e) => actualizar(i, "tipo", e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {TIPOS_ITEM.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_140px_40px] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      {esMercaderia ? "Producto" : "Descripción"}
                    </label>
                    {esMercaderia ? (
                      <select
                        value={l.product_id}
                        onChange={(e) =>
                          actualizar(i, "product_id", e.target.value)
                        }
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value="">— Elegir —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                            {p.colores.length > 0
                              ? ` · ${p.colores.join("/")}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={l.descripcion}
                        onChange={(e) =>
                          actualizar(i, "descripcion", e.target.value)
                        }
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        placeholder={
                          l.tipo === "insumo"
                            ? "Ej: Hilo poliéster negro Nm40"
                            : "Ej: Máquina de coser recta"
                        }
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={l.cantidad}
                      onChange={(e) => actualizar(i, "cantidad", e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Costo c/u
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={l.costo_unitario}
                      onChange={(e) =>
                        actualizar(i, "costo_unitario", e.target.value)
                      }
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="$"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarLinea(i)}
                    className="mb-1 h-9 rounded-lg border border-neutral-300 text-neutral-500 transition hover:bg-neutral-200"
                    aria-label="Quitar"
                  >
                    ✕
                  </button>
                </div>

                {/* Talle / color de la variante (si el producto los tiene) */}
                {esMercaderia && prod && (prod.talles.length > 0 || prod.colores.length > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    {prod.talles.length > 0 && (
                      <select
                        value={l.talle}
                        onChange={(e) => actualizar(i, "talle", e.target.value)}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value="">Talle…</option>
                        {prod.talles.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    )}
                    {prod.colores.length > 0 && (
                      <select
                        value={l.color}
                        onChange={(e) => actualizar(i, "color", e.target.value)}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value="">Color…</option>
                        {prod.colores.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={agregarLinea}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          + Agregar otro ítem
        </button>

        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <span className="text-sm text-neutral-500">Total de la compra</span>
          <span className="text-xl font-semibold text-neutral-900">
            {formatPrecio(total)}
          </span>
        </div>
      </section>

      {/* Forma de pago */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Forma de pago</h2>
        <MedioPagoCuotas
          medioPago={medioPago}
          onMedioPagoChange={setMedioPago}
          cuotas={cuotas}
          onCuotasChange={setCuotas}
          total={total}
        />
      </section>

      {/* Notas */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <label htmlFor="notas" className={labelClase}>
          Notas (opcional)
        </label>
        <textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className={inputClase}
          placeholder="Ej: número de factura, remito…"
        />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/compras"
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
              : "Registrar compra"}
        </button>
      </div>
    </form>
  );
}
