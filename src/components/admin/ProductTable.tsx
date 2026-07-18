"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { formatPrecio, labelCategoria } from "@/lib/constants";
import { deleteProduct, toggleActivo } from "@/app/admin/actions";

/**
 * Listado de productos del admin, con acciones de editar, activar/desactivar
 * y eliminar (con confirmación). Pensado para uso no técnico: claro y directo.
 */
export default function ProductTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aBorrar, setABorrar] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cambiarActivo(p: Product) {
    setError(null);
    startTransition(async () => {
      const res = await toggleActivo(p.id, !p.activo);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function confirmarBorrado() {
    if (!aBorrar) return;
    setError(null);
    const id = aBorrar.id;
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res?.error) setError(res.error);
      else {
        setABorrar(null);
        router.refresh();
      }
    });
  }

  if (!products.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-20 text-center">
        <p className="text-lg font-medium text-neutral-700">
          Todavía no cargaste ningún producto.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Tocá “Agregar producto” para crear el primero.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {/* Encabezado (solo en pantallas grandes) */}
        <div className="hidden grid-cols-[64px_1fr_120px_100px_140px_180px] items-center gap-4 border-b border-neutral-200 px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500 md:grid">
          <span>Foto</span>
          <span>Producto</span>
          <span>Precio</span>
          <span>Stock</span>
          <span>Estado</span>
          <span className="text-right">Acciones</span>
        </div>

        <ul className="divide-y divide-neutral-100">
          {products.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[64px_1fr] items-center gap-4 px-5 py-4 md:grid-cols-[64px_1fr_120px_100px_140px_180px]"
            >
              {/* Foto */}
              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-neutral-100">
                {p.imagenes?.[0] ? (
                  <Image
                    src={p.imagenes[0]}
                    alt={p.nombre}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                    sin foto
                  </span>
                )}
              </div>

              {/* Producto */}
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">
                  {p.nombre}
                </p>
                <p className="text-sm text-neutral-500">
                  {labelCategoria(p.categoria)}
                </p>
                {/* En mobile mostramos precio/stock acá */}
                <p className="mt-1 text-sm text-neutral-500 md:hidden">
                  {formatPrecio(p.precio)} · Stock: {p.stock}
                </p>
              </div>

              {/* Precio (desktop) */}
              <span className="hidden text-neutral-700 md:block">
                {formatPrecio(p.precio)}
              </span>

              {/* Stock (desktop) */}
              <span className="hidden text-neutral-700 md:block">{p.stock}</span>

              {/* Estado */}
              <div className="col-span-2 md:col-span-1">
                <button
                  onClick={() => cambiarActivo(p)}
                  disabled={pending}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    p.activo
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                  title="Tocá para mostrar u ocultar en la web"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      p.activo ? "bg-green-500" : "bg-neutral-400"
                    }`}
                  />
                  {p.activo ? "Visible" : "Oculto"}
                </button>
              </div>

              {/* Acciones */}
              <div className="col-span-2 flex items-center justify-start gap-2 md:col-span-1 md:justify-end">
                <Link
                  href={`/admin/editar/${p.id}`}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                >
                  Editar
                </Link>
                <button
                  onClick={() => setABorrar(p)}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Modal de confirmación de borrado */}
      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar este producto?
            </h3>
            <p className="mt-2 text-neutral-600">
              Estás por eliminar <strong>{aBorrar.nombre}</strong>. Esta acción
              no se puede deshacer.
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setABorrar(null)}
                disabled={pending}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                disabled={pending}
                className="rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
