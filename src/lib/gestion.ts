import { createClient } from "@/lib/supabase/server";
import type {
  Proveedor,
  Compra,
  CompraItem,
  Cobro,
  VentaManual,
  VentaUnificada,
  DashboardStats,
  Order,
  OrderItem,
} from "./types";
import { saldoVenta } from "./types";

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

export async function getCompraById(id: string): Promise<Compra | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("compras")
    .select("*, proveedores(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const c = data as Compra & { proveedores: { nombre: string } | null };
  return { ...c, proveedor_nombre: c.proveedores?.nombre ?? null };
}

/* -------------------------------- Ventas --------------------------------- */

export async function getVentaManualById(
  id: string,
): Promise<VentaManual | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ventas")
    .select("*, cobros(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const v = data as VentaManual & { cobros: Cobro[] | null };
  return {
    ...v,
    cobros: (v.cobros ?? []).sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    ),
  };
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
 *
 * Las ventas online ya vienen cobradas por Mercado Pago: se muestran siempre
 * como saldadas, sin saldo pendiente.
 */
export async function getVentasUnificadas(): Promise<VentaUnificada[]> {
  const supabase = await createClient();

  const [{ data: orders }, { data: manuales }, { data: ordenes }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("ventas")
        .select("*, cobros(*)")
        .order("fecha", { ascending: false }),
      // Órdenes de producción ya vendidas → para mostrar de qué orden vino
      // cada venta. Consulta aparte: el vínculo vive en `ordenes_produccion`.
      supabase
        .from("ordenes_produccion")
        .select("id, numero, venta_id")
        .not("venta_id", "is", null),
    ]);

  const ordenPorVenta = new Map(
    ((ordenes as { id: string; numero: number; venta_id: string }[]) ?? []).map(
      (o) => [o.venta_id, o],
    ),
  );

  const online: VentaUnificada[] = ((orders as Order[]) ?? []).map((o) => ({
    id: o.id,
    fecha: o.created_at,
    canal: "online",
    cliente: o.comprador?.nombre || o.comprador?.email || "Cliente web",
    medio_pago: "Mercado Pago",
    estado: "Pagada",
    total: Number(o.total),
    items: o.items ?? [],
    estado_cobro: "cobrado",
    descuento: 0,
    total_cobrado: Number(o.total),
    saldo: 0,
    fecha_cobro: o.created_at,
    cobros: [],
    orden_numero: null,
    orden_id: null,
  }));

  type VentaRow = VentaManual & { cobros: Cobro[] | null };

  const manual: VentaUnificada[] = ((manuales as VentaRow[]) ?? []).map((v) => ({
    id: v.id,
    fecha: v.fecha,
    canal: "manual",
    cliente: v.cliente || "—",
    medio_pago: v.medio_pago || "—",
    estado: "Completada",
    total: Number(v.total),
    items: v.items ?? [],
    estado_cobro: v.estado_cobro ?? "pendiente",
    descuento: Number(v.descuento ?? 0),
    total_cobrado: Number(v.total_cobrado ?? 0),
    saldo: saldoVenta({
      total: Number(v.total),
      descuento: Number(v.descuento ?? 0),
      total_cobrado: Number(v.total_cobrado ?? 0),
    }),
    fecha_cobro: v.fecha_cobro ?? null,
    cobros: (v.cobros ?? []).sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    ),
    orden_numero: ordenPorVenta.get(v.id)?.numero ?? null,
    orden_id: ordenPorVenta.get(v.id)?.id ?? null,
  }));

  return [...online, ...manual].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

/* ------------------------------- Tablero --------------------------------- */

/**
 * Separa un conjunto de compras según para qué se compró. Hace falta porque
 * mezclar una máquina bordadora con unos conos de hilo no dice nada: la
 * primera es inversión y los segundos, gasto del mes.
 *
 * El desglose sale de los ítems (cada uno sabe su tipo); `total` es el de la
 * compra, que es el número que se registró.
 */
function desglosarCompras(
  filas: { total: number; items: CompraItem[] | null }[],
) {
  let total = 0;
  let mercaderia = 0;
  let insumos = 0;
  let activos = 0;

  for (const c of filas) {
    total += Number(c.total) || 0;
    for (const it of c.items ?? []) {
      const monto = (Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0);
      switch (it.tipo ?? "mercaderia") {
        case "insumo":
          insumos += monto;
          break;
        case "activo_fijo":
          activos += monto;
          break;
        default:
          mercaderia += monto;
      }
    }
  }

  return { total, mercaderia, insumos, activos };
}

/**
 * Ventas (online aprobadas + manuales) para el análisis del tablero.
 * Trae los ítems para poder desglosar por rubro (qué se vendió, no solo cuánto).
 */
export async function getVentasParaAnalitica(): Promise<
  {
    fecha: string;
    total: number;
    cliente: string;
    canal: "online" | "manual";
    items: OrderItem[];
  }[]
> {
  const supabase = await createClient();
  const [{ data: orders, error: errOrders }, { data: manuales, error: errVentas }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("created_at, total, comprador, items")
        .eq("status", "approved"),
      supabase.from("ventas").select("fecha, total, cliente, items"),
    ]);
  if (errOrders) console.warn("getVentasParaAnalitica (orders):", errOrders.message);
  if (errVentas) console.warn("getVentasParaAnalitica (ventas):", errVentas.message);

  const online = (
    (orders as {
      created_at: string;
      total: number;
      comprador: { nombre?: string; email?: string } | null;
      items: OrderItem[] | null;
    }[]) ?? []
  ).map((o) => ({
    fecha: o.created_at,
    total: Number(o.total),
    cliente: o.comprador?.email || o.comprador?.nombre || "Cliente web",
    canal: "online" as const,
    items: o.items ?? [],
  }));

  const man = (
    (manuales as {
      fecha: string;
      total: number;
      cliente: string;
      items: OrderItem[] | null;
    }[]) ?? []
  ).map((v) => ({
    fecha: v.fecha,
    total: Number(v.total),
    cliente: v.cliente || "",
    canal: "manual" as const,
    items: v.items ?? [],
  }));

  return [...online, ...man];
}

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
    { data: variantesBajas },
    { data: cobrosMes },
    { data: ventasPendientes },
    { data: ordenesVendidas },
    { data: comprasTodas },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("total, items")
      .eq("status", "approved")
      .gte("created_at", inicioMes),
    supabase
      .from("ventas")
      .select("id, total, items")
      .gte("fecha", inicioMes),
    supabase.from("compras").select("total, items").gte("fecha", inicioMes),
    supabase.from("products").select("id, nombre, costo, precio, stock, activo"),
    supabase
      .from("product_variantes")
      .select("product_id, talle, color, stock, products(nombre, activo)")
      .lte("stock", 3),
    // Plata que entró este mes (por fecha del cobro, no de la venta)
    supabase.from("cobros").select("monto").gte("fecha", inicioMes),
    // Saldo pendiente de TODAS las ventas, no solo las del mes
    supabase
      .from("ventas")
      .select("total, descuento, total_cobrado")
      .neq("estado_cobro", "cobrado"),
    // Costo real de las prendas bordadas, para calcular bien la ganancia
    supabase
      .from("ordenes_produccion")
      .select("venta_id, costo_total")
      .not("venta_id", "is", null),
    // Todas las compras: para el acumulado (incluye lo cargado como histórico)
    supabase.from("compras").select("total, items"),
  ]);

  const prods =
    (productos as {
      id: string;
      nombre: string;
      costo: number;
      precio: number;
      stock: number;
      activo: boolean;
    }[]) ?? [];
  const costoMap = new Map(prods.map((p) => [p.id, Number(p.costo) || 0]));

  const ventasOnline = (ordersMes as { total: number; items: OrderItem[] }[]) ?? [];
  const ventasMan =
    (ventasMes as { id: string; total: number; items: OrderItem[] }[]) ?? [];

  const ventasMesTotal =
    ventasOnline.reduce((a, v) => a + Number(v.total), 0) +
    ventasMan.reduce((a, v) => a + Number(v.total), 0);
  const ventasMesCantidad = ventasOnline.length + ventasMan.length;

  type FilaCompra = { total: number; items: CompraItem[] | null };
  const compras = desglosarCompras((comprasMes as FilaCompra[]) ?? []);
  const comprasHist = desglosarCompras((comprasTodas as FilaCompra[]) ?? []);

  /* --- Cobros --- */
  const cobradoMesTotal = ((cobrosMes as { monto: number }[]) ?? []).reduce(
    (a, c) => a + Number(c.monto),
    0,
  );

  const pendientes =
    (ventasPendientes as {
      total: number;
      descuento: number;
      total_cobrado: number;
    }[]) ?? [];
  const saldos = pendientes.map((v) =>
    saldoVenta({
      total: Number(v.total),
      descuento: Number(v.descuento ?? 0),
      total_cobrado: Number(v.total_cobrado ?? 0),
    }),
  );
  const pendienteCobroTotal = saldos.reduce((a, s) => a + s, 0);
  const pendienteCobroCantidad = saldos.filter((s) => s > 0).length;

  /* --- Ganancia --- */
  // Una prenda bordada no cuesta lo mismo que la prenda pelada: su costo real
  // es el costo_total de la orden de producción (prenda + matriz + bordado +
  // otros). Para esas ventas usamos ese costo; para el resto, products.costo.
  const costoProduccionPorVenta = new Map(
    (
      (ordenesVendidas as { venta_id: string; costo_total: number }[]) ?? []
    ).map((o) => [o.venta_id, Number(o.costo_total) || 0]),
  );

  const gananciaOnline = ventasOnline
    .flatMap((v) => v.items ?? [])
    .reduce(
      (a, it) =>
        a +
        (Number(it.precio_unitario) - (costoMap.get(it.product_id ?? "") ?? 0)) *
          Number(it.cantidad),
      0,
    );

  const gananciaManual = ventasMan.reduce((a, v) => {
    const costoProduccion = costoProduccionPorVenta.get(v.id);
    if (costoProduccion !== undefined) {
      // Venta que cierra una orden de producción: el costo ya está calculado.
      return a + (Number(v.total) - costoProduccion);
    }
    return (
      a +
      (v.items ?? []).reduce(
        (b, it) =>
          b +
          (Number(it.precio_unitario) -
            (costoMap.get(it.product_id ?? "") ?? 0)) *
            Number(it.cantidad),
        0,
      )
    );
  }, 0);

  const margenBrutoMes = gananciaOnline + gananciaManual;

  // Lo que queda después de pagar los insumos del mes. Los activos fijos no
  // entran: una máquina no se "gasta" en el mes en que se compró.
  const resultadoMes = margenBrutoMes - compras.insumos;

  const stockBajo = (
    (variantesBajas as unknown as {
      product_id: string;
      talle: string;
      color: string;
      stock: number;
      products: { nombre: string; activo: boolean } | null;
    }[]) ?? []
  )
    .filter((v) => v.products?.activo)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)
    .map((v) => ({
      id: v.product_id,
      nombre: v.products?.nombre ?? "",
      talle: v.talle,
      color: v.color,
      stock: v.stock,
    }));

  const stockValorizadoCosto = prods.reduce(
    (a, p) => a + p.stock * (Number(p.costo) || 0),
    0,
  );
  const stockValorizadoVenta = prods.reduce(
    (a, p) => a + p.stock * (Number(p.precio) || 0),
    0,
  );
  const unidadesEnStock = prods.reduce((a, p) => a + p.stock, 0);

  return {
    ventasMesTotal,
    ventasMesCantidad,
    cobradoMesTotal,
    pendienteCobroTotal,
    pendienteCobroCantidad,
    comprasMesTotal: compras.total,
    comprasMesMercaderia: compras.mercaderia,
    comprasMesInsumos: compras.insumos,
    comprasMesActivos: compras.activos,
    comprasHistTotal: comprasHist.total,
    comprasHistMercaderia: comprasHist.mercaderia,
    comprasHistInsumos: comprasHist.insumos,
    comprasHistActivos: comprasHist.activos,
    margenBrutoMes,
    resultadoMes,
    productosActivos: prods.filter((p) => p.activo).length,
    stockBajo,
    stockValorizadoCosto,
    stockValorizadoVenta,
    unidadesEnStock,
  };
}
