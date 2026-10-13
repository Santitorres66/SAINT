"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmarOrden } from "@/lib/confirmar-orden";
import { sincronizarPagoTalo } from "@/lib/pago-transferencia";
import type { ActionResult } from "@/lib/types";

/**
 * Acciones del admin sobre los pedidos web que se pagan por transferencia.
 *
 * Las órdenes solo las escribe el servidor con la clave service_role (RLS no
 * deja hacerlo con la sesión del admin), así que cada acción primero verifica
 * que haya un usuario logueado y recién después usa el cliente admin.
 */

async function usuarioLogueado(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? (user ? "admin" : null);
}

function revalidar() {
  revalidatePath("/admin");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/produccion");
  revalidatePath("/admin/productos");
  revalidatePath("/");
  revalidatePath("/tienda");
}

/**
 * "Ya vi la plata": confirma el pedido a mano. Es el camino del modo manual,
 * y también sirve para aceptar una transferencia que vino de menos.
 */
export async function confirmarTransferencia(id: string): Promise<ActionResult> {
  const usuario = await usuarioLogueado();
  if (!usuario) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  try {
    const ok = await confirmarOrden(createAdminClient(), id, {
      usuario,
      cambios: { pagado_at: new Date().toISOString(), notas: "" },
    });
    if (!ok) return { error: "Ese pedido ya estaba confirmado." };
  } catch (e) {
    console.error("confirmarTransferencia:", e);
    return { error: "No se pudo confirmar el pedido." };
  }
  revalidar();
  return { ok: true };
}

/** Cancela un pedido que no se va a pagar. No toca stock: nunca se descontó. */
export async function cancelarTransferencia(id: string): Promise<ActionResult> {
  const usuario = await usuarioLogueado();
  if (!usuario) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await createAdminClient()
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .neq("status", "approved");
  if (error) return { error: "No se pudo cancelar el pedido." };
  revalidar();
  return { ok: true };
}

/** Le pregunta a Talo cómo está el cobro, por si se perdió un aviso. */
export async function revisarEnTalo(id: string): Promise<ActionResult> {
  const usuario = await usuarioLogueado();
  if (!usuario) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const supabase = createAdminClient();
  const { data: orden } = await supabase
    .from("orders")
    .select("id, status, pago_id, pago_monto")
    .eq("id", id)
    .maybeSingle();
  if (!orden?.pago_id) return { error: "Este pedido no tiene cobro en Talo." };

  try {
    await sincronizarPagoTalo(supabase, orden);
  } catch (e) {
    console.error("revisarEnTalo:", e);
    return { error: "Talo no respondió. Probá de nuevo en un rato." };
  }
  revalidar();
  return { ok: true };
}

/** Saca la alerta de un pedido ya resuelto (ej.: se devolvió lo de más). */
export async function marcarTransferenciaRevisada(id: string): Promise<ActionResult> {
  const usuario = await usuarioLogueado();
  if (!usuario) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await createAdminClient()
    .from("orders")
    .update({ notas: "" })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el pedido." };
  revalidar();
  return { ok: true };
}
