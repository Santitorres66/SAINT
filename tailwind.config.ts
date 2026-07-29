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
        // Tema CLARO: fondo claro con letras oscuras.
        // (Los nombres black/white se mantienen por compatibilidad de clases,
        //  pero ahora "black" = fondo claro y "white" = texto oscuro.)
        saint: {
          black: "#f7f6f4", // fondo principal (claro)
          ink: "#eeece7", // superficies apenas elevadas
          white: "#141414", // texto principal (oscuro)
          gray: "#6b6b6b", // texto secundario
          line: "#e2ded7", // líneas finas / bordes
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
