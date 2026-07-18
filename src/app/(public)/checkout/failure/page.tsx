import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "El pago no se completó",
  robots: { index: false },
};

/** Página a la que vuelve el cliente cuando el pago fue rechazado o cancelado. */
export default function CheckoutFailurePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-saint-line text-2xl text-saint-gray">
        ✕
      </span>

      <h1 className="font-serif text-4xl font-light">El pago no se completó</h1>
      <p className="mt-4 leading-relaxed text-saint-gray">
        No se pudo procesar el pago o lo cancelaste. No te preocupes: no se
        realizó ningún cobro. Podés volver a intentarlo cuando quieras.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href="/tienda" className="btn-line">
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
