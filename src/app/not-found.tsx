import Link from "next/link";
import Logo from "@/components/Logo";

/** Página 404 sobria y acorde a la marca. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo size="lg" />
      <p className="mt-8 font-serif text-2xl">Esta página no existe.</p>
      <p className="mt-2 text-sm text-saint-gray">
        Puede que la pieza que buscabas ya no esté disponible.
      </p>
      <Link href="/" className="btn-line mt-10">
        Volver al inicio
      </Link>
    </div>
  );
}
