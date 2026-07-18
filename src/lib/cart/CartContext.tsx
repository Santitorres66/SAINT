"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/lib/types";

/**
 * Carrito de compras del lado del cliente.
 * Guarda el estado en localStorage para que no se pierda al recargar.
 */

type CartContextType = {
  items: CartItem[];
  count: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "key">) => void;
  removeItem: (key: string) => void;
  setQty: (key: string, cantidad: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "saint_cart_v1";

/** Clave única por variante (producto + talle + color). */
function itemKey(productId: string, talle: string | null, color: string | null) {
  return `${productId}__${talle ?? "-"}__${color ?? "-"}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [cargado, setCargado] = useState(false);

  // Cargar del localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignorar datos corruptos
    }
    setCargado(true);
  }, []);

  // Guardar en localStorage cuando cambia (después de la carga inicial)
  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignorar
    }
  }, [items, cargado]);

  function addItem(nuevo: Omit<CartItem, "key">) {
    const key = itemKey(nuevo.productId, nuevo.talle, nuevo.color);
    setItems((prev) => {
      const existe = prev.find((i) => i.key === key);
      if (existe) {
        return prev.map((i) =>
          i.key === key ? { ...i, cantidad: i.cantidad + nuevo.cantidad } : i,
        );
      }
      return [...prev, { ...nuevo, key }];
    });
    setIsOpen(true); // abrimos el carrito al agregar
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function setQty(key: string, cantidad: number) {
    if (cantidad <= 0) {
      removeItem(key);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, cantidad } : i)),
    );
  }

  function clear() {
    setItems([]);
  }

  const { count, total } = useMemo(() => {
    return items.reduce(
      (acc, i) => ({
        count: acc.count + i.cantidad,
        total: acc.total + i.cantidad * i.precio,
      }),
      { count: 0, total: 0 },
    );
  }, [items]);

  const value: CartContextType = {
    items,
    count,
    total,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addItem,
    removeItem,
    setQty,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Hook para usar el carrito desde cualquier componente cliente. */
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart debe usarse dentro de <CartProvider>");
  }
  return ctx;
}
