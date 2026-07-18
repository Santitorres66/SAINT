import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Forma de cada cookie que Supabase pide setear. */
type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Cliente de Supabase para el SERVIDOR (Server Components, Server Actions).
 * Lee la sesión desde las cookies, así las lecturas del catálogo y las
 * escrituras del admin respetan las políticas RLS (anon vs. authenticated).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // En algunos contextos (Server Components) no se pueden setear cookies;
          // el refresco de sesión lo maneja el middleware, así que lo ignoramos.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // no-op
          }
        },
      },
    },
  );
}
