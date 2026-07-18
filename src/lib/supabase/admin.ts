import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la clave SECRETA (service_role).
 *
 * ⚠️ USO EXCLUSIVO DEL SERVIDOR. Nunca importar esto en un componente que
 * corra en el navegador. Saltea las políticas RLS, así que solo se usa en
 * rutas de API/webhooks (crear órdenes, descontar stock) donde no hay una
 * sesión de usuario (por ejemplo, cuando Mercado Pago nos avisa de un pago).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
