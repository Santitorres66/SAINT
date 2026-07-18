"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CATEGORIAS } from "@/lib/constants";

/**
 * Filtro de categorías del catálogo. Actualiza el query param ?categoria=
 * sin recargar toda la página. "Todo" limpia el filtro.
 */
export default function CategoryFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activa = searchParams.get("categoria");

  function seleccionar(categoria: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (categoria) params.set("categoria", categoria);
    else params.delete("categoria");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const base =
    "px-4 py-2 text-xs uppercase tracking-wide2 transition-colors duration-300";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={() => seleccionar(null)}
        className={`${base} ${
          !activa ? "text-saint-white" : "text-saint-gray hover:text-saint-white"
        }`}
      >
        Todo
      </button>
      {CATEGORIAS.map((c) => (
        <button
          key={c.value}
          onClick={() => seleccionar(c.value)}
          className={`${base} ${
            activa === c.value
              ? "text-saint-white"
              : "text-saint-gray hover:text-saint-white"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
