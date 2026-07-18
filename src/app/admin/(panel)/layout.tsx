import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";

/**
 * Layout del panel PROTEGIDO. Verifica la sesión (además del middleware) y
 * dibuja el encabezado con navegación y cierre de sesión.
 */
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
      {/* Encabezado */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="font-serif text-2xl font-light tracking-[0.3em]">
              SAINT
            </span>
            <span className="hidden text-sm text-neutral-400 sm:inline">
              · Panel
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm font-medium text-neutral-700 transition hover:text-neutral-900"
            >
              Productos
            </Link>
            <Link
              href="/admin/ordenes"
              className="text-sm font-medium text-neutral-700 transition hover:text-neutral-900"
            >
              Órdenes
            </Link>
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
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </>
  );
}
