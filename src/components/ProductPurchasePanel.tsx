"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrecio } from "@/lib/constants";
import { useCart } from "@/lib/cart/CartContext";

/**
 * Panel de compra del detalle de producto: selección de talle y color,
 * bloque informativo del bordado y botón "Agregar al carrito".
 * Al agregar, el ítem entra al carrito y se abre el panel lateral.
 * El pago se completa desde el carrito con Mercado Pago.
 */
export default function ProductPurchasePanel({
  product,
}: {
  product: Product;
}) {
  const { addItem } = useCart();
  const [talle, setTalle] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const sinStock = product.stock <= 0;
  const necesitaTalle = product.talles.length > 0;
  const necesitaColor = product.colores.length > 0;

  function agregar() {
    if (necesitaTalle && !talle) {
      setAviso("Elegí un talle para continuar.");
      return;
    }
    if (necesitaColor && !color) {
      setAviso("Elegí un color para continuar.");
      return;
    }
    setAviso(null);
    addItem({
      productId: product.id,
      nombre: product.nombre,
      precio: product.precio,
      imagen: product.imagenes?.[0],
      talle,
      color,
      cantidad: 1,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-wide2 text-saint-gray">
          {product.categoria}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-light">{product.nombre}</h1>
        <p className="mt-3 text-lg text-saint-gray">
          {formatPrecio(product.precio)}
        </p>
      </div>

      {product.descripcion && (
        <p className="text-sm leading-relaxed text-saint-gray">
          {product.descripcion}
        </p>
      )}

      {/* Talles */}
      {necesitaTalle && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide2 text-saint-gray">
            Talle
          </p>
          <div className="flex flex-wrap gap-2">
            {product.talles.map((t) => (
              <button
                key={t}
                onClick={() => setTalle(t)}
                className={`min-w-[3rem] border px-4 py-2 text-sm transition-all duration-300 ${
                  talle === t
                    ? "border-saint-white bg-saint-white text-saint-black"
                    : "border-saint-line text-saint-gray hover:border-saint-white hover:text-saint-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colores */}
      {necesitaColor && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide2 text-saint-gray">
            Color
          </p>
          <div className="flex flex-wrap gap-2">
            {product.colores.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`border px-4 py-2 text-sm transition-all duration-300 ${
                  color === c
                    ? "border-saint-white bg-saint-white text-saint-black"
                    : "border-saint-line text-saint-gray hover:border-saint-white hover:text-saint-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botón */}
      <div className="space-y-3">
        <button
          onClick={agregar}
          disabled={sinStock}
          className="btn-line w-full disabled:cursor-not-allowed disabled:border-saint-line disabled:text-saint-gray disabled:hover:bg-transparent disabled:hover:text-saint-gray"
        >
          {sinStock ? "Sin stock" : "Agregar al carrito"}
        </button>
        {aviso && <p className="text-xs text-red-400">{aviso}</p>}
      </div>

      {/* Bloque informativo del bordado */}
      <div className="border border-saint-line p-6">
        <p className="mb-2 text-[11px] uppercase tracking-wide2 text-saint-gray">
          Personalización por bordado
        </p>
        <p className="text-sm leading-relaxed text-saint-gray">
          Podés sumar tu bordado personalizado a esta prenda —un personaje, tu
          mascota, un símbolo propio— para volverla única e irrepetible. Al
          finalizar tu compra coordinamos el diseño con vos por WhatsApp.
          <span className="mt-2 block text-saint-gray/60">
            (Función informativa por ahora — pronto vas a poder elegir tu bordado
            desde acá.)
          </span>
        </p>
      </div>
    </div>
  );
}
