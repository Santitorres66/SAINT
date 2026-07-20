import { createClient } from "@/lib/supabase/server";
import type {
  Proveedor,
  Compra,
  VentaManual,
  VentaUnificada,
  DashboardStats,
  Order,
  OrderItem,
} from "./types";

/* ------------------------------ Proveedores ------------------------------ */

export async function getProveedores(): Promise<Proveedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) {
    console.warn("getProveedores:", error.message);
    return [];
  }
  return (data as Proveedor[]) ?? [];
}

export async function getProveedorById(id: string): Promise<Proveedor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proveedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Proveedor) ?? null;
}

/* -------------------------------- Compras -------------------------------- */

export async function getCompras(): Promise<Compra[]> {
  const supabase = await createClient();
  // Traemos la compra junto al nombre del proveedor
  const { data, error } = await supabase
    .from("compras")
    .select("*, proveedores(nombre)")
    .order("fecha", { ascending: false });
  if (error) {
    console.warn("getCompras:", error.message);
    return [];
  }
  return (
    (data as (Compra & { proveedores: { nombre: string } | null })[]) ?? []
  ).map((c) => ({
    ...c,
    proveedor_nombre: c.proveedores?.nombre ?? null,
  }));
}

/* -------------------------------- Ventas --------------------------------- */

export async function getVentaManualById(
  id: string,
): Promise<VentaManual | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ventas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as VentaManual) ?? null;
}

export async function getVentasManuales(): Promise<VentaManual[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) {
    console.warn("getVentasManuales:", error.message);
    return [];
  }
  return (data as VentaManual[]) ?? [];
}

/**
 * Listado unificado de ventas: online (Mercado Pago, aprobadas) + manuales.
 * Ordenado de la más nueva a la más vieja.
 */
export async function getVentasUnificadas(): Promise<VentaUnificada[]> {
  const supabase = await createClient();

  const [{ data: orders }, { data: manuales }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase.from("ventas").select("*").order("fecha", { ascending: false }),
  ]);

  const online: VentaUnificada[] = ((orders as Order[]) ?? []).map((o) => ({
    id: o.id,
    fecha: o.created_at,
    canal: "online",
    cliente: o.comprador?.nombre || o.comprador?.email || "Cliente web",
    medio_pago: "Mercado Pago",
    estado: "Pagada",
    total: o.total,
    items: o.items ?? [],
  }));

  const manual: VentaUnificada[] = ((manuales as VentaManual[]) ?? []).map(
    (v) => ({
      id: v.id,
      fecha: v.fecha,
      canal: "manual",
      cliente: v.cliente || "—",
      medio_pago: v.medio_pago || "—",
      estado: "Completada",
      total: v.total,
      items: v.items ?? [],
    }),
  );

  return [...online, ...manual].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

/* ------------------------------- Tablero --------------------------------- */

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const now = new Date();
  const inicioMes = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const [
    { data: ordersMes },
    { data: ventasMes },
    { data: comprasMes },
    { data: productos },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("total, items")
      .eq("status", "approved")
      .gte("created_at", inicioMes),
    supabase.from("ventas").select("total, items").gte("fecha", inicioMes),
    supabase.from("compras").select("total").gte("fecha", inicioMes),
    supabase.from("products").select("id, nombre, costo, stock, activo"),
  ]);

  const prods =
    (productos as {
      id: string;
      nombre: string;
      costo: number;
      stock: number;
      activo: boolean;
    }[]) ?? [];
  const costoMap = new Map(prods.map((p) => [p.id, Number(p.costo) || 0]));

  const ventasOnline = (ordersMes as { total: number; items: OrderItem[] }[]) ?? [];
  const ventasMan = (ventasMes as { total: number; items: OrderItem[] }[]) ?? [];

  const ventasMesTotal =
    ventasOnline.reduce((a, v) => a + Number(v.total), 0) +
    ventasMan.reduce((a, v) => a + Number(v.total), 0);
  const ventasMesCantidad = ventasOnline.length + ventasMan.length;

  const comprasMesTotal = (
    (comprasMes as { total: number }[]) ?? []
  ).reduce((a, c) => a + Number(c.total), 0);

  // Ganancia estimada = suma de (precio de venta - costo) por cada unidad vendida
  const todosItems = [...ventasOnline, ...ventasMan].flatMap(
    (v) => v.items ?? [],
  );
  const gananciaMesEstimada = todosItems.reduce(
    (a, it) =>
      a +
      (Number(it.precio_unitario) - (costoMap.get(it.product_id ?? "") ?? 0)) *
        Number(it.cantidad),
    0,
  );

  const stockBajo = prods
    .filter((p) => p.activo && p.stock <= 3)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)
    .map((p) => ({ id: p.id, nombre: p.nombre, stock: p.stock }));

  return {
    ventasMesTotal,
    ventasMesCantidad,
    comprasMesTotal,
    gananciaMesEstimada,
    productosActivos: prods.filter((p) => p.activo).length,
    stockBajo,
  };
}
