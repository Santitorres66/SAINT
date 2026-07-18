"use client";

import { useCart } from "@/lib/cart/CartContext";

/** Botón del carrito para la Navbar, con contador de ítems. */
export default function CartButton() {
  const { count, openCart } = useCart();

  return (
    <button
      onClick={openCart}
      className="relative flex items-center text-xs uppercase tracking-wide2 text-saint-gray transition-colors duration-300 hover:text-saint-white"
      aria-label={`Abrir carrito (${count} ítems)`}
    >
      {/* Ícono de bolsa (SVG inline, sin dependencias) */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>

      {count > 0 && (
        <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-saint-white px-1 text-[10px] font-medium text-saint-black">
          {count}
        </span>
      )}
    </button>
  );
}
