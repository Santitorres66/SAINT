import Link from "next/link";
import Logo from "./Logo";
import CartButton from "./cart/CartButton";

/**
 * Barra de navegación de la web pública. Sobria, translúcida y fija arriba.
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-saint-line/60 bg-saint-black/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo size="sm" asLink />

        <ul className="flex items-center gap-8 text-xs uppercase tracking-wide2 text-saint-gray">
          <li>
            <Link
              href="/"
              className="transition-colors duration-300 hover:text-saint-white"
            >
              Inicio
            </Link>
          </li>
          <li>
            <Link
              href="/tienda"
              className="transition-colors duration-300 hover:text-saint-white"
            >
              Tienda
            </Link>
          </li>
          <li>
            <CartButton />
          </li>
        </ul>
      </nav>
    </header>
  );
}
