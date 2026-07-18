"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/CartContext";

/** Vacía el carrito al montar (se usa en la página de pago exitoso). */
export default function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
