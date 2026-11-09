import { createClient } from "@/lib/supabase/server";
import type { CajaControl, CuentaCaja, Socio } from "./types";
import { cuentaDeMedio, diaDe, hoyAR, labelConcepto } from "./caja";

/**
 * Caja: la plata que entró menos la que salió, en Brubank y en efectivo.
 *
 *  entra  → cobros de ventas manuales + ventas web pagadas
 *  sale   → pagos de compras que hizo SAINT (lo que puso un socio no sale
 *           de la caja: es un aporte suyo)
 *  ±      → movimientos manuales (aportes y devoluciones a socios, gastos,
 *           depósitos de efectivo, ajustes contra Brubank)
 *
 * Todo se calcula desde los registros, no hay un saldo guardado que se pueda
 * desincronizar. Para que coincida con el banco se carga un ajuste.
 */

export type OrigenMovimiento = "cobro" | "pago_compra" | "manual";

export interface MovimientoCaja {
  id: string;
  dia: string;
  fecha: string;
  cuenta: CuentaCaja;
  /** Con signo: > 0 entra, < 0 sale. */
  monto: number;
  origen: OrigenMovimiento;
  concepto: string;
  detalle: string;
  /** Solo los manuales se pueden borrar desde la Caja. */
  manualId: string | null;
}

export interface DiaCaja {
  dia: string;
  cobrado: number;
  pagado: number;
  /** Movimientos manuales del día (con signo). */
  otros: number;
  neto: number;
  /** Saldo total al cierre del día. */
  saldo: number;
}

export interface SocioResumen extends Socio {
  enCompras: number;
  aportes: number;
  devuelto: number;
  retirado: number;
  /** Lo que puso menos lo que se le devolvió. */
  aFavor: number;
}

export interface CompraPorPagar {
  id: string;
  fecha: string;
  proveedor: string;
  descripcion: string;
  total: number;
  saldo: number;
  cuotas: number;
  montoCuota: number;
  cuotasPagadas: number;
}

export interface Caja {
  /** false si falta correr caja-socios.sql. */
  lista: boolean;
  saldo: { total: number; brubank: number; efectivo: number };
  movimientos: MovimientoCaja[];
  dias: DiaCaja[];
  socios: SocioResumen[];
  porPagar: CompraPorPagar[];
  controles: CajaControl[];
}

type Uno<T> = T | T[] | null;
const uno = <T,>(x: Uno<T>): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);

export async function getCaja(): Promise<Caja> {
  const supabase = await createClient();

  const [cobros, orders, pagos, manuales, controles, socios, compras] =
    await Promise.all([
      supabase
        .from("cobros")
        .select("id, fecha, monto, medio_pago, ventas(cliente)"),
      supabase
        .from("orders")
        .select("id, created_at, pagado_at, total, comprador, metodo_pago")
        .eq("status", "approved"),
      supabase
        .from("compra_pagos")
        .select(
          "id, fecha, monto, socio_id, medio_pago, compras(items, proveedores(nombre))",
        ),
      supabase
        .from("caja_movimientos")
        .select("id, fecha, cuenta, concepto, monto, socio_id, notas"),
      supabase
        .from("caja_controles")
        .select("id, fecha, saldo_real, saldo_sistema, notas")
        .order("fecha", { ascending: false })
        .limit(10),
      supabase
        .from("socios")
        .select("id, nombre, dni, activo")
        .order("nombre"),
      supabase
        .from("compras")
        .select(
          "id, fecha, total, cuotas, monto_cuota, items, proveedores(nombre), compra_pagos(monto)",
        ),
    ]);

  const lista = !pagos.error && !manuales.error && !socios.error;
  const movimientos: MovimientoCaja[] = [];

  // Entradas: cobros manuales
  type FilaCobro = {
    id: string;
    fecha: string;
    monto: number;
    medio_pago: string | null;
    ventas: Uno<{ cliente: string | null }>;
  };
  for (const c of (cobros.data as FilaCobro[] | null) ?? []) {
    movimientos.push({
      id: `cobro-${c.id}`,
      dia: diaDe(c.fecha),
      fecha: c.fecha,
      cuenta: cuentaDeMedio(c.medio_pago),
      monto: Number(c.monto) || 0,
      origen: "cobro",
      concepto: "Cobro",
      detalle: uno(c.ventas)?.cliente || "Venta manual",
      manualId: null,
    });
  }

  // Entradas: ventas web pagadas (transferencia al alias → Brubank)
  type FilaOrder = {
    id: string;
    created_at: string;
    pagado_at: string | null;
    total: number;
    comprador: { nombre?: string; email?: string } | null;
  };
  for (const o of (orders.data as FilaOrder[] | null) ?? []) {
    const fecha = o.pagado_at ?? o.created_at;
    movimientos.push({
      id: `web-${o.id}`,
      dia: diaDe(fecha),
      fecha,
      cuenta: "brubank",
      monto: Number(o.total) || 0,
      origen: "cobro",
      concepto: "Venta web",
      detalle: o.comprador?.nombre || o.comprador?.email || "Cliente web",
      manualId: null,
    });
  }

  // Salidas: pagos de compras hechos por SAINT. Los de socios se juntan aparte.
  type FilaPago = {
    id: string;
    fecha: string;
    monto: number;
    socio_id: string | null;
    medio_pago: string | null;
    compras: Uno<{
      items: { nombre: string }[] | null;
      proveedores: Uno<{ nombre: string }>;
    }>;
  };
  const enComprasPorSocio = new Map<string, number>();
  for (const p of (pagos.data as FilaPago[] | null) ?? []) {
    const monto = Number(p.monto) || 0;
    if (p.socio_id) {
      enComprasPorSocio.set(
        p.socio_id,
        (enComprasPorSocio.get(p.socio_id) ?? 0) + monto,
      );
      continue;
    }
    const compra = uno(p.compras);
    const proveedor = uno(compra?.proveedores ?? null)?.nombre;
    const item = compra?.items?.[0]?.nombre;
    movimientos.push({
      id: `pago-${p.id}`,
      dia: diaDe(p.fecha),
      fecha: p.fecha,
      cuenta: cuentaDeMedio(p.medio_pago),
      monto: -monto,
      origen: "pago_compra",
      concepto: "Pago de compra",
      detalle: [proveedor, item].filter(Boolean).join(" · ") || "Compra",
      manualId: null,
    });
  }

  // Manuales
  type FilaMov = {
    id: string;
    fecha: string;
    cuenta: CuentaCaja;
    concepto: string;
    monto: number;
    socio_id: string | null;
    notas: string | null;
  };
  const filasSocios = (socios.data as Socio[] | null) ?? [];
  const nombreSocio = new Map(filasSocios.map((s) => [s.id, s.nombre]));
  const porSocio = new Map<
    string,
    { aportes: number; devuelto: number; retirado: number }
  >();
  for (const m of (manuales.data as FilaMov[] | null) ?? []) {
    const monto = Number(m.monto) || 0;
    if (m.socio_id) {
      const s = porSocio.get(m.socio_id) ?? {
        aportes: 0,
        devuelto: 0,
        retirado: 0,
      };
      if (m.concepto === "aporte_socio") s.aportes += monto;
      if (m.concepto === "devolucion_socio") s.devuelto += -monto;
      if (m.concepto === "retiro_socio") s.retirado += -monto;
      porSocio.set(m.socio_id, s);
    }
    movimientos.push({
      id: `mov-${m.id}`,
      dia: diaDe(m.fecha),
      fecha: m.fecha,
      cuenta: m.cuenta,
      monto,
      origen: "manual",
      concepto: labelConcepto(m.concepto),
      detalle: [m.socio_id ? nombreSocio.get(m.socio_id) : null, m.notas]
        .filter(Boolean)
        .join(" · "),
      manualId: m.id,
    });
  }

  movimientos.sort(
    (a, b) => b.dia.localeCompare(a.dia) || b.fecha.localeCompare(a.fecha),
  );

  const saldo = { total: 0, brubank: 0, efectivo: 0 };
  for (const m of movimientos) {
    saldo.total += m.monto;
    saldo[m.cuenta] += m.monto;
  }

  return {
    lista,
    saldo,
    movimientos,
    dias: armarDias(movimientos),
    socios: filasSocios.map((s) => {
      const m = porSocio.get(s.id) ?? { aportes: 0, devuelto: 0, retirado: 0 };
      const enCompras = enComprasPorSocio.get(s.id) ?? 0;
      return {
        ...s,
        enCompras,
        ...m,
        aFavor: enCompras + m.aportes - m.devuelto,
      };
    }),
    porPagar: lista ? armarPorPagar(compras.data) : [],
    controles: ((controles.data as CajaControl[] | null) ?? []).map((c) => ({
      ...c,
      saldo_real: Number(c.saldo_real),
      saldo_sistema: Number(c.saldo_sistema),
    })),
  };
}

/** Un día por fila, del primer movimiento a hoy, sin huecos. */
function armarDias(movimientos: MovimientoCaja[]): DiaCaja[] {
  if (!movimientos.length) return [];
  const porDia = new Map<string, DiaCaja>();
  for (const m of movimientos) {
    const d = porDia.get(m.dia) ?? {
      dia: m.dia,
      cobrado: 0,
      pagado: 0,
      otros: 0,
      neto: 0,
      saldo: 0,
    };
    if (m.origen === "cobro") d.cobrado += m.monto;
    else if (m.origen === "pago_compra") d.pagado += -m.monto;
    else d.otros += m.monto;
    d.neto += m.monto;
    porDia.set(m.dia, d);
  }

  const primero = [...porDia.keys()].sort()[0];
  const hoy = hoyAR();
  const ultimo = [...porDia.keys(), hoy].sort().at(-1)!;
  const dias: DiaCaja[] = [];
  let acumulado = 0;
  for (
    let t = Date.parse(`${primero}T00:00:00Z`);
    t <= Date.parse(`${ultimo}T00:00:00Z`);
    t += 86_400_000
  ) {
    const dia = new Date(t).toISOString().slice(0, 10);
    const d = porDia.get(dia) ?? {
      dia,
      cobrado: 0,
      pagado: 0,
      otros: 0,
      neto: 0,
      saldo: 0,
    };
    acumulado += d.neto;
    dias.push({ ...d, saldo: acumulado });
  }
  return dias;
}

function armarPorPagar(data: unknown): CompraPorPagar[] {
  type Fila = {
    id: string;
    fecha: string;
    total: number;
    cuotas: number;
    monto_cuota: number;
    items: { nombre: string }[] | null;
    proveedores: Uno<{ nombre: string }>;
    compra_pagos: { monto: number }[] | null;
  };
  return ((data as Fila[] | null) ?? [])
    .map((c) => {
      const pagado = (c.compra_pagos ?? []).reduce(
        (a, p) => a + Number(p.monto),
        0,
      );
      const total = Number(c.total) || 0;
      const montoCuota = Number(c.monto_cuota) || 0;
      return {
        id: c.id,
        fecha: c.fecha,
        proveedor: uno(c.proveedores)?.nombre ?? "Sin proveedor",
        descripcion: c.items?.[0]?.nombre ?? "",
        total,
        saldo: total - pagado,
        cuotas: c.cuotas,
        montoCuota,
        cuotasPagadas:
          c.cuotas > 1 && montoCuota > 0
            ? Math.min(Math.floor(pagado / montoCuota + 0.01), c.cuotas)
            : 0,
      };
    })
    .filter((c) => c.saldo > 0.01)
    .sort((a, b) => b.saldo - a.saldo);
}
