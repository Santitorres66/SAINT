/** Categorías válidas — coinciden con el CHECK de la tabla en Supabase. */
export type Categoria = "buzo" | "remera" | "gorra" | "canguro" | "crop";

/** Un producto tal como vive en la tabla `products`. */
export interface Product {
  id: string;
  nombre: string;
  categoria: Categoria;
  precio: number;
  costo: number; // precio de costo (para calcular ganancia)
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

/** Un ítem tal como se guarda en la orden o venta. */
export interface OrderItem {
  /** null cuando la venta manual no referencia un producto del sistema. */
  product_id: string | null;
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

/* ---------------------- Sistema de gestión ---------------------- */

/** Proveedor. */
export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  cuit: string;
  notas: string;
  created_at: string;
}
export type ProveedorInput = Omit<Proveedor, "id" | "created_at">;

/** Ítem de una compra a proveedor. */
export interface CompraItem {
  product_id: string;
  nombre: string;
  cantidad: number;
  costo_unitario: number;
}

/** Una compra a un proveedor (suma stock). */
export interface Compra {
  id: string;
  created_at: string;
  fecha: string;
  proveedor_id: string | null;
  total: number;
  items: CompraItem[];
  notas: string;
  /** Nombre del proveedor (se completa al leer con join). */
  proveedor_nombre?: string | null;
}

/** Una venta manual (resta stock). Reusa OrderItem para los ítems. */
export interface VentaManual {
  id: string;
  created_at: string;
  fecha: string;
  cliente: string;
  medio_pago: string;
  total: number;
  items: OrderItem[];
  notas: string;
}

/** Fila unificada para el listado de ventas (online + manual). */
export interface VentaUnificada {
  id: string;
  fecha: string;
  canal: "online" | "manual";
  cliente: string;
  medio_pago: string;
  estado: string;
  total: number;
  items: OrderItem[];
}

/* ---------------------- Producción de bordados ---------------------- */

export type EstadoProduccion =
  | "pendiente"
  | "en_produccion"
  | "fabricado"
  | "entregado";

/** Matriz de bordado (reutilizable). */
export interface Matriz {
  id: string;
  nombre: string;
  archivo_path: string | null;
  imagen_path: string | null;
  costo: number;
  observaciones: string;
  fecha_creacion: string;
  created_at: string;
}
export type MatrizInput = {
  nombre: string;
  costo: number;
  observaciones: string;
  archivo_path: string | null;
  imagen_path: string | null;
};
/** Matriz con datos derivados para la biblioteca. */
export interface MatrizConUso extends Matriz {
  veces_usada: number;
  imagen_url: string | null; // URL firmada temporal
  archivo_url: string | null; // URL firmada temporal
}

/** Orden de producción de bordado. */
export interface OrdenProduccion {
  id: string;
  numero: number;
  pedido_referencia: string;
  cliente: string;
  fecha: string;
  product_id: string | null;
  prenda: string;
  tipo_prenda: string;
  talle: string;
  color: string;
  cantidad: number;
  bordado_descripcion: string;
  bordado_ubicacion: string;
  bordado_tamano: string;
  bordado_colores: number;
  observaciones: string;
  imagen_ref_path: string | null;
  archivo_bordado_path: string | null;
  matriz_id: string | null;
  estado: EstadoProduccion;
  fecha_inicio: string | null;
  fecha_fabricacion: string | null;
  costo_prenda: number;
  costo_matriz: number;
  costo_bordado: number;
  otros_costos: number;
  costo_total: number;
  posicion: number;
  created_at: string;
  updated_at: string;
}

/** Orden de producción con datos derivados para las tarjetas/Kanban. */
export interface OrdenProduccionVista extends OrdenProduccion {
  imagen_ref_url: string | null; // URL firmada temporal
  product_nombre: string | null;
  matriz_nombre: string | null;
}

/** Números para el tablero de resumen. */
export interface DashboardStats {
  ventasMesTotal: number;
  ventasMesCantidad: number;
  comprasMesTotal: number;
  gananciaMesEstimada: number;
  productosActivos: number;
  stockBajo: { id: string; nombre: string; stock: number }[];
}
