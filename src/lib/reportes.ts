import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  labelCategoria,
  labelCobro,
  labelFamilia,
  labelMolde,
  categoriaDeItem,
  formatNumeroOrden,
} from "./constants";
import { describirBordado } from "./bordado";
import type { CompraItem, OrderItem, TipoItemCompra } from "./types";
import { saldoVenta } from "./types";

/**
 * Reportes descargables en Excel (ventas, compras y stock).
 *
 * La idea es sacar TODO lo que el panel sabe, una fila por renglón, para que
 * se pueda filtrar y cruzar en Excel. Cada archivo trae una hoja de detalle
 * (lo más completo) y hojas de resumen armadas a partir de ese mismo detalle,
 * así los números de un lado y del otro siempre cierran.
 *
 * Solo corre en el servidor y con la sesión del admin: RLS no le deja leer
 * estas tablas a nadie más.
 */

/** Rango de fechas del reporte, en días de Argentina ("2026-09-01"). */
export type RangoReporte = { desde?: string; hasta?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/* ------------------------------ Utilidades ------------------------------ */

const OFFSET_AR = "-03:00";

/** Límites del rango como timestamps, tomando el día entero en hora argentina. */
function limites({ desde, hasta }: RangoReporte) {
  const esDia = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    desde: esDia(desde) ? `${desde}T00:00:00${OFFSET_AR}` : null,
    hasta: esDia(hasta) ? `${hasta}T23:59:59.999${OFFSET_AR}` : null,
  };
}

/**
 * Excel no guarda zona horaria: muestra la fecha tal cual la recibe en UTC.
 * Se corre tres horas para que en la planilla se lea la hora de Argentina.
 */
function fechaAR(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t - 3 * 3600 * 1000);
}

/**
 * Supabase corta cada consulta en 1000 filas. Para un reporte hay que traer
 * todo, así que se pide de a páginas hasta que venga una incompleta.
 */
async function traerTodo<T>(
  consulta: (
    desde: number,
    hasta: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  etiqueta: string,
): Promise<T[]> {
  const PAGINA = 1000;
  const filas: T[] = [];
  for (let i = 0; ; i += PAGINA) {
    const { data, error } = await consulta(i, i + PAGINA - 1);
    if (error) {
      console.warn(`reportes (${etiqueta}):`, error.message);
      break;
    }
    const lote = (data as T[]) ?? [];
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return filas;
}

/** Una relación a-uno puede llegar como objeto o como array de uno. */
function uno<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const n = (v: unknown) => Number(v) || 0;

const FORMATO_PESOS = '"$" #,##0;[Red]-"$" #,##0';
const FORMATO_FECHA = "dd/mm/yyyy";
const FORMATO_FECHA_HORA = "dd/mm/yyyy hh:mm";

type Columna = {
  titulo: string;
  clave: string;
  ancho?: number;
  tipo?: "pesos" | "fecha" | "fechaHora" | "numero";
  /** Si se suma en la fila de totales. */
  total?: boolean;
};

/**
 * Agrega una hoja con encabezado fijo, filtros, formatos y una fila de
 * totales (con fórmulas, así sigue cerrando si se borran filas en Excel).
 */
function agregarHoja(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: Columna[],
  filas: Record<string, unknown>[],
) {
  const hoja = libro.addWorksheet(nombre, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  hoja.columns = columnas.map((c) => ({
    header: c.titulo,
    key: c.clave,
    width:
      c.ancho ??
      (c.tipo === "fechaHora" ? 17 : c.tipo === "fecha" ? 12 : c.tipo ? 14 : 18),
    style:
      c.tipo === "pesos"
        ? { numFmt: FORMATO_PESOS }
        : c.tipo === "fecha"
          ? { numFmt: FORMATO_FECHA }
          : c.tipo === "fechaHora"
            ? { numFmt: FORMATO_FECHA_HORA }
            : {},
  }));

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF171717" },
  };
  encabezado.alignment = { vertical: "middle", wrapText: true };
  encabezado.height = 30;

  hoja.addRows(filas);

  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: filas.length + 1, column: columnas.length },
    };
  }

  if (columnas.some((c) => c.total)) {
    const ultima = filas.length + 1;
    const fila = hoja.addRow({});
    fila.font = { bold: true };
    fila.getCell(1).value = "TOTAL";
    columnas.forEach((c, i) => {
      if (!c.total) return;
      const letra = hoja.getColumn(i + 1).letter;
      const suma = filas.reduce((a, f) => a + n(f[c.clave]), 0);
      fila.getCell(i + 1).value = {
        formula: filas.length ? `SUBTOTAL(9,${letra}2:${letra}${ultima})` : "0",
        result: suma,
      };
    });
    fila.border = { top: { style: "thin" } };
  }

  return hoja;
}

/** Hoja de portada: qué es el archivo y de qué período. */
function agregarPortada(
  libro: ExcelJS.Workbook,
  titulo: string,
  rango: RangoReporte | null,
  notas: string[],
) {
  const hoja = libro.addWorksheet("Info");
  hoja.getColumn(1).width = 22;
  hoja.getColumn(2).width = 90;
  hoja.addRow([`SAINT · ${titulo}`]).font = { bold: true, size: 14 };
  hoja.addRow([]);
  const hoy = new Date().toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  hoja.addRow(["Generado", hoy]);
  if (rango) {
    const fmt = (s?: string) =>
      s ? s.split("-").reverse().join("/") : null;
    const periodo =
      rango.desde || rango.hasta
        ? `${fmt(rango.desde) ?? "el inicio"} a ${fmt(rango.hasta) ?? "hoy"}`
        : "Todo el historial";
    hoja.addRow(["Período", periodo]);
  }
  hoja.addRow([]);
  for (const nota of notas) {
    const fila = hoja.addRow(["", nota]);
    fila.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  return hoja;
}

export async function libroABuffer(libro: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await libro.xlsx.writeBuffer());
}

function nuevoLibro() {
  const libro = new ExcelJS.Workbook();
  libro.creator = "SAINT · Gestión";
  libro.created = new Date();
  return libro;
}

type Producto = {
  id: string;
  nombre: string;
  categoria: string;
  familia: string | null;
  molde: string | null;
  costo: number;
  precio: number;
  stock: number;
  activo: boolean;
};

async function traerProductos(supabase: Supabase) {
  const productos = await traerTodo<Producto>(
    (a, b) =>
      supabase
        .from("products")
        .select("id, nombre, categoria, familia, molde, costo, precio, stock, activo")
        .order("nombre")
        .range(a, b),
    "products",
  );
  return productos;
}

/* -------------------------------- Ventas -------------------------------- */

type ClienteRow = {
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  localidad: string | null;
  provincia: string | null;
};

type VentaRow = {
  id: string;
  fecha: string;
  cliente: string | null;
  medio_pago: string | null;
  total: number;
  descuento: number | null;
  total_cobrado: number | null;
  estado_cobro: string | null;
  fecha_cobro: string | null;
  items: OrderItem[] | null;
  notas: string | null;
  clientes: ClienteRow | ClienteRow[] | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  total: number;
  items: OrderItem[] | null;
  comprador: { nombre?: string; email?: string } | null;
};

type CobroRow = {
  fecha: string;
  monto: number;
  medio_pago: string | null;
  cuotas: number | null;
  monto_cuota: number | null;
  notas: string | null;
  ventas: { fecha: string; cliente: string | null } | { fecha: string; cliente: string | null }[] | null;
};

/** Una venta ya normalizada, venga de la web o del panel. */
type Venta = {
  fecha: string;
  canal: string;
  cliente: string;
  telefono: string;
  email: string;
  localidad: string;
  medio_pago: string;
  total: number;
  descuento: number;
  cobrado: number;
  saldo: number;
  estado_cobro: string;
  fecha_cobro: string | null;
  items: OrderItem[];
  orden: string;
  /** Costo de la orden de producción, si la venta la cerró. */
  costo_produccion: number | null;
  notas: string;
};

export async function reporteVentas(rango: RangoReporte) {
  const supabase = await createClient();
  const { desde, hasta } = limites(rango);

  const [manuales, online, cobros, ordenes, productos] = await Promise.all([
    traerTodo<VentaRow>((a, b) => {
      let q = supabase
        .from("ventas")
        .select(
          "id, fecha, cliente, medio_pago, total, descuento, total_cobrado, estado_cobro, fecha_cobro, items, notas, clientes(nombre, apellido, telefono, email, localidad, provincia)",
        );
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      return q.order("fecha", { ascending: false }).range(a, b);
    }, "ventas"),
    traerTodo<OrderRow>((a, b) => {
      let q = supabase
        .from("orders")
        .select("id, created_at, total, items, comprador")
        .eq("status", "approved");
      if (desde) q = q.gte("created_at", desde);
      if (hasta) q = q.lte("created_at", hasta);
      return q.order("created_at", { ascending: false }).range(a, b);
    }, "orders"),
    // Los cobros se filtran por la fecha en que entró la plata, no la de la venta.
    traerTodo<CobroRow>((a, b) => {
      let q = supabase
        .from("cobros")
        .select("fecha, monto, medio_pago, cuotas, monto_cuota, notas, ventas(fecha, cliente)");
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      return q.order("fecha", { ascending: false }).range(a, b);
    }, "cobros"),
    traerTodo<{ numero: number; venta_id: string; costo_total: number }>(
      (a, b) =>
        supabase
          .from("ordenes_produccion")
          .select("numero, venta_id, costo_total")
          .not("venta_id", "is", null)
          .range(a, b),
      "ordenes_produccion",
    ),
    traerProductos(supabase),
  ]);

  const productoPorId = new Map(productos.map((p) => [p.id, p]));
  const categoriaPorProducto = Object.fromEntries(
    productos.map((p) => [p.id, p.categoria]),
  );
  const ordenPorVenta = new Map(ordenes.map((o) => [o.venta_id, o]));

  const ventas: Venta[] = [
    ...online.map((o) => ({
      fecha: o.created_at,
      canal: "Web",
      cliente: o.comprador?.nombre || o.comprador?.email || "Cliente web",
      telefono: "",
      email: o.comprador?.email ?? "",
      localidad: "",
      medio_pago: "Mercado Pago",
      total: n(o.total),
      descuento: 0,
      cobrado: n(o.total),
      saldo: 0,
      estado_cobro: "cobrado",
      fecha_cobro: o.created_at,
      items: o.items ?? [],
      orden: "",
      costo_produccion: null,
      notas: "",
    })),
    ...manuales.map((v) => {
      const c = uno(v.clientes);
      const orden = ordenPorVenta.get(v.id);
      return {
        fecha: v.fecha,
        canal: "Manual",
        cliente:
          v.cliente ||
          (c ? [c.nombre, c.apellido].filter(Boolean).join(" ") : "") ||
          "—",
        telefono: c?.telefono ?? "",
        email: c?.email ?? "",
        localidad: [c?.localidad, c?.provincia].filter(Boolean).join(", "),
        medio_pago: v.medio_pago ?? "",
        total: n(v.total),
        descuento: n(v.descuento),
        cobrado: n(v.total_cobrado),
        saldo: saldoVenta({
          total: n(v.total),
          descuento: n(v.descuento),
          total_cobrado: n(v.total_cobrado),
        }),
        estado_cobro: v.estado_cobro ?? "pendiente",
        fecha_cobro: v.fecha_cobro,
        items: v.items ?? [],
        orden: orden ? formatNumeroOrden(orden.numero) : "",
        costo_produccion: orden ? n(orden.costo_total) : null,
        notas: v.notas ?? "",
      };
    }),
  ].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));

  /* --- Detalle: una fila por producto vendido --- */
  const detalle: Record<string, unknown>[] = [];
  const porProducto = new Map<
    string,
    { producto: string; categoria: string; unidades: number; facturado: number; costo: number; ventas: number }
  >();

  for (const v of ventas) {
    const unidadesVenta = v.items.reduce((a, it) => a + n(it.cantidad), 0);
    for (const it of v.items) {
      const cantidad = n(it.cantidad);
      const precio = n(it.precio_unitario);
      const subtotal = cantidad * precio;
      // Si la venta cerró una orden de bordado, su costo real es el de la
      // orden (prenda + matriz + bordado), repartido entre sus unidades.
      const costoUnit =
        v.costo_produccion !== null && unidadesVenta > 0
          ? v.costo_produccion / unidadesVenta
          : n(productoPorId.get(it.product_id ?? "")?.costo);
      const categoria = labelCategoria(categoriaDeItem(it, categoriaPorProducto));

      detalle.push({
        fecha: fechaAR(v.fecha),
        canal: v.canal,
        cliente: v.cliente,
        telefono: v.telefono,
        email: v.email,
        localidad: v.localidad,
        producto: it.nombre,
        categoria,
        talle: it.talle ?? "",
        color: it.color ?? "",
        bordado: it.bordado ? describirBordado(it.bordado) : "",
        cantidad,
        precio,
        subtotal,
        costo_unit: costoUnit,
        ganancia: subtotal - costoUnit * cantidad,
        medio_pago: v.medio_pago,
        estado_cobro: labelCobro(v.estado_cobro),
        cobrado: v.estado_cobro === "cobrado" ? "Sí" : "No",
        orden: v.orden,
        notas: v.notas,
      });

      const clave = `${it.product_id ?? it.nombre}`;
      const acc = porProducto.get(clave) ?? {
        producto: it.nombre,
        categoria,
        unidades: 0,
        facturado: 0,
        costo: 0,
        ventas: 0,
      };
      acc.unidades += cantidad;
      acc.facturado += subtotal;
      acc.costo += costoUnit * cantidad;
      acc.ventas += 1;
      porProducto.set(clave, acc);
    }
  }

  const libro = nuevoLibro();
  agregarPortada(libro, "Reporte de ventas", rango, [
    "Detalle: una fila por cada producto vendido (si una venta tuvo 3 prendas, son 3 filas). Es la hoja para filtrar por cliente, producto, talle, color o estado de cobro.",
    "Ventas: una fila por venta, con total, descuento, lo cobrado y el saldo pendiente.",
    "Por producto y Por cliente: resúmenes armados con el mismo detalle.",
    "Cobros: la plata que entró en el período, por fecha de cobro (una venta de un mes puede cobrarse al siguiente).",
    "Incluye ventas manuales y ventas web aprobadas (estas ya vienen cobradas por Mercado Pago).",
    "El costo es el costo actual del producto; si la venta cerró una orden de bordado, se usa el costo real de esa orden. La ganancia es precio menos costo, antes de insumos y descuentos.",
  ]);

  agregarHoja(
    libro,
    "Detalle",
    [
      { titulo: "Fecha", clave: "fecha", tipo: "fechaHora" },
      { titulo: "Canal", clave: "canal", ancho: 9 },
      { titulo: "Cliente", clave: "cliente", ancho: 24 },
      { titulo: "Teléfono", clave: "telefono", ancho: 15 },
      { titulo: "Email", clave: "email", ancho: 24 },
      { titulo: "Localidad", clave: "localidad", ancho: 18 },
      { titulo: "Producto", clave: "producto", ancho: 30 },
      { titulo: "Categoría", clave: "categoria", ancho: 14 },
      { titulo: "Talle", clave: "talle", ancho: 8 },
      { titulo: "Color", clave: "color", ancho: 12 },
      { titulo: "Bordado", clave: "bordado", ancho: 30 },
      { titulo: "Cantidad", clave: "cantidad", tipo: "numero", ancho: 10, total: true },
      { titulo: "Precio unitario", clave: "precio", tipo: "pesos" },
      { titulo: "Subtotal", clave: "subtotal", tipo: "pesos", total: true },
      { titulo: "Costo unitario", clave: "costo_unit", tipo: "pesos" },
      { titulo: "Ganancia", clave: "ganancia", tipo: "pesos", total: true },
      { titulo: "Medio de pago", clave: "medio_pago", ancho: 15 },
      { titulo: "Estado de cobro", clave: "estado_cobro", ancho: 18 },
      { titulo: "¿Cobrado?", clave: "cobrado", ancho: 10 },
      { titulo: "Orden de producción", clave: "orden", ancho: 12 },
      { titulo: "Notas", clave: "notas", ancho: 30 },
    ],
    detalle,
  );

  agregarHoja(
    libro,
    "Ventas",
    [
      { titulo: "Fecha", clave: "fecha", tipo: "fechaHora" },
      { titulo: "Canal", clave: "canal", ancho: 9 },
      { titulo: "Cliente", clave: "cliente", ancho: 24 },
      { titulo: "Teléfono", clave: "telefono", ancho: 15 },
      { titulo: "Productos", clave: "productos", ancho: 45 },
      { titulo: "Unidades", clave: "unidades", tipo: "numero", ancho: 10, total: true },
      { titulo: "Total", clave: "total", tipo: "pesos", total: true },
      { titulo: "Descuento", clave: "descuento", tipo: "pesos", total: true },
      { titulo: "Cobrado", clave: "cobrado", tipo: "pesos", total: true },
      { titulo: "Saldo pendiente", clave: "saldo", tipo: "pesos", total: true },
      { titulo: "Estado de cobro", clave: "estado_cobro", ancho: 18 },
      { titulo: "Fecha de cobro", clave: "fecha_cobro", tipo: "fecha" },
      { titulo: "Medio de pago", clave: "medio_pago", ancho: 15 },
      { titulo: "Orden de producción", clave: "orden", ancho: 12 },
      { titulo: "Notas", clave: "notas", ancho: 30 },
    ],
    ventas.map((v) => ({
      fecha: fechaAR(v.fecha),
      canal: v.canal,
      cliente: v.cliente,
      telefono: v.telefono,
      productos: v.items
        .map((it) =>
          [
            `${n(it.cantidad)}× ${it.nombre}`,
            [it.talle, it.color].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .join(" · "),
        )
        .join(" | "),
      unidades: v.items.reduce((a, it) => a + n(it.cantidad), 0),
      total: v.total,
      descuento: v.descuento,
      cobrado: v.cobrado,
      saldo: v.saldo,
      estado_cobro: labelCobro(v.estado_cobro),
      fecha_cobro: fechaAR(v.fecha_cobro),
      medio_pago: v.medio_pago,
      orden: v.orden,
      notas: v.notas,
    })),
  );

  agregarHoja(
    libro,
    "Por producto",
    [
      { titulo: "Producto", clave: "producto", ancho: 32 },
      { titulo: "Categoría", clave: "categoria", ancho: 14 },
      { titulo: "Unidades", clave: "unidades", tipo: "numero", ancho: 10, total: true },
      { titulo: "Facturado", clave: "facturado", tipo: "pesos", total: true },
      { titulo: "Costo", clave: "costo", tipo: "pesos", total: true },
      { titulo: "Ganancia", clave: "ganancia", tipo: "pesos", total: true },
      { titulo: "Precio promedio", clave: "promedio", tipo: "pesos" },
    ],
    [...porProducto.values()]
      .sort((a, b) => b.facturado - a.facturado)
      .map((p) => ({
        ...p,
        ganancia: p.facturado - p.costo,
        promedio: p.unidades ? p.facturado / p.unidades : 0,
      })),
  );

  const porCliente = new Map<
    string,
    { cliente: string; telefono: string; ventas: number; unidades: number; total: number; cobrado: number; saldo: number; ultima: string }
  >();
  for (const v of ventas) {
    const clave = v.cliente.trim().toLowerCase();
    const acc = porCliente.get(clave) ?? {
      cliente: v.cliente,
      telefono: v.telefono,
      ventas: 0,
      unidades: 0,
      total: 0,
      cobrado: 0,
      saldo: 0,
      ultima: v.fecha,
    };
    acc.ventas += 1;
    acc.unidades += v.items.reduce((a, it) => a + n(it.cantidad), 0);
    acc.total += v.total;
    acc.cobrado += v.cobrado;
    acc.saldo += v.saldo;
    if (!acc.telefono) acc.telefono = v.telefono;
    if (Date.parse(v.fecha) > Date.parse(acc.ultima)) acc.ultima = v.fecha;
    porCliente.set(clave, acc);
  }

  agregarHoja(
    libro,
    "Por cliente",
    [
      { titulo: "Cliente", clave: "cliente", ancho: 26 },
      { titulo: "Teléfono", clave: "telefono", ancho: 15 },
      { titulo: "Ventas", clave: "ventas", tipo: "numero", ancho: 9, total: true },
      { titulo: "Unidades", clave: "unidades", tipo: "numero", ancho: 10, total: true },
      { titulo: "Total comprado", clave: "total", tipo: "pesos", total: true },
      { titulo: "Cobrado", clave: "cobrado", tipo: "pesos", total: true },
      { titulo: "Saldo pendiente", clave: "saldo", tipo: "pesos", total: true },
      { titulo: "Última compra", clave: "ultima", tipo: "fecha" },
    ],
    [...porCliente.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, ultima: fechaAR(c.ultima) })),
  );

  agregarHoja(
    libro,
    "Cobros",
    [
      { titulo: "Fecha de cobro", clave: "fecha", tipo: "fechaHora" },
      { titulo: "Cliente", clave: "cliente", ancho: 24 },
      { titulo: "Fecha de la venta", clave: "fecha_venta", tipo: "fecha" },
      { titulo: "Monto", clave: "monto", tipo: "pesos", total: true },
      { titulo: "Medio de pago", clave: "medio_pago", ancho: 15 },
      { titulo: "Cuotas", clave: "cuotas", tipo: "numero", ancho: 8 },
      { titulo: "Monto por cuota", clave: "monto_cuota", tipo: "pesos" },
      { titulo: "Notas", clave: "notas", ancho: 30 },
    ],
    cobros.map((c) => {
      const venta = uno(c.ventas);
      return {
        fecha: fechaAR(c.fecha),
        cliente: venta?.cliente || "—",
        fecha_venta: fechaAR(venta?.fecha),
        monto: n(c.monto),
        medio_pago: c.medio_pago ?? "",
        cuotas: n(c.cuotas) || 1,
        monto_cuota: n(c.monto_cuota),
        notas: c.notas ?? "",
      };
    }),
  );

  return libro;
}

/* -------------------------------- Compras ------------------------------- */

const TIPO_ITEM: Record<TipoItemCompra, string> = {
  mercaderia: "Mercadería",
  insumo: "Insumo",
  activo_fijo: "Maquinaria / herramienta",
};

type CompraRow = {
  fecha: string;
  total: number;
  items: CompraItem[] | null;
  medio_pago: string | null;
  cuotas: number | null;
  monto_cuota: number | null;
  notas: string | null;
  proveedores:
    | { nombre: string; cuit: string | null; telefono: string | null }
    | { nombre: string; cuit: string | null; telefono: string | null }[]
    | null;
};

export async function reporteCompras(rango: RangoReporte) {
  const supabase = await createClient();
  const { desde, hasta } = limites(rango);

  const [compras, productos] = await Promise.all([
    traerTodo<CompraRow>((a, b) => {
      let q = supabase
        .from("compras")
        .select(
          "fecha, total, items, medio_pago, cuotas, monto_cuota, notas, proveedores(nombre, cuit, telefono)",
        );
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      return q.order("fecha", { ascending: false }).range(a, b);
    }, "compras"),
    traerProductos(supabase),
  ]);

  const productoPorId = new Map(productos.map((p) => [p.id, p]));

  const detalle: Record<string, unknown>[] = [];
  const resumen: Record<string, unknown>[] = [];
  const porProveedor = new Map<
    string,
    { proveedor: string; cuit: string; compras: number; mercaderia: number; insumos: number; activos: number; total: number; ultima: string }
  >();

  for (const c of compras) {
    const prov = uno(c.proveedores);
    const proveedor = prov?.nombre ?? "Sin proveedor";
    const montos = { mercaderia: 0, insumo: 0, activo_fijo: 0 };

    for (const it of c.items ?? []) {
      const tipo = (it.tipo ?? "mercaderia") as TipoItemCompra;
      const subtotal = n(it.cantidad) * n(it.costo_unitario);
      montos[tipo] = (montos[tipo] ?? 0) + subtotal;
      const producto = productoPorId.get(it.product_id ?? "");
      detalle.push({
        fecha: fechaAR(c.fecha),
        proveedor,
        cuit: prov?.cuit ?? "",
        tipo: TIPO_ITEM[tipo] ?? tipo,
        item: it.nombre,
        categoria: producto ? labelCategoria(producto.categoria) : "",
        talle: it.talle ?? "",
        color: it.color ?? "",
        cantidad: n(it.cantidad),
        costo_unit: n(it.costo_unitario),
        subtotal,
        medio_pago: c.medio_pago ?? "",
        cuotas: n(c.cuotas) || 1,
        notas: c.notas ?? "",
      });
    }

    resumen.push({
      fecha: fechaAR(c.fecha),
      proveedor,
      cuit: prov?.cuit ?? "",
      telefono: prov?.telefono ?? "",
      items: (c.items ?? [])
        .map((it) =>
          [`${n(it.cantidad)}× ${it.nombre}`, [it.talle, it.color].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(" · "),
        )
        .join(" | "),
      mercaderia: montos.mercaderia,
      insumos: montos.insumo,
      activos: montos.activo_fijo,
      total: n(c.total),
      medio_pago: c.medio_pago ?? "",
      cuotas: n(c.cuotas) || 1,
      monto_cuota: n(c.monto_cuota),
      notas: c.notas ?? "",
    });

    const acc = porProveedor.get(proveedor) ?? {
      proveedor,
      cuit: prov?.cuit ?? "",
      compras: 0,
      mercaderia: 0,
      insumos: 0,
      activos: 0,
      total: 0,
      ultima: c.fecha,
    };
    acc.compras += 1;
    acc.mercaderia += montos.mercaderia;
    acc.insumos += montos.insumo;
    acc.activos += montos.activo_fijo;
    acc.total += n(c.total);
    if (Date.parse(c.fecha) > Date.parse(acc.ultima)) acc.ultima = c.fecha;
    porProveedor.set(proveedor, acc);
  }

  const libro = nuevoLibro();
  agregarPortada(libro, "Reporte de compras", rango, [
    "Detalle: una fila por cada ítem comprado, con su tipo (mercadería para vender, insumo o maquinaria).",
    "Compras: una fila por compra, con el total separado por tipo y la forma de pago.",
    "Por proveedor: cuánto le compraste a cada uno en el período.",
    "Solo la mercadería suma stock. Los insumos son gasto del mes; la maquinaria es una inversión.",
  ]);

  agregarHoja(
    libro,
    "Detalle",
    [
      { titulo: "Fecha", clave: "fecha", tipo: "fecha" },
      { titulo: "Proveedor", clave: "proveedor", ancho: 24 },
      { titulo: "CUIT", clave: "cuit", ancho: 14 },
      { titulo: "Tipo", clave: "tipo", ancho: 16 },
      { titulo: "Ítem", clave: "item", ancho: 30 },
      { titulo: "Categoría", clave: "categoria", ancho: 14 },
      { titulo: "Talle", clave: "talle", ancho: 8 },
      { titulo: "Color", clave: "color", ancho: 12 },
      { titulo: "Cantidad", clave: "cantidad", tipo: "numero", ancho: 10, total: true },
      { titulo: "Costo unitario", clave: "costo_unit", tipo: "pesos" },
      { titulo: "Subtotal", clave: "subtotal", tipo: "pesos", total: true },
      { titulo: "Medio de pago", clave: "medio_pago", ancho: 15 },
      { titulo: "Cuotas", clave: "cuotas", tipo: "numero", ancho: 8 },
      { titulo: "Notas", clave: "notas", ancho: 30 },
    ],
    detalle,
  );

  agregarHoja(
    libro,
    "Compras",
    [
      { titulo: "Fecha", clave: "fecha", tipo: "fecha" },
      { titulo: "Proveedor", clave: "proveedor", ancho: 24 },
      { titulo: "CUIT", clave: "cuit", ancho: 14 },
      { titulo: "Teléfono", clave: "telefono", ancho: 15 },
      { titulo: "Ítems", clave: "items", ancho: 45 },
      { titulo: "Mercadería", clave: "mercaderia", tipo: "pesos", total: true },
      { titulo: "Insumos", clave: "insumos", tipo: "pesos", total: true },
      { titulo: "Maquinaria", clave: "activos", tipo: "pesos", total: true },
      { titulo: "Total", clave: "total", tipo: "pesos", total: true },
      { titulo: "Medio de pago", clave: "medio_pago", ancho: 15 },
      { titulo: "Cuotas", clave: "cuotas", tipo: "numero", ancho: 8 },
      { titulo: "Monto por cuota", clave: "monto_cuota", tipo: "pesos" },
      { titulo: "Notas", clave: "notas", ancho: 30 },
    ],
    resumen,
  );

  agregarHoja(
    libro,
    "Por proveedor",
    [
      { titulo: "Proveedor", clave: "proveedor", ancho: 26 },
      { titulo: "CUIT", clave: "cuit", ancho: 14 },
      { titulo: "Compras", clave: "compras", tipo: "numero", ancho: 9, total: true },
      { titulo: "Mercadería", clave: "mercaderia", tipo: "pesos", total: true },
      { titulo: "Insumos", clave: "insumos", tipo: "pesos", total: true },
      { titulo: "Maquinaria", clave: "activos", tipo: "pesos", total: true },
      { titulo: "Total", clave: "total", tipo: "pesos", total: true },
      { titulo: "Última compra", clave: "ultima", tipo: "fecha" },
    ],
    [...porProveedor.values()]
      .sort((a, b) => b.total - a.total)
      .map((p) => ({ ...p, ultima: fechaAR(p.ultima) })),
  );

  return libro;
}

/* --------------------------------- Stock -------------------------------- */

/** Mismo umbral que "Productos con poco stock" del tablero. */
const STOCK_BAJO = 3;

function estadoStock(stock: number) {
  if (stock <= 0) return "Sin stock";
  if (stock <= STOCK_BAJO) return "Stock bajo";
  return "Disponible";
}

export async function reporteStock() {
  const supabase = await createClient();

  const [productos, variantes] = await Promise.all([
    traerProductos(supabase),
    traerTodo<{ product_id: string; talle: string; color: string; stock: number }>(
      (a, b) =>
        supabase
          .from("product_variantes")
          .select("product_id, talle, color, stock")
          .range(a, b),
      "product_variantes",
    ),
  ]);

  const variantesPorProducto = new Map<string, typeof variantes>();
  for (const v of variantes) {
    const lista = variantesPorProducto.get(v.product_id) ?? [];
    lista.push(v);
    variantesPorProducto.set(v.product_id, lista);
  }

  const detalle: Record<string, unknown>[] = [];
  const resumen: Record<string, unknown>[] = [];

  for (const p of productos) {
    // Un producto sin variantes cargadas se muestra con su stock total.
    const lista = variantesPorProducto.get(p.id) ?? [
      { product_id: p.id, talle: "", color: "", stock: n(p.stock) },
    ];
    const base = {
      producto: p.nombre,
      categoria: labelCategoria(p.categoria),
      familia: p.familia ? labelFamilia(p.familia) : "",
      molde: p.molde ? labelMolde(p.molde) : "",
      activo: p.activo ? "Sí" : "No",
      costo: n(p.costo),
      precio: n(p.precio),
    };

    let unidades = 0;
    let sinStock = 0;
    for (const v of [...lista].sort(
      (a, b) => a.color.localeCompare(b.color) || a.talle.localeCompare(b.talle),
    )) {
      const stock = n(v.stock);
      unidades += stock;
      if (stock <= 0) sinStock += 1;
      detalle.push({
        ...base,
        color: v.color,
        talle: v.talle,
        stock,
        estado: estadoStock(stock),
        valor_costo: stock * base.costo,
        valor_venta: stock * base.precio,
      });
    }

    resumen.push({
      ...base,
      variantes: lista.length,
      sin_stock: sinStock,
      stock: unidades,
      estado: estadoStock(unidades),
      valor_costo: unidades * base.costo,
      valor_venta: unidades * base.precio,
    });
  }

  const libro = nuevoLibro();
  agregarPortada(libro, "Disponibilidad de stock", null, [
    "Foto del stock al momento de descargar el archivo (no depende del período elegido).",
    "Por variante: una fila por cada combinación de talle y color, con las unidades disponibles.",
    "Por producto: el total de cada producto y cuántas de sus variantes están agotadas.",
    `Estado: "Sin stock" con 0 unidades, "Stock bajo" con ${STOCK_BAJO} o menos, "Disponible" con más.`,
    "El valor a costo es el capital inmovilizado en mercadería; el valor a venta es lo que se facturaría vendiéndolo todo a precio de lista.",
  ]);

  const columnasComunes: Columna[] = [
    { titulo: "Producto", clave: "producto", ancho: 30 },
    { titulo: "Categoría", clave: "categoria", ancho: 14 },
    { titulo: "Familia", clave: "familia", ancho: 12 },
    { titulo: "Molde", clave: "molde", ancho: 14 },
  ];
  const columnasValor: Columna[] = [
    { titulo: "Estado", clave: "estado", ancho: 12 },
    { titulo: "Costo unitario", clave: "costo", tipo: "pesos" },
    { titulo: "Precio de venta", clave: "precio", tipo: "pesos" },
    { titulo: "Valor a costo", clave: "valor_costo", tipo: "pesos", total: true },
    { titulo: "Valor a venta", clave: "valor_venta", tipo: "pesos", total: true },
    { titulo: "Activo en tienda", clave: "activo", ancho: 10 },
  ];

  const hojaDetalle = agregarHoja(
    libro,
    "Por variante",
    [
      ...columnasComunes,
      { titulo: "Color", clave: "color", ancho: 12 },
      { titulo: "Talle", clave: "talle", ancho: 8 },
      { titulo: "Stock", clave: "stock", tipo: "numero", ancho: 9, total: true },
      ...columnasValor,
    ],
    detalle,
  );
  pintarEstados(hojaDetalle, detalle.length);

  const hojaResumen = agregarHoja(
    libro,
    "Por producto",
    [
      ...columnasComunes,
      { titulo: "Variantes", clave: "variantes", tipo: "numero", ancho: 10 },
      { titulo: "Variantes agotadas", clave: "sin_stock", tipo: "numero", ancho: 11 },
      { titulo: "Stock total", clave: "stock", tipo: "numero", ancho: 10, total: true },
      ...columnasValor,
    ],
    resumen,
  );
  pintarEstados(hojaResumen, resumen.length);

  return libro;
}

/** Colorea la celda de estado: rojo sin stock, ámbar stock bajo. */
function pintarEstados(hoja: ExcelJS.Worksheet, filas: number) {
  const col = hoja.getColumn("estado");
  for (let r = 2; r <= filas + 1; r++) {
    const celda = hoja.getRow(r).getCell(col.number);
    const color =
      celda.value === "Sin stock"
        ? "FFFEE2E2"
        : celda.value === "Stock bajo"
          ? "FFFEF3C7"
          : null;
    if (color) {
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    }
  }
}
