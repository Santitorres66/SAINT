import Link from "next/link";
import VentaManualForm from "@/components/admin/VentaManualForm";
import type { OrdenPrecargada } from "@/components/admin/VentaManualForm";
import { getAllProductsAdmin } from "@/lib/products";
import { getClientes } from "@/lib/clientes";
import { getOrdenProduccionById } from "@/lib/produccion";
import { formatNumeroOrden } from "@/lib/constants";

/**
 * Página para registrar una venta manual.
 *
 * Con `?orden=<id>` la venta cierra esa orden de producción: el formulario
 * arranca precargado con la prenda y el cliente del pedido.
 */
export default async function NuevaVentaPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string }>;
}) {
  const { orden: ordenId } = await searchParams;

  const [products, clientes, ordenRow] = await Promise.all([
    getAllProductsAdmin(),
    getClientes(),
    ordenId ? getOrdenProduccionById(ordenId) : Promise.resolve(null),
  ]);

  // Si la orden ya se vendió, no dejamos cargar una segunda venta.
  const yaVendida = Boolean(ordenRow?.venta_id);

  const orden: OrdenPrecargada | undefined =
    ordenRow && !yaVendida
      ? {
          id: ordenRow.id,
          numero: ordenRow.numero,
          cliente: ordenRow.cliente,
          cliente_id: ordenRow.cliente_id,
          product_id: ordenRow.product_id,
          nombre: ordenRow.product_nombre || ordenRow.prenda || "",
          talle: ordenRow.talle,
          color: ordenRow.color,
          cantidad: ordenRow.cantidad,
          costo_total: Number(ordenRow.costo_total) || 0,
        }
      : undefined;

  return (
    <div>
      <Link
        href={ordenId ? "/admin/produccion" : "/admin/ventas"}
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a {ordenId ? "producción" : "ventas"}
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        {orden
          ? `Vender la orden ${formatNumeroOrden(orden.numero)}`
          : "Nueva venta manual"}
      </h1>

      {ordenId && !ordenRow ? (
        <Aviso texto="No se encontró esa orden de producción." />
      ) : yaVendida ? (
        <Aviso
          texto="Esa orden ya tiene una venta cargada. Buscala en la lista de ventas para registrar o ver sus cobros."
          href="/admin/ventas"
          hrefTexto="Ir a ventas"
        />
      ) : products.length === 0 && !orden ? (
        <Aviso
          texto="Primero necesitás tener productos cargados."
          href="/admin/nuevo"
          hrefTexto="Crear un producto"
        />
      ) : (
        <VentaManualForm
          products={products}
          clientes={clientes}
          orden={orden}
        />
      )}
    </div>
  );
}

function Aviso({
  texto,
  href,
  hrefTexto,
}: {
  texto: string;
  href?: string;
  hrefTexto?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
      <p className="text-neutral-700">{texto}</p>
      {href && hrefTexto && (
        <Link
          href={href}
          className="mt-3 inline-block font-medium text-neutral-900 underline"
        >
          {hrefTexto}
        </Link>
      )}
    </div>
  );
}
