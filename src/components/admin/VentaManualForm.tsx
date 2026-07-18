"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Product, OrderItem } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { createVentaManual } from "@/app/admin/gestion-actions";

type Linea = {
  product_id: string;
  talle: string;
  color: string;
  cantidad: string;
  precio_unitario: string;
};

const MEDIOS = ["Efectivo", "Transferencia", "Débito/Crédito", "Otro"];

/** Formulario para registrar una venta manual (resta stock). */
export default function VentaManualForm({ products }: { products: Product[] }) {
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const [cliente, setCliente] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [fecha, setFecha] = useState(hoy);
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([
    { product_id: "", talle: "", color: "", cantidad: "1", precio_unitario: "" },
  ]);

  function actualizar(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const nueva = { ...l, [campo]: valor };
        if (campo === "product_id") {
          const prod = products.find((p) => p.id === valor);
          nueva.precio_unitario = prod ? String(prod.precio) : "";
          nueva.talle = "";
          nueva.color = "";
        }
        return nueva;
      }),
    );
  }

  function agregarLinea() {
    setLineas((prev) => [
      ...prev,
      { product_id: "", talle: "", color: "", cantidad: "1", precio_unitario: "" },
    ]);
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
      .filter((l) => l.product_id && Number(l.cantidad) > 0)
      .map((l) => {
        const prod = products.find((p) => p.id === l.product_id)!;
        return {
          product_id: l.product_id,
          nombre: prod.nombre,
          talle: l.talle || null,
          color: l.color || null,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario) || 0,
        };
      });

    if (!items.length) {
      setError("Agregá al menos un producto con cantidad.");
      return;
    }

    startTransition(async () => {
      const res = await createVentaManual({
        cliente,
        medio_pago: medioPago,
        fecha,
        items,
        notas,
      });
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

      {/* Datos generales */}
      <section className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:grid-cols-3">
        <div>
          <label htmlFor="cliente" className={labelClase}>
            Cliente (opcional)
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
            Elegí el producto y la cantidad. Se descuenta del stock
            automáticamente.
          </p>
        </div>

        <div className="space-y-3">
          {lineas.map((l, i) => {
            const prod = products.find((p) => p.id === l.product_id);
            return (
              <div key={i} className="rounded-xl bg-neutral-50 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_130px_40px] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Producto
                    </label>
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
                          {p.nombre} (stock {p.stock})
                        </option>
                      ))}
                    </select>
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
                      Precio c/u
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={l.precio_unitario}
                      onChange={(e) =>
                        actualizar(i, "precio_unitario", e.target.value)
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

                {/* Talle y color (si el producto los tiene) */}
                {prod && (prod.talles.length > 0 || prod.colores.length > 0) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {prod.talles.length > 0 && (
                      <select
                        value={l.talle}
                        onChange={(e) => actualizar(i, "talle", e.target.value)}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      >
                        <option value="">Talle (opcional)</option>
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
                        <option value="">Color (opcional)</option>
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
          placeholder="Ej: envío, seña, detalle del bordado…"
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
          {guardando ? "Guardando…" : "Registrar venta"}
        </button>
      </div>
    </form>
  );
}
