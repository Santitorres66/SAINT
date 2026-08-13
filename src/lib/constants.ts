import type { Categoria } from "./types";

/** Categorías con etiqueta legible (para selects y filtros). */
export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "buzo", label: "Buzos" },
  { value: "remera", label: "Remeras" },
  { value: "crop", label: "Crops" },
  { value: "canguro", label: "Canguros" },
  { value: "gorra", label: "Gorras" },
];

/** Devuelve la etiqueta legible de una categoría. */
export function labelCategoria(value: string): string {
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

/** Talles sugeridos en el admin (se pueden agregar otros a mano). */
export const TALLES_SUGERIDOS = ["XS", "S", "M", "L", "XL", "XXL", "Único"];

/** Colores frecuentes sugeridos en el admin. */
export const COLORES_SUGERIDOS = [
  "Negro",
  "Blanco",
  "Gris",
  "Beige",
  "Crema",
  "Verde militar",
  "Azul",
];

/* --- Enlaces de contacto --- */
// Número de WhatsApp en formato internacional, sin +, espacios ni guiones.
// +54 9 3512 08-1452  →  5493512081452
export const WHATSAPP_NUMERO = "5493512081452";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}`;
export const INSTAGRAM_USER = "saint";
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_USER}`;

/** Arma un link de WhatsApp con un mensaje pre-escrito (opcional). */
export function whatsappLink(mensaje?: string): string {
  return mensaje
    ? `${WHATSAPP_URL}?text=${encodeURIComponent(mensaje)}`
    : WHATSAPP_URL;
}

/** Bucket de Supabase Storage donde viven las imágenes de productos. */
export const STORAGE_BUCKET = "productos";

/** Estados de una orden de producción (para el Kanban), con sus colores. */
export const ESTADOS_PRODUCCION = [
  {
    value: "pendiente",
    label: "Pendiente",
    col: "bg-amber-50 border-amber-200",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    value: "en_produccion",
    label: "En producción",
    col: "bg-blue-50 border-blue-200",
    chip: "bg-blue-100 text-blue-800",
  },
  {
    value: "fabricado",
    label: "Fabricado",
    col: "bg-green-50 border-green-200",
    chip: "bg-green-100 text-green-800",
  },
  {
    value: "entregado",
    label: "Entregado",
    col: "bg-neutral-100 border-neutral-200",
    chip: "bg-neutral-200 text-neutral-700",
  },
  {
    value: "vendido",
    label: "Vendido",
    col: "bg-purple-50 border-purple-200",
    chip: "bg-purple-100 text-purple-800",
  },
  {
    value: "cobrado",
    label: "Cobrado",
    col: "bg-emerald-50 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-800",
  },
] as const;

export function labelEstado(value: string): string {
  return ESTADOS_PRODUCCION.find((e) => e.value === value)?.label ?? value;
}

/**
 * Estados en los que la orden ya salió del taller: no tiene sentido marcarlos
 * como atrasados ni volver a descontar stock.
 */
export const ESTADOS_CERRADOS = ["entregado", "vendido", "cobrado"] as const;

/** Estado de cobro de una venta, con su etiqueta y color. */
export const ESTADOS_COBRO = [
  {
    value: "pendiente",
    label: "Pendiente de cobro",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    value: "parcial",
    label: "Cobro parcial",
    chip: "bg-blue-100 text-blue-800",
  },
  {
    value: "cobrado",
    label: "Cobrado",
    chip: "bg-emerald-100 text-emerald-800",
  },
] as const;

export function labelCobro(value: string): string {
  return ESTADOS_COBRO.find((e) => e.value === value)?.label ?? value;
}

export function chipCobro(value: string): string {
  return (
    ESTADOS_COBRO.find((e) => e.value === value)?.chip ??
    "bg-neutral-100 text-neutral-600"
  );
}

/** Prioridad de una orden de producción. Sin rojo: ese color queda reservado
 *  para marcar pedidos atrasados (ver `estaAtrasada` más abajo). */
export const PRIORIDADES_PRODUCCION = [
  { value: "alta", label: "Alta", chip: "bg-orange-100 text-orange-800" },
  { value: "media", label: "Media", chip: "bg-amber-50 text-amber-700" },
  { value: "baja", label: "Baja", chip: "bg-neutral-100 text-neutral-500" },
] as const;

export function labelPrioridad(value: string): string {
  return PRIORIDADES_PRODUCCION.find((p) => p.value === value)?.label ?? value;
}

/**
 * Una orden está "atrasada" si tiene fecha estimada de entrega, esa fecha ya
 * pasó, y todavía no se entregó. Compara por día (no por hora) para no marcar
 * atrasado el mismo día en que vence.
 */
export function estaAtrasada(
  fechaEstimadaEntrega: string | null,
  estado: string,
): boolean {
  if (
    !fechaEstimadaEntrega ||
    (ESTADOS_CERRADOS as readonly string[]).includes(estado)
  )
    return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaEstimadaEntrega);
  limite.setHours(0, 0, 0, 0);
  return limite < hoy;
}

/** Muestra el número de orden con formato #00025. */
export function formatNumeroOrden(n: number): string {
  return "#" + String(n).padStart(5, "0");
}

/* --- Tablas de talles (medidas de la prenda en cm) --- */
type FilaTalle = { talle: string; ancho: string; largo: string };
type TablaTalles = { titulo: string; filas: FilaTalle[] };

export const TABLAS_TALLES: Record<string, TablaTalles> = {
  remera: {
    titulo: "Remera Oversize",
    filas: [
      { talle: "S", ancho: "57 cm", largo: "78 cm" },
      { talle: "M", ancho: "59 cm", largo: "80 cm" },
      { talle: "L", ancho: "62 cm", largo: "82 cm" },
      { talle: "XL", ancho: "65 cm", largo: "84 cm" },
    ],
  },
  buzo: {
    titulo: "Buzo Oversize",
    filas: [
      { talle: "S", ancho: "64 cm", largo: "73 cm" },
      { talle: "M", ancho: "67 cm", largo: "75 cm" },
      { talle: "L", ancho: "70 cm", largo: "77 cm" },
      { talle: "XL", ancho: "73 cm", largo: "79 cm" },
    ],
  },
};

/** Devuelve la tabla de talles que corresponde a una categoría. */
export function tablaTallesDe(categoria: string): TablaTalles | null {
  const mapa: Record<string, keyof typeof TABLAS_TALLES> = {
    remera: "remera",
    crop: "remera",
    buzo: "buzo",
    canguro: "buzo",
  };
  const key = mapa[categoria];
  return key ? TABLAS_TALLES[key] : null;
}

/** Formatea un precio en pesos argentinos (sin centavos). */
export function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);
}
