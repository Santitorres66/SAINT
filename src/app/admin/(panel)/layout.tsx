import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";

/**
 * Layout del panel PROTEGIDO. Verifica la sesión (además del middleware) y
 * dibuja el encabezado con la navegación del sistema de gestión.
 */

const SECCIONES = [
  { href: "/admin", label: "Tablero" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/ventas", label: "Ventas" },
  { href: "/admin/compras", label: "Compras" },
  { href: "/admin/proveedores", label: "Proveedores" },
];

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6">
          {/* Fila 1: marca + cuenta */}
          <div className="flex items-center justify-between gap-4 py-4">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="font-serif text-2xl font-light tracking-[0.3em]">
                SAINT
              </span>
              <span className="hidden text-sm text-neutral-400 sm:inline">
                · Gestión
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                target="_blank"
                className="hidden text-sm text-neutral-500 transition hover:text-neutral-900 sm:inline"
              >
                Ver la web ↗
              </Link>
              <span className="hidden text-sm text-neutral-400 md:inline">
                {user.email}
              </span>
              <LogoutButton />
            </div>
          </div>

          {/* Fila 2: navegación de secciones */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-neutral-100 py-3 text-sm font-medium">
            {SECCIONES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-neutral-600 transition hover:text-neutral-900"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </>
  );
}
