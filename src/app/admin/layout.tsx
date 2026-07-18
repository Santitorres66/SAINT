import type { Metadata } from "next";

/**
 * Layout base de TODO /admin. Cambia la estética a un tema claro y legible
 * (pensado para uso cómodo, no editorial). No verifica sesión: de eso se
 * encargan el middleware y el layout del panel protegido.
 */
export const metadata: Metadata = {
  title: "Panel de administración",
  robots: { index: false, follow: false }, // el admin no se indexa
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900">
      {children}
    </div>
  );
}
