"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product, ProductVariante } from "@/lib/types";
import { colorHex, formatPrecio, whatsappLink } from "@/lib/constants";
import { useCart } from "@/lib/cart/CartContext";
import SizeChart from "@/components/SizeChart";
import ShareButton from "@/components/ShareButton";
import { describirBordado } from "@/lib/bordado";
import type { BordadoSpec } from "@/lib/bordado";
import type { ColorDeFicha } from "@/lib/catalogo";

/**
 * Panel de compra del detalle de producto: selección de talle y color
 * (respetando el stock por variante), el bordado armado en el previsualizador
 * y "Agregar al carrito".
 *
 * `talleInicial` / `colorInicial` vienen del link compartido: quien lo abre ve
 * la misma combinación que estaba mirando la persona que se lo mandó.
 */
export default function ProductPurchasePanel({
  product,
  variantes,
  coloresModelo = [],
  talleInicial = null,
  colorInicial = null,
  bordado = null,
  onQuitarBordado,
  onProbarBordado,
}: {
  product: Product;
  variantes: ProductVariante[];
  /**
   * Todos los colores del modelo. Los de otros productos llevan a su ficha:
   * en la base cada color es un producto, y cada uno tiene su foto y su stock.
   */
  coloresModelo?: ColorDeFicha[];
  talleInicial?: string | null;
  colorInicial?: string | null;
  /** El bordado confirmado en el previsualizador, si el cliente armó uno. */
  bordado?: BordadoSpec | null;
  onQuitarBordado?: () => void;
  /** Lleva a la pestaña del previsualizador. */
  onProbarBordado?: () => void;
}) {
  const router = useRouter();
  const [cambiandoColor, startColor] = useTransition();
  const { addItem, items } = useCart();
  // Preferimos lo que venga del link; si no, y hay una sola opción, esa.
  const [talle, setTalle] = useState<string | null>(
    talleInicial ?? (product.talles.length === 1 ? product.talles[0] : null),
  );
  const [color, setColor] = useState<string | null>(
    colorInicial ?? (product.colores.length === 1 ? product.colores[0] : null),
  );
  const [aviso, setAviso] = useState<string | null>(null);

  const necesitaTalle = product.talles.length > 0;
  const necesitaColor = product.colores.length > 0;
  const usaVariantes = variantes.length > 0;

  // Stock por combinación talle|color
  const stockMap = new Map(
    variantes.map((v) => [`${v.talle}|${v.color}`, v.stock]),
  );
  const stockDe = (t: string | null, c: string | null) =>
    stockMap.get(`${t ?? ""}|${c ?? ""}`) ?? 0;

  // ¿Hay stock para este talle (según el color elegido o cualquiera)?
  function talleDisponible(t: string) {
    if (!usaVariantes) return true;
    if (color) return stockDe(t, color) > 0;
    if (!necesitaColor) return stockDe(t, null) > 0;
    return product.colores.some((c) => stockDe(t, c) > 0);
  }
  function colorDisponible(c: string) {
    if (!usaVariantes) return true;
    if (talle) return stockDe(talle, c) > 0;
    if (!necesitaTalle) return stockDe(null, c) > 0;
    return product.talles.some((t) => stockDe(t, c) > 0);
  }

  const sinStock = usaVariantes
    ? variantes.every((v) => v.stock <= 0)
    : product.stock <= 0;

  const combinacionCompleta =
    (!necesitaTalle || !!talle) && (!necesitaColor || !!color);
  const stockSeleccion = stockDe(talle, color);

  function agregar() {
    if (necesitaTalle && !talle) {
      setAviso("Elegí un talle para continuar.");
      return;
    }
    if (necesitaColor && !color) {
      setAviso("Elegí un color para continuar.");
      return;
    }
    if (usaVariantes && stockSeleccion <= 0) {
      setAviso("No hay stock de esa combinación. Probá otro talle.");
      return;
    }
    // No permitir superar el stock disponible
    const enCarrito = items
      .filter(
        (i) =>
          i.productId === product.id &&
          (i.talle ?? null) === talle &&
          (i.color ?? null) === color,
      )
      .reduce((a, i) => a + i.cantidad, 0);
    if (usaVariantes && enCarrito + 1 > stockSeleccion) {
      setAviso(
        `No hay más stock. Ya tenés ${enCarrito} en el carrito (quedan ${stockSeleccion}).`,
      );
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
      maxStock: usaVariantes ? stockSeleccion : undefined,
      bordado,
    });
  }

  // Si la ficha no recibió los colores del modelo (por ejemplo, en una vista
  // que todavía no los pasa), se cae a los del propio producto: siempre hay
  // selector de color, aunque sea el de uno solo.
  const colores: ColorDeFicha[] = coloresModelo.length
    ? coloresModelo
    : product.colores.map((c) => ({
        nombre: c,
        productId: product.id,
        esDeEste: true,
        hayStock: product.stock > 0,
      }));

  /** El color que se está mostrando, con nombre, para leerlo de un vistazo. */
  const colorMostrado =
    color ??
    (colores.find((c) => c.esDeEste)?.nombre || product.colores[0]) ??
    "—";

  function elegirColor(c: ColorDeFicha, disponible: boolean) {
    if (!disponible) return;
    if (c.esDeEste) {
      setColor(c.nombre);
      setAviso(null);
      return;
    }
    // Otro producto: se abre su ficha. `scroll: false` para que la página no
    // salte arriba — lo único que cambia es la prenda que se está mirando.
    startColor(() => router.push(`/producto/${c.productId}`, { scroll: false }));
  }

  const detalleSeleccion = [talle && `talle ${talle}`, color && `color ${color}`]
    .filter(Boolean)
    .join(", ");
  // Si ya lo armó en el previsualizador, el mensaje sale con el pedido escrito
  // y no hay que reconstruirlo a mano en la conversación.
  const mensajeBordado = bordado
    ? `¡Hola SAINT! 🖤 Me interesa "${product.nombre}"${
        detalleSeleccion ? ` (${detalleSeleccion})` : ""
      } con este BORDADO: ${describirBordado(bordado)}.${
        bordado.tipo === "imagen"
          ? " Te mando la imagen del diseño por acá."
          : ""
      } Quiero coordinar el bordado y el envío. ¡Gracias!`
    : `¡Hola SAINT! 🖤 Me interesa "${product.nombre}"${
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
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide2 text-saint-gray">
              Talle
            </p>
            <SizeChart categoria={product.categoria} molde={product.molde} />
          </div>
          <div className="flex flex-wrap gap-2">
            {product.talles.map((t) => {
              const disp = talleDisponible(t);
              return (
                <button
                  key={t}
                  onClick={() => disp && setTalle(t)}
                  disabled={!disp}
                  className={`min-w-[3rem] border px-4 py-2 text-sm transition-all duration-300 ${
                    talle === t
                      ? "border-saint-white bg-saint-white text-saint-black"
                      : disp
                        ? "border-saint-line text-saint-gray hover:border-saint-white hover:text-saint-white"
                        : "cursor-not-allowed border-saint-line/40 text-saint-gray/30 line-through"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color. Están TODOS los del modelo, no solo los de este producto:
          el cliente piensa "quiero esta gorra en verde", no "quiero el
          producto de al lado". Elegir un color de otro producto abre su ficha,
          que es donde vive su foto y su stock. */}
      {colores.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs uppercase tracking-wide2 text-saint-gray">
              Color
            </p>
            <p className="text-sm text-saint-gray">{colorMostrado}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {colores.map((c) => {
              // Los colores de este producto respetan el stock por variante;
              // los de un hermano, su stock total.
              const disp = c.esDeEste ? colorDisponible(c.nombre) : c.hayStock;
              const activo = c.esDeEste && color === c.nombre;
              const hex = colorHex(c.nombre);

              return (
                <button
                  key={`${c.productId}-${c.nombre}`}
                  type="button"
                  onClick={() => elegirColor(c, disp)}
                  disabled={!disp || cambiandoColor}
                  title={disp ? c.nombre : `${c.nombre} — sin stock`}
                  aria-pressed={activo}
                  className={`relative h-9 w-9 rounded-full border transition-all duration-300 ease-smooth ${
                    activo
                      ? "border-saint-white ring-1 ring-saint-white ring-offset-2 ring-offset-saint-black"
                      : disp
                        ? "border-saint-line hover:scale-110 hover:border-saint-white"
                        : "cursor-not-allowed border-saint-line/40 opacity-40"
                  }`}
                  style={{ backgroundColor: hex ?? "#d8d5cf" }}
                >
                  {!disp && (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center text-xs text-saint-black/70"
                    >
                      ✕
                    </span>
                  )}
                  <span className="sr-only">{c.nombre}</span>
                </button>
              );
            })}
          </div>

          {colores.length > 1 && (
            <p className="text-[11px] text-saint-gray/70">
              {colores.length} colores · elegí uno y cambia la foto
            </p>
          )}
        </div>
      )}

      {/* Disponibilidad de la combinación elegida */}
      {usaVariantes && combinacionCompleta && !sinStock && (
        <p className="text-xs text-saint-gray">
          {stockSeleccion > 0
            ? `Disponible${stockSeleccion <= 5 ? ` · quedan ${stockSeleccion}` : ""}`
            : "Sin stock en esa combinación"}
        </p>
      )}

      {/* El bordado armado en el previsualizador */}
      {bordado ? (
        <div className="border border-saint-white/40 bg-saint-ink/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide2 text-saint-gray">
                Tu bordado
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                {describirBordado(bordado)}
              </p>
            </div>
            {onQuitarBordado && (
              <button
                type="button"
                onClick={onQuitarBordado}
                className="shrink-0 text-[10px] uppercase tracking-wide2 text-saint-gray transition-colors hover:text-red-400"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-saint-gray">
            Va anotado en tu pedido y está incluido en el precio. Lo que viste
            en el previsualizador es una referencia: el bordado real se hace a
            mano y no queda idéntico al dibujo.
          </p>
        </div>
      ) : (
        onProbarBordado && (
          <button
            type="button"
            onClick={onProbarBordado}
            className="group w-full border border-dashed border-saint-line px-5 py-4 text-left transition-colors duration-300 hover:border-saint-white"
          >
            <p className="text-[11px] uppercase tracking-wide2 text-saint-gray">
              Esta prenda sale lisa
            </p>
            <p className="mt-1 text-sm text-saint-gray transition-colors group-hover:text-saint-white">
              Probá cómo queda con tu bordado →
            </p>
          </button>
        )
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

        <ShareButton
          nombre={product.nombre}
          precio={product.precio}
          talle={talle}
          color={color}
        />
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
