"use client";

import { useState } from "react";
import Gallery from "@/components/Gallery";
import BordadoStudio from "@/components/BordadoStudio";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import type { Product, ProductVariante } from "@/lib/types";
import type { BordadoSpec } from "@/lib/bordado";

/**
 * El detalle de producto completo: a la izquierda la prenda (las fotos o el
 * previsualizador de bordado), a la derecha la compra.
 *
 * Existe como componente cliente porque las dos columnas comparten una cosa: el
 * bordado que se armó. Se elige de un lado y se compra del otro, así que el
 * estado tiene que vivir arriba de las dos.
 */
export default function ProductoDetalle({
  product,
  variantes,
  talleInicial,
  colorInicial,
}: {
  product: Product;
  variantes: ProductVariante[];
  talleInicial: string | null;
  colorInicial: string | null;
}) {
  const [vista, setVista] = useState<"fotos" | "bordado">("fotos");
  const [bordado, setBordado] = useState<BordadoSpec | null>(null);

  const tab = (activo: boolean) =>
    `flex-1 px-4 py-2.5 text-[11px] uppercase tracking-wide2 transition-colors duration-300 ${
      activo
        ? "bg-saint-white text-saint-black"
        : "text-saint-gray hover:text-saint-white"
    }`;

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <div className="space-y-5">
        {/* Las fotos primero: el previsualizador es una invitación, no un
            peaje. Quien solo quiere ver la prenda la ve al entrar. */}
        <div className="flex border border-saint-line">
          <button
            type="button"
            onClick={() => setVista("fotos")}
            aria-pressed={vista === "fotos"}
            className={tab(vista === "fotos")}
          >
            Fotos
          </button>
          <button
            type="button"
            onClick={() => setVista("bordado")}
            aria-pressed={vista === "bordado"}
            className={tab(vista === "bordado")}
          >
            Probá tu bordado
          </button>
        </div>

        {vista === "fotos" ? (
          <Gallery imagenes={product.imagenes} nombre={product.nombre} />
        ) : (
          <BordadoStudio
            imagen={product.imagenes?.[0]}
            nombreProducto={product.nombre}
            aplicado={bordado}
            onAplicar={setBordado}
          />
        )}
      </div>

      <ProductPurchasePanel
        product={product}
        variantes={variantes}
        talleInicial={talleInicial}
        colorInicial={colorInicial}
        bordado={bordado}
        onQuitarBordado={() => setBordado(null)}
        onProbarBordado={() => setVista("bordado")}
      />
    </div>
  );
}
