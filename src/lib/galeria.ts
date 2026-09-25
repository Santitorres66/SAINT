import { createClient } from "@/lib/supabase/server";
import type { TrabajoGaleria } from "./types";

/**
 * Lecturas de la galería de trabajos reales.
 *
 * Como el resto de la capa de datos, estas funciones nunca lanzan: si la tabla
 * todavía no existe (falta correr `galeria.sql`), avisan por consola y
 * devuelven una lista vacía. La home y la galería se ven igual, solo que sin
 * trabajos — la web nunca se cae por una sección que todavía no cargaste.
 */

/** Los trabajos que ve el público. `soloDestacados` es lo que va en la home. */
export async function getTrabajos({
  soloDestacados = false,
  limit,
}: { soloDestacados?: boolean; limit?: number } = {}): Promise<
  TrabajoGaleria[]
> {
  const supabase = await createClient();
  let query = supabase
    .from("galeria_trabajos")
    .select("*")
    .eq("activo", true);

  if (soloDestacados) query = query.eq("destacado", true);

  // El orden de la galería: el manual manda y, entre empatados, lo más nuevo.
  query = query
    .order("orden", { ascending: true })
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.warn("getTrabajos:", error.message);
    return [];
  }
  // Un trabajo sin foto no es un trabajo: en un mosaico dejaría un hueco.
  return ((data as TrabajoGaleria[]) ?? []).filter((t) => t.imagenes?.length);
}

/**
 * Los trabajos de la home, con una red de seguridad: si todavía no marcaste
 * ninguno como destacado, se muestran los últimos igual. Cargar fotos y que la
 * home siga vacía porque faltó tildar una casilla sería una trampa boba.
 */
export async function getTrabajosDestacados(
  limit = 6,
): Promise<TrabajoGaleria[]> {
  const destacados = await getTrabajos({ soloDestacados: true, limit });
  if (destacados.length) return destacados;
  return getTrabajos({ limit });
}

/** Todos los trabajos, incluidos los inactivos, para el panel. */
export async function getTrabajosAdmin(): Promise<TrabajoGaleria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("galeria_trabajos")
    .select("*")
    .order("orden", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("getTrabajosAdmin:", error.message);
    return [];
  }
  return (data as TrabajoGaleria[]) ?? [];
}

/** Un trabajo por id (para editarlo). */
export async function getTrabajoById(
  id: string,
): Promise<TrabajoGaleria | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("galeria_trabajos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("getTrabajoById:", error.message);
    return null;
  }
  return (data as TrabajoGaleria) ?? null;
}
