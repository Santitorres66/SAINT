/**
 * Cliente mínimo de la API de Talo (solo servidor).
 *
 * Talo es quien le da a cada pedido su propio CVU y alias: el cliente
 * transfiere el monto exacto ahí y Talo nos avisa por webhook. Como el CVU es
 * único por pedido, no hace falta adivinar de quién es una transferencia.
 *
 * Docs: https://docs.talo.com.ar/transfers/payments-api
 *
 * Variables de entorno:
 *   TALO_USER_ID, TALO_CLIENT_ID, TALO_CLIENT_SECRET  → Dashboard de Talo,
 *     Usuario → Credenciales.
 *   TALO_SANDBOX=1  → usa sandbox-api.talo.com.ar (plata de mentira).
 */

export type EstadoPagoTalo =
  | "PENDING"
  | "SUCCESS"
  | "OVERPAID"
  | "UNDERPAID"
  | "EXPIRED";

export type PagoTalo = {
  id: string;
  payment_status: EstadoPagoTalo;
  external_id?: string | null;
  expiration_timestamp?: string | null;
  payment_url?: string | null;
  price?: { amount: number | string; currency: string };
  quotes?: {
    cvu?: string;
    address?: string;
    alias?: string;
    amount?: number | string;
    currency?: string;
  }[];
};

/** Si Talo está configurado. Sin esto, la tienda usa el modo manual. */
export function taloConfigurado(): boolean {
  return Boolean(
    process.env.TALO_USER_ID &&
      process.env.TALO_CLIENT_ID &&
      process.env.TALO_CLIENT_SECRET,
  );
}

function baseUrl(): string {
  return process.env.TALO_SANDBOX === "1"
    ? "https://sandbox-api.talo.com.ar"
    : "https://api.talo.com.ar";
}

/* --- Token de acceso -------------------------------------------------
 * Talo no documenta cuánto dura el token, así que se guarda un rato en
 * memoria y, si una consulta vuelve 401, se pide uno nuevo una vez.
 */
let tokenCache: { token: string; vence: number } | null = null;
const TOKEN_TTL_MS = 30 * 60 * 1000;

async function obtenerToken(forzar = false): Promise<string> {
  if (!forzar && tokenCache && tokenCache.vence > Date.now()) {
    return tokenCache.token;
  }
  const userId = process.env.TALO_USER_ID!;
  const res = await fetch(`${baseUrl()}/users/${userId}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.TALO_CLIENT_ID,
      client_secret: process.env.TALO_CLIENT_SECRET,
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  const token = json?.data?.token as string | undefined;
  if (!res.ok || !token) {
    throw new Error(`Talo: no se pudo obtener el token (${res.status})`);
  }
  tokenCache = { token, vence: Date.now() + TOKEN_TTL_MS };
  return token;
}

/** Algunas respuestas vienen en { data: ... } y otras sueltas. */
function desenvolver<T>(json: unknown): T {
  const j = json as { data?: T } | null;
  return (j && typeof j === "object" && "data" in j ? j.data : json) as T;
}

/**
 * Crea el cobro de un pedido y devuelve el CVU/alias a mostrar.
 *
 * Se llama solo desde el servidor y con el monto que calculó la base: el
 * endpoint de Talo es público (alcanza con el user_id), así que lo único
 * confiable es lo que después devuelve la consulta con token.
 */
export async function crearPagoTalo(datos: {
  orderId: string;
  monto: number;
  motivo: string;
  webhookUrl: string;
  redirectUrl: string;
  cliente: { nombre: string; telefono: string; email: string };
}): Promise<PagoTalo> {
  const [nombre, ...resto] = datos.cliente.nombre.split(" ");
  const res = await fetch(`${baseUrl()}/payments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: process.env.TALO_USER_ID,
      price: { amount: datos.monto, currency: "ARS" },
      payment_options: ["transfer"],
      external_id: datos.orderId,
      webhook_url: datos.webhookUrl,
      redirect_url: datos.redirectUrl,
      motive: datos.motivo,
      client_data: {
        first_name: nombre || undefined,
        last_name: resto.join(" ") || undefined,
        phone: datos.cliente.telefono || undefined,
        email: datos.cliente.email || undefined,
      },
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    throw new Error(
      `Talo: no se pudo crear el cobro (${res.status}) ${JSON.stringify(json)}`,
    );
  }
  return desenvolver<PagoTalo>(json);
}

/** Consulta un cobro con token: esta es la única fuente confiable. */
export async function consultarPagoTalo(paymentId: string): Promise<PagoTalo> {
  const url = `${baseUrl()}/payments/${encodeURIComponent(paymentId)}`;
  const pedir = async (token: string) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

  let res = await pedir(await obtenerToken());
  if (res.status === 401 || res.status === 403) {
    res = await pedir(await obtenerToken(true));
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    throw new Error(`Talo: no se pudo consultar el cobro (${res.status})`);
  }
  return desenvolver<PagoTalo>(json);
}

/** El CVU y el alias de un cobro, vengan con el nombre de campo que vengan. */
export function datosDeTransferencia(pago: PagoTalo): {
  cvu: string | null;
  alias: string | null;
} {
  const q = pago.quotes?.[0];
  return {
    cvu: q?.cvu ?? q?.address ?? null,
    alias: q?.alias ?? null,
  };
}
