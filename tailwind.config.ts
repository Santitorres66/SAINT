import type { Config } from "tailwindcss";

/**
 * Identidad visual de SAINT.
 * Paleta sobria: negro casi puro, blancos rotos y grises neutros.
 * Tipografías: serif espaciada (Cormorant Garamond) + sans neutra (Inter),
 * ambas inyectadas como variables CSS desde el layout con next/font.
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        saint: {
          black: "#0d0d0d", // fondo principal
          ink: "#111111", // superficies apenas elevadas
          white: "#f5f4f2", // blanco roto para texto
          gray: "#9a9a9a", // texto secundario
          line: "#262626", // líneas finas / bordes
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        brand: "0.5em", // logo "S A I N T"
        wide2: "0.25em", // títulos y navegación
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
