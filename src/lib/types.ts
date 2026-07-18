/** Categorías válidas — coinciden con el CHECK de la tabla en Supabase. */
export type Categoria = "buzo" | "remera" | "gorra" | "canguro" | "crop";

/** Un producto tal como vive en la tabla `products`. */
export interface Product {
  id: string;
  nombre: string;
  categoria: Categoria;
  precio: number;
  descripcion: string;
  colores: string[];
  talles: string[];
  imagenes: string[];
  stock: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Datos que se cargan/editan desde el admin (sin los campos automáticos:
 * id, created_at, updated_at).
 */
export type ProductInput = Omit<Product, "id" | "created_at" | "updated_at">;

/** Respuesta estándar de las server actions. */
export type ActionResult = { error?: string; ok?: boolean };

/* ------------------------- Carrito y órdenes ------------------------- */

/** Un ítem dentro del carrito (en el navegador). */
export interface CartItem {
  /** Clave única = productId + talle + color (para distinguir variantes). */
  key: string;
  productId: string;
  nombre: string;
  precio: number;
  imagen?: string;
  talle: string | null;
  color: string | null;
  cantidad: number;
}

/** Un ítem tal como se guarda en la orden. */
export interface OrderItem {
  product_id: string;
  nombre: string;
  talle: string | null;
  color: string | null;
  cantidad: number;
  precio_unitario: number;
}

/** Estado de una orden de compra. */
export type OrderStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Una orden de compra en la tabla `orders`. */
export interface Order {
  id: string;
  created_at: string;
  status: OrderStatus | string;
  total: number;
  items: OrderItem[];
  comprador: { nombre?: string; email?: string } | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
}
