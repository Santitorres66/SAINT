"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Product, OrderItem, VentaManual } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import {
  createVentaManual,
  updateVentaManual,
} from "@/app/admin/gestion-actions";

type Linea = {
  product_id: string;
  nombre: string;
  talle: string;
  color: string;
  cantidad: string;
  precio_unitario: string;
};

const MEDIOS = ["Efectivo", "Transferencia", "Débito/Crédito", "Otro"];

function itemToLinea(it: OrderItem): Linea {
  return {
    product_id: it.product_id ?? "",
    nombre: it.nombre,
    talle: it.talle ?? "",
    color: it.color ?? "",
    cantidad: String(it.cantidad),
    precio_unitario: String(it.precio_unitario),
  };
}

const LINEA_VACIA: Linea = {
  product_id: "",
  nombre: "",
  talle: "",
  color: "",
  cantidad: "1",
  precio_unitario: "",
};

/**
 * Formulario para registrar o EDITAR una venta manual.
 * Cada ítem puede elegirse de la lista de productos o escribirse a mano.
 */
export default function VentaManualForm({
  products,
  initial,
}: {
  products: Product[];
  initial?: VentaManual;
}) {
  const esEdicion = Boolean(initial);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const [cliente, setCliente] = useState(initial?.cliente ?? "");
  const [medioPago, setMedioPago] = useState(initial?.medio_pago || "Efectivo");
  const [fecha, setFecha] = useState(
    initial?.fecha ? initial.fecha.slice(0, 10) : hoy,
  );
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [lineas, setLineas] = useState<Linea[]>(
    initial?.items?.length ? initial.items.map(itemToLinea) : [LINEA_VACIA],
  );

  function actualizar(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const nueva = { ...l, [campo]: valor };
        // Al elegir un producto de la lista, prellenamos nombre y precio
        if (campo === "product_id" && valor) {
          const prod = products.find((p) => p.id === valor);
          if (prod) {
            nueva.nombre = prod.nombre;
            if (!nueva.precio_unitario)
              nueva.precio_unitario = String(prod.precio);
          }
        }
        return nueva;
      }),
    );
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  }
  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = lineas.reduce(
    (a, l) => a + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0),
    0,
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items: OrderItem[] = lineas
      .filter((l) => l.nombre.trim() && Number(l.cantidad) > 0)
      .map((l) => ({
        product_id: l.product_id || null,
        nombre: l.nombre.trim(),
        talle: l.talle.trim() || null,
        color: l.color.trim() || null,
        cantidad: Number(l.cantidad),
        precio_unitario: Number(l.precio_unitario) || 0,
      }));

    if (!items.length) {
      setError("Agregá al menos un producto (con nombre y cantidad).");
      return;
    }

    const payload = {
      cliente,
      medio_pago: medioPago,
      fecha,
      items,
      notas,
    };

    startTransition(async () => {
      const res = esEdicion
        ? await updateVentaManual(initial!.id, payload)
        : await createVentaManual(payload);
      if (res?.error) setError(res.error);
    });
  }

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";
  const inputChico =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Datos generales */}
      <section className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-3">
        <div>
          <label htmlFor="cliente" className={labelClase}>
            Cliente
          </label>
          <input
            id="cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className={inputClase}
            placeholder="Nombre del cliente"
          />
        </div>
        <div>
          <label htmlFor="medio" className={labelClase}>
            Medio de pago
          </label>
          <select
            id="medio"
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
            className={inputClase}
          >
            {/* Si el medio guardado no está en la lista, lo agregamos */}
            {!MEDIOS.includes(medioPago) && medioPago && (
              <option value={medioPago}>{medioPago}</option>
            )}
            {MEDIOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fecha" className={labelClase}>
            Fecha
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

      {/* Productos vendidos */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            Productos vendidos
          </h2>
          <p className="text-sm text-neutral-500">
            Elegí un producto de la lista o escribí el nombre a mano.
          </p>
        </div>

        <div className="space-y-4">
          {lineas.map((l, i) => (
            <div key={i} className="space-y-3 rounded-xl bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <select
                  value={l.product_id}
                  onChange={(e) => actualizar(i, "product_id", e.target.value)}
                  className={inputChico + " max-w-xs"}
                >
                  <option value="">— A mano / sin producto —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (stock {p.stock})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => quitarLinea(i)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-neutral-300 text-neutral-500 transition hover:bg-neutral-200"
                  aria-label="Quitar"
                >
                  ✕
                </button>
              </div>

              <input
                value={l.nombre}
                onChange={(e) => actualizar(i, "nombre", e.target.value)}
                className={inputChico}
                placeholder="Nombre del producto (ej. Remera Oversize Verde)"
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <input
                  value={l.talle}
                  onChange={(e) => actualizar(i, "talle", e.target.value)}
                  className={inputChico}
                  placeholder="Talle"
                />
                <input
                  value={l.color}
                  onChange={(e) => actualizar(i, "color", e.target.value)}
                  className={inputChico}
                  placeholder="Color"
                />
                <input
                  type="number"
                  min="1"
                  value={l.cantidad}
                  onChange={(e) => actualizar(i, "cantidad", e.target.value)}
                  className={inputChico}
                  placeholder="Cant."
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.precio_unitario}
                  onChange={(e) =>
                    actualizar(i, "precio_unitario", e.target.value)
                  }
                  className={inputChico}
                  placeholder="Precio c/u"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={agregarLinea}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          + Agregar otro producto
        </button>

        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          <span className="text-sm text-neutral-500">Total de la venta</span>
          <span className="text-xl font-semibold text-neutral-900">
            {formatPrecio(total)}
          </span>
        </div>
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
          placeholder="Ej: estado de cobro, envío, detalle del bordado…"
        />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/ventas"
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
              : "Registrar venta"}
        </button>
      </div>
    </form>
  );
}
