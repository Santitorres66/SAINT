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

/** Formatea un precio en pesos argentinos (sin centavos). */
export function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);
}
