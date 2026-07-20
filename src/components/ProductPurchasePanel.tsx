"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrecio, whatsappLink } from "@/lib/constants";
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

  // Mensaje de WhatsApp para pedir un bordado personalizado, con lo que eligió.
  const detalleSeleccion = [
    talle && `talle ${talle}`,
    color && `color ${color}`,
  ]
    .filter(Boolean)
    .join(", ");
  const mensajeBordado = `¡Hola SAINT! 🖤 Me interesa "${product.nombre}"${
    detalleSeleccion ? ` (${detalleSeleccion})` : ""
  } y quiero un BORDADO PERSONALIZADO (no de los que están en la web). Te voy a enviar una imagen del diseño que quiero, para coordinar el bordado y el envío. ¡Gracias!`;
  const bordadoHref = whatsappLink(mensajeBordado);

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

      {/* Bloque de bordado personalizado */}
      <div className="border border-saint-line p-6">
        <p className="mb-2 text-[11px] uppercase tracking-wide2 text-saint-gray">
          Bordado personalizado
        </p>
        <p className="text-sm leading-relaxed text-saint-gray">
          ¿Querés un bordado que no está en la web —tu personaje favorito, tu
          mascota, un símbolo propio? Escribinos por WhatsApp y{" "}
          <span className="text-saint-white">
            enviános la imagen del diseño que querés
          </span>
          . Coordinamos con vos el bordado y el envío. Cada pieza, única e
          irrepetible.
        </p>

        <a
          href={bordadoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-[#25D366] bg-[#25D366]/10 px-6 py-3 text-xs uppercase tracking-wide2 text-saint-white transition-colors duration-300 hover:bg-[#25D366] hover:text-saint-black"
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
            <path d="M16 3.2A12.8 12.8 0 0 0 4.93 22.4L3.2 28.8l6.57-1.72A12.8 12.8 0 1 0 16 3.2Zm5.85 15.39c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.66 0 1.57 1.14 3.08 1.3 3.29.16.21 2.25 3.43 5.44 4.81 3.19 1.38 3.19.92 3.76.86.57-.05 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
          </svg>
          Pedir bordado personalizado
        </a>
      </div>
    </div>
  );
}
