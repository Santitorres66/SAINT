import { MercadoPagoConfig } from "mercadopago";

/**
 * Cliente de Mercado Pago (solo servidor).
 * Usa el Access Token privado (MP_ACCESS_TOKEN). Nunca exponer en el navegador.
 */
export function getMercadoPagoClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Falta MP_ACCESS_TOKEN en las variables de entorno.");
  }
  return new MercadoPagoConfig({ accessToken });
}

/** URL base del sitio (para vueltas de pago y webhook). */
export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
