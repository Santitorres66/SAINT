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

/** Stock de una variante (talle + color) de un producto. */
export interface ProductVariante {
  id: string;
  product_id: string;
  talle: string;
  color: string;
  stock: number;
}
/** Datos de variante que manda el formulario. */
export type VarianteInput = { talle: string; color: string; stock: number };

/** Respuesta estándar de las server actions. */
export type ActionResult = { error?: string; ok?: boolean };

/* ----------------------------- Clientes ----------------------------- */

/** Cliente del master. */
export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  observaciones: string;
  created_at: string;
}
export type ClienteInput = Omit<Cliente, "id" | "created_at">;

/** Nombre completo legible de un cliente. */
export function nombreCompleto(c: {
  nombre: string;
  apellido?: string;
}): string {
  return [c.nombre, c.apellido].filter(Boolean).join(" ").trim();
}

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
  /** Stock máximo de la variante (para no superar lo disponible). */
  maxStock?: number;
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

/** Tipo de un ítem de compra: solo "mercaderia" suma stock y cuesta el producto. */
export type TipoItemCompra = "mercaderia" | "insumo" | "activo_fijo";

/** Ítem de una compra a proveedor. */
export interface CompraItem {
  tipo: TipoItemCompra;
  /** Solo para "mercaderia": producto del catálogo que suma stock. */
  product_id: string | null;
  nombre: string;
  talle: string | null;
  color: string | null;
  cantidad: number;
  costo_unitario: number;
}

/** Una compra a un proveedor (la mercadería suma stock; insumos/activos no). */
export interface Compra {
  id: string;
  created_at: string;
  fecha: string;
  proveedor_id: string | null;
  total: number;
  items: CompraItem[];
  medio_pago: string;
  cuotas: number;
  monto_cuota: number;
  notas: string;
  /** Nombre del proveedor (se completa al leer con join). */
  proveedor_nombre?: string | null;
}

/* ------------------------------- Cobros ------------------------------- */

/**
 * Estado de cobro de una venta. Lo calcula la base a partir de los cobros
 * registrados (ver `recalcular_cobro_venta` en supabase/cobros.sql).
 */
export type EstadoCobro = "pendiente" | "parcial" | "cobrado";

/** Una entrada de plata de una venta (seña, saldo, cuota…). */
export interface Cobro {
  id: string;
  venta_id: string;
  fecha: string;
  monto: number;
  medio_pago: string;
  cuotas: number;
  monto_cuota: number;
  notas: string;
  created_at: string;
}

/** Datos que manda el formulario al registrar un cobro. */
export type CobroInput = {
  fecha: string;
  monto: number;
  medio_pago: string;
  cuotas: number;
  notas: string;
};

/**
 * Una venta manual. Resta stock salvo que venga de una orden de producción
 * (`afecta_stock: false`), porque en ese caso la prenda ya salió del stock
 * cuando se creó la orden.
 */
export interface VentaManual {
  id: string;
  created_at: string;
  fecha: string;
  cliente: string;
  cliente_id: string | null;
  medio_pago: string;
  total: number;
  items: OrderItem[];
  notas: string;
  /** Rebaja acordada sobre el total al momento de cobrar. */
  descuento: number;
  /** Suma de los cobros registrados (la mantiene la base). */
  total_cobrado: number;
  estado_cobro: EstadoCobro;
  /** Se completa cuando la venta queda saldada. */
  fecha_cobro: string | null;
  /**
   * false cuando la venta nace de una orden de producción: esa prenda ya se
   * descontó del stock al crear la orden y no se debe descontar de nuevo.
   */
  afecta_stock: boolean;
  /** Cobros de esta venta (solo al pedir el detalle). */
  cobros?: Cobro[];
}

/** Lo que falta cobrar de una venta: total − descuento − cobrado. */
export function saldoVenta(v: {
  total: number;
  descuento: number;
  total_cobrado: number;
}): number {
  return Math.max(
    Number(v.total) - Number(v.descuento) - Number(v.total_cobrado),
    0,
  );
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
  /* --- Cobro (las ventas web de Mercado Pago ya vienen cobradas) --- */
  estado_cobro: EstadoCobro;
  descuento: number;
  total_cobrado: number;
  saldo: number;
  fecha_cobro: string | null;
  cobros: Cobro[];
  /** N° de la orden de producción que la originó (para mostrar el vínculo). */
  orden_numero: number | null;
  orden_id: string | null;
}

/* ---------------------- Producción de bordados ---------------------- */

/**
 * Estados del circuito completo de un pedido. Los dos últimos cierran el
 * ciclo con el módulo de ventas: `vendido` cuando la orden tiene una venta
 * asociada, `cobrado` cuando esa venta quedó saldada.
 */
export type EstadoProduccion =
  | "pendiente"
  | "en_produccion"
  | "fabricado"
  | "entregado"
  | "vendido"
  | "cobrado";

export type PrioridadProduccion = "alta" | "media" | "baja";

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
  cliente_id: string | null;
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
  prioridad: PrioridadProduccion;
  fecha_estimada_entrega: string | null;
  fecha_inicio: string | null;
  fecha_fabricacion: string | null;
  /** Venta que cerró esta orden (null hasta que se carga como vendida). */
  venta_id: string | null;
  fecha_venta: string | null;
  fecha_cobro: string | null;
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
  product_imagen_url: string | null; // foto del producto (catálogo), pública
  matriz_nombre: string | null;
  /* --- Datos de la venta asociada, para las columnas Vendido/Cobrado --- */
  venta_total: number | null;
  venta_estado_cobro: EstadoCobro | null;
  venta_saldo: number | null;
}

/** Una fila del historial de estados. */
export interface ProduccionHistorialItem {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  usuario: string;
  created_at: string;
}

/** Todo lo necesario para el detalle de una orden. */
export interface OrdenDetalle {
  orden: OrdenProduccionVista;
  imagen_ref_url: string | null;
  archivo_bordado_url: string | null;
  matriz: {
    nombre: string;
    costo: number;
    imagen_url: string | null;
    archivo_url: string | null;
  } | null;
  historial: ProduccionHistorialItem[];
}

/** Números para el tablero de resumen. */
export interface DashboardStats {
  /** Facturado en el mes (lo vendido, esté cobrado o no). */
  ventasMesTotal: number;
  ventasMesCantidad: number;
  /** Plata que efectivamente entró en el mes. */
  cobradoMesTotal: number;
  /** Saldo pendiente de cobro, de todas las ventas (no solo del mes). */
  pendienteCobroTotal: number;
  /** Cuántas ventas tienen saldo pendiente. */
  pendienteCobroCantidad: number;
  comprasMesTotal: number;
  gananciaMesEstimada: number;
  productosActivos: number;
  stockBajo: {
    id: string;
    nombre: string;
    talle: string;
    color: string;
    stock: number;
  }[];
  /** Capital en mercadería: stock × costo. */
  stockValorizadoCosto: number;
  /** Valor del stock a precio de venta. */
  stockValorizadoVenta: number;
  /** Unidades totales en stock. */
  unidadesEnStock: number;
}
