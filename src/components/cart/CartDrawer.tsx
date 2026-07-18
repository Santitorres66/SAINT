"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrecio } from "@/lib/constants";

/**
 * Panel lateral (drawer) del carrito. Muestra los ítems, permite ajustar
 * cantidades y dispara el pago con Mercado Pago.
 */
export default function CartDrawer() {
  const { items, total, isOpen, closeCart, removeItem, setQty } = useCart();
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    setError(null);
    setPagando(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            talle: i.talle,
            color: i.color,
            cantidad: i.cantidad,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.init_point) {
        setError(data.error ?? "No se pudo iniciar el pago. Probá de nuevo.");
        setPagando(false);
        return;
      }

      // Redirigimos a la pantalla de pago de Mercado Pago.
      window.location.href = data.init_point;
    } catch {
      setError("Hubo un problema de conexión. Probá de nuevo.");
      setPagando(false);
    }
  }

  return (
    <>
      {/* Fondo oscuro */}
      <div
        onClick={closeCart}
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-saint-black shadow-2xl transition-transform duration-300 ease-smooth ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Carrito de compras"
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-saint-line px-6 py-5">
          <h2 className="font-serif text-xl">Tu carrito</h2>
          <button
            onClick={closeCart}
            className="text-saint-gray transition-colors hover:text-saint-white"
            aria-label="Cerrar carrito"
          >
            ✕
          </button>
        </div>

        {/* Ítems */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="py-20 text-center text-sm uppercase tracking-wide2 text-saint-gray">
              Tu carrito está vacío.
            </p>
          ) : (
            <ul className="space-y-6">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-saint-ink">
                    {i.imagen ? (
                      <Image
                        src={i.imagen}
                        alt={i.nombre}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-saint-line">
                        SAINT
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="font-serif text-base">{i.nombre}</p>
                      <p className="mt-0.5 text-xs text-saint-gray">
                        {[i.talle, i.color].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="mt-1 text-sm text-saint-gray">
                        {formatPrecio(i.precio)}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      {/* Cantidad */}
                      <div className="flex items-center border border-saint-line">
                        <button
                          onClick={() => setQty(i.key, i.cantidad - 1)}
                          className="px-3 py-1 text-saint-gray transition-colors hover:text-saint-white"
                          aria-label="Restar uno"
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] text-center text-sm">
                          {i.cantidad}
                        </span>
                        <button
                          onClick={() => setQty(i.key, i.cantidad + 1)}
                          className="px-3 py-1 text-saint-gray transition-colors hover:text-saint-white"
                          aria-label="Sumar uno"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(i.key)}
                        className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-red-400"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pie con total y pago */}
        {items.length > 0 && (
          <div className="space-y-4 border-t border-saint-line px-6 py-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide2 text-saint-gray">
                Total
              </span>
              <span className="font-serif text-2xl">{formatPrecio(total)}</span>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={pagar}
              disabled={pagando}
              className="btn-line w-full disabled:opacity-50"
            >
              {pagando ? "Redirigiendo…" : "Pagar con Mercado Pago"}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-saint-gray/60">
              El pago es seguro y lo procesa Mercado Pago. Después coordinamos tu
              bordado por WhatsApp.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
