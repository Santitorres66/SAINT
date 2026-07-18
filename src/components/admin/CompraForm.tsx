"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Product, Proveedor, CompraItem } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { createCompra } from "@/app/admin/gestion-actions";

type Linea = { product_id: string; cantidad: string; costo_unitario: string };

/** Formulario para cargar una compra a un proveedor (suma stock). */
export default function CompraForm({
  products,
  proveedores,
}: {
  products: Product[];
  proveedores: Proveedor[];
}) {
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([
    { product_id: "", cantidad: "1", costo_unitario: "" },
  ]);

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
        }
        return nueva;
      }),
    );
  }

  function agregarLinea() {
    setLineas((prev) => [
      ...prev,
      { product_id: "", cantidad: "1", costo_unitario: "" },
    ]);
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
      .filter((l) => l.product_id && Number(l.cantidad) > 0)
      .map((l) => {
        const prod = products.find((p) => p.id === l.product_id)!;
        return {
          product_id: l.product_id,
          nombre: prod.nombre,
          cantidad: Number(l.cantidad),
          costo_unitario: Number(l.costo_unitario) || 0,
        };
      });

    if (!items.length) {
      setError("Agregá al menos un producto con cantidad.");
      return;
    }

    startTransition(async () => {
      const res = await createCompra({
        proveedor_id: proveedorId || null,
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

      {/* Productos comprados */}
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            Productos comprados
          </h2>
          <p className="text-sm text-neutral-500">
            Elegí el producto, la cantidad y cuánto te costó cada uno. Se suma al
            stock automáticamente.
          </p>
        </div>

        <div className="space-y-3">
          {lineas.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-3 rounded-xl bg-neutral-50 p-3 sm:grid-cols-[1fr_100px_140px_40px] sm:items-end"
            >
              <div>
                <label className="mb-1 block text-xs text-neutral-500">
                  Producto
                </label>
                <select
                  value={l.product_id}
                  onChange={(e) => actualizar(i, "product_id", e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">— Elegir —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
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
          <span className="text-sm text-neutral-500">Total de la compra</span>
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
          {guardando ? "Guardando…" : "Registrar compra"}
        </button>
      </div>
    </form>
  );
}
