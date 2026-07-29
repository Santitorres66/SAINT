import { createClient } from "@/lib/supabase/server";
import type {
  Matriz,
  MatrizConUso,
  OrdenProduccion,
  OrdenProduccionVista,
} from "./types";

/** Bucket privado donde viven los archivos de producción. */
export const BUCKET_PRODUCCION = "produccion";

/**
 * Genera URLs firmadas (temporales) para una lista de rutas del bucket privado.
 * Devuelve un Map ruta → URL firmada. Solo funciona con sesión de admin.
 */
export async function firmarUrls(
  paths: (string | null | undefined)[],
  expiraEn = 3600,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const validos = [...new Set(paths.filter((p): p is string => !!p))];
  if (!validos.length) return map;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET_PRODUCCION)
    .createSignedUrls(validos, expiraEn);

  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  });
  return map;
}

/** Firma una sola ruta (útil en el detalle). */
export async function firmarUrl(
  path: string | null,
  expiraEn = 3600,
): Promise<string | null> {
  if (!path) return null;
  const map = await firmarUrls([path], expiraEn);
  return map.get(path) ?? null;
}

/* ------------------------------- Matrices -------------------------------- */

export async function getMatrices(): Promise<MatrizConUso[]> {
  const supabase = await createClient();

  const [{ data: matrices }, { data: usos }] = await Promise.all([
    supabase.from("matrices").select("*").order("created_at", { ascending: false }),
    supabase.from("ordenes_produccion").select("matriz_id"),
  ]);

  const ms = (matrices as Matriz[]) ?? [];

  // Conteo de uso por matriz
  const conteo = new Map<string, number>();
  ((usos as { matriz_id: string | null }[]) ?? []).forEach((u) => {
    if (u.matriz_id) conteo.set(u.matriz_id, (conteo.get(u.matriz_id) ?? 0) + 1);
  });

  // URLs firmadas para imágenes y archivos
  const urls = await firmarUrls(ms.flatMap((m) => [m.imagen_path, m.archivo_path]));

  return ms.map((m) => ({
    ...m,
    veces_usada: conteo.get(m.id) ?? 0,
    imagen_url: m.imagen_path ? urls.get(m.imagen_path) ?? null : null,
    archivo_url: m.archivo_path ? urls.get(m.archivo_path) ?? null : null,
  }));
}

/** Matrices para elegir en el formulario de orden (lista liviana). */
export async function getMatricesSimple(): Promise<Matriz[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matrices")
    .select("*")
    .order("nombre", { ascending: true });
  return (data as Matriz[]) ?? [];
}

/* ------------------------- Órdenes de producción ------------------------- */

type OrdenRow = OrdenProduccion & {
  products: { nombre: string } | null;
  matrices: { nombre: string } | null;
};

export async function getOrdenesProduccion(): Promise<OrdenProduccionVista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordenes_produccion")
    .select("*, products(nombre), matrices(nombre)")
    .order("posicion", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getOrdenesProduccion:", error.message);
    return [];
  }

  const filas = (data as OrdenRow[]) ?? [];
  const urls = await firmarUrls(filas.map((o) => o.imagen_ref_path));

  return filas.map((o) => ({
    ...o,
    imagen_ref_url: o.imagen_ref_path
      ? urls.get(o.imagen_ref_path) ?? null
      : null,
    product_nombre: o.products?.nombre ?? null,
    matriz_nombre: o.matrices?.nombre ?? null,
  }));
}

export async function getOrdenProduccionById(
  id: string,
): Promise<OrdenProduccionVista | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ordenes_produccion")
    .select("*, products(nombre), matrices(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const o = data as OrdenRow;
  return {
    ...o,
    imagen_ref_url: await firmarUrl(o.imagen_ref_path),
    product_nombre: o.products?.nombre ?? null,
    matriz_nombre: o.matrices?.nombre ?? null,
  };
}
