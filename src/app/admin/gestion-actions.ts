"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  ProveedorInput,
  CompraItem,
  ActionResult,
  OrderItem,
} from "@/lib/types";

/**
 * Server Actions del sistema de gestión: proveedores, compras y ventas manuales.
 * - Las compras SUMAN stock (y guardan el costo).
 * - Las ventas manuales RESTAN stock.
 */

function revalidarGestion() {
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/proveedores");
  revalidatePath("/admin/compras");
  revalidatePath("/admin/ventas");
  // El stock cambió → refrescamos la web pública
  revalidatePath("/");
  revalidatePath("/tienda");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/* ------------------------------ Proveedores ------------------------------ */

export async function createProveedor(
  input: ProveedorInput,
): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("proveedores").insert({
    nombre: input.nombre.trim(),
    telefono: input.telefono?.trim() ?? "",
    email: input.email?.trim() ?? "",
    cuit: input.cuit?.trim() ?? "",
    notas: input.notas?.trim() ?? "",
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarGestion();
  redirect("/admin/proveedores");
}

export async function updateProveedor(
  id: string,
  input: ProveedorInput,
): Promise<ActionResult> {
  if (!input.nombre?.trim()) return { error: "El nombre es obligatorio." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("proveedores")
    .update({
      nombre: input.nombre.trim(),
      telefono: input.telefono?.trim() ?? "",
      email: input.email?.trim() ?? "",
      cuit: input.cuit?.trim() ?? "",
      notas: input.notas?.trim() ?? "",
    })
    .eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidarGestion();
  redirect("/admin/proveedores");
}

export async function deleteProveedor(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarGestion();
  return { ok: true };
}

/* -------------------------------- Compras -------------------------------- */

export async function createCompra(input: {
  proveedor_id: string | null;
  fecha: string;
  items: CompraItem[];
  notas: string;
}): Promise<ActionResult> {
  if (!input.items?.length)
    return { error: "Agregá al menos un producto a la compra." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const total = input.items.reduce(
    (a, i) => a + i.cantidad * i.costo_unitario,
    0,
  );

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      proveedor_id: input.proveedor_id,
      fecha: input.fecha || new Date().toISOString(),
      total,
      items: input.items,
      notas: input.notas?.trim() ?? "",
    })
    .select("id")
    .single();

  if (error || !compra)
    return { error: `No se pudo guardar la compra: ${error?.message}` };

  // Sumar stock y actualizar el costo de cada producto
  for (const it of input.items) {
    await supabase.rpc("sumar_stock", {
      p_product_id: it.product_id,
      p_cantidad: it.cantidad,
    });
    await supabase
      .from("products")
      .update({ costo: it.costo_unitario })
      .eq("id", it.product_id);
  }

  revalidarGestion();
  redirect("/admin/compras");
}

export async function deleteCompra(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // Traemos los ítems para revertir el stock que había sumado
  const { data: compra } = await supabase
    .from("compras")
    .select("items")
    .eq("id", id)
    .single();

  if (compra?.items) {
    for (const it of compra.items as CompraItem[]) {
      await supabase.rpc("descontar_stock", {
        p_product_id: it.product_id,
        p_cantidad: it.cantidad,
      });
    }
  }

  const { error } = await supabase.from("compras").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarGestion();
  return { ok: true };
}

/* ---------------------------- Ventas manuales ---------------------------- */

export async function createVentaManual(input: {
  cliente: string;
  medio_pago: string;
  fecha: string;
  items: OrderItem[];
  notas: string;
}): Promise<ActionResult> {
  if (!input.items?.length)
    return { error: "Agregá al menos un producto a la venta." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const total = input.items.reduce(
    (a, i) => a + i.cantidad * i.precio_unitario,
    0,
  );

  const { error } = await supabase.from("ventas").insert({
    cliente: input.cliente?.trim() ?? "",
    medio_pago: input.medio_pago?.trim() ?? "",
    fecha: input.fecha || new Date().toISOString(),
    total,
    items: input.items,
    notas: input.notas?.trim() ?? "",
  });

  if (error) return { error: `No se pudo guardar la venta: ${error.message}` };

  // Restar stock de cada producto vendido
  for (const it of input.items) {
    await supabase.rpc("descontar_stock", {
      p_product_id: it.product_id,
      p_cantidad: it.cantidad,
    });
  }

  revalidarGestion();
  redirect("/admin/ventas");
}

export async function deleteVentaManual(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };

  // Revertir stock: devolvemos lo vendido
  const { data: venta } = await supabase
    .from("ventas")
    .select("items")
    .eq("id", id)
    .single();

  if (venta?.items) {
    for (const it of venta.items as OrderItem[]) {
      await supabase.rpc("sumar_stock", {
        p_product_id: it.product_id,
        p_cantidad: it.cantidad,
      });
    }
  }

  const { error } = await supabase.from("ventas").delete().eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarGestion();
  return { ok: true };
}
