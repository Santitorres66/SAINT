import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

/**
 * Layout raíz: solo define el <html>, el <body> y carga las fuentes.
 * La navegación pública (Navbar/Footer) vive en el grupo de rutas (public),
 * así el panel /admin puede tener su propia interfaz limpia y separada.
 */

// Tipografía primaria — serif elegante para el logo y los títulos.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Tipografía secundaria — sans neutra para textos y navegación.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://saint.example"),
  title: {
    default: "SAINT — lo sagrado en lo cotidiano",
    template: "%s · SAINT",
  },
  description:
    "SAINT — básicos de calidad que se vuelven únicos a través del bordado personalizado. Lo sagrado en lo cotidiano.",
  keywords: [
    "SAINT",
    "indumentaria",
    "bordado personalizado",
    "buzos",
    "remeras oversized",
    "canguros",
    "gorras",
    "Argentina",
  ],
  openGraph: {
    title: "SAINT — lo sagrado en lo cotidiano",
    description:
      "Básicos de calidad, únicos e irrepetibles a través del bordado personalizado.",
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
