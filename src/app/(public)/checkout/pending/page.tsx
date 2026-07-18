import type { Metadata } from "next";
import Link from "next/link";
import { WHATSAPP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Tu pago está en revisión",
  robots: { index: false },
};

/** Página para pagos que quedan pendientes de acreditación. */
export default function CheckoutPendingPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-saint-line text-2xl text-saint-gray">
        …
      </span>

      <h1 className="font-serif text-4xl font-light">Tu pago está en revisión</h1>
      <p className="mt-4 leading-relaxed text-saint-gray">
        Mercado Pago está procesando tu pago. Apenas se acredite, nos
        comunicamos con vos para coordinar tu prenda. Puede demorar unos minutos.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-line">
          Consultar por WhatsApp
        </a>
        <Link
          href="/tienda"
          className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-saint-white"
        >
          Volver a la tienda →
        </Link>
      </div>
    </div>
  );
}
