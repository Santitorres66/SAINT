import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { aPedidoPublico, leerPedido } from "@/lib/pago-transferencia";
import PagoTransferencia from "@/components/PagoTransferencia";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pedido",
  // El link lleva la clave del pedido: que no lo indexe nadie.
  robots: { index: false, follow: false },
};

/**
 * La página del pedido: el monto exacto, el alias/CVU y el estado del pago,
 * que se actualiza solo cuando entra la transferencia.
 *
 * Se entra con la clave secreta del pedido (?k=). Sin ella, el pedido "no
 * existe": el id solo no alcanza para ver datos de otra persona.
 */
export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  const fila = await leerPedido(createAdminClient(), id, k ?? "");

  if (!fila) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-4xl font-light">No encontramos el pedido</h1>
        <p className="mt-4 leading-relaxed text-saint-gray">
          Revisá que el link esté completo. Si el problema sigue, escribinos y
          lo buscamos por tu nombre.
        </p>
        <Link href="/tienda" className="btn-line mt-10">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  return <PagoTransferencia pedido={aPedidoPublico(fila)} clave={k ?? ""} />;
}
