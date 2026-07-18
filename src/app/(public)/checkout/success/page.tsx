import type { Metadata } from "next";
import Link from "next/link";
import ClearCartOnMount from "@/components/cart/ClearCartOnMount";
import { WHATSAPP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "¡Gracias por tu compra!",
  robots: { index: false },
};

/** Página a la que vuelve el cliente cuando el pago fue aprobado. */
export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      {/* Vaciamos el carrito al llegar acá */}
      <ClearCartOnMount />

      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-saint-line text-2xl">
        ✓
      </span>

      <h1 className="font-serif text-4xl font-light">¡Gracias por tu compra!</h1>
      <p className="mt-4 leading-relaxed text-saint-gray">
        Tu pago fue aprobado. En breve nos comunicamos con vos para coordinar el
        <span className="text-saint-white"> bordado personalizado </span>
        de tu prenda y los detalles del envío.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-line">
          Escribinos por WhatsApp
        </a>
        <Link
          href="/tienda"
          className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-saint-white"
        >
          Seguir viendo la tienda →
        </Link>
      </div>
    </div>
  );
}
