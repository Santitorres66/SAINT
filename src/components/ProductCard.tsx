"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Modelo } from "@/lib/catalogo";
import { colorHex, formatPrecio, labelCategoria } from "@/lib/constants";

/**
 * Tarjeta de un modelo en la vitrina.
 *
 * Muestra una prenda, no un color: los puntitos de abajo cambian la foto sin
 * salir de la grilla y recién al hacer clic se entra al color elegido. Así la
 * tienda deja de repetir la misma gorra cuatro veces.
 *
 * Al pasar por encima aparece la invitación al bordado. Es el único momento en
 * que la tarjeta dice algo de más, y lo dice porque es lo que separa a SAINT
 * de una prenda lisa cualquiera.
 */
export default function ProductCard({ modelo }: { modelo: Modelo }) {
  const { principal, colores } = modelo;
  const [elegido, setElegido] = useState(0);

  // El color que se está mirando; si el modelo no tiene colores cargados, se
  // muestra la foto del producto principal y listo.
  const color = colores[elegido];
  const portada = color?.imagen ?? principal.imagenes?.[0];
  const href = `/producto/${color?.productId ?? principal.id}${
    color ? `?color=${encodeURIComponent(color.nombre)}` : ""
  }`;

  const rubro = modelo.molde?.trim() || labelCategoria(modelo.categoria);
  const precio =
    modelo.precioMin === modelo.precioMax
      ? formatPrecio(modelo.precioMin)
      : `Desde ${formatPrecio(modelo.precioMin)}`;

  return (
    <div className="group">
      <Link href={href} className="block">
        {/* Foto */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-saint-ink">
          {portada ? (
            <Image
              // La `key` fuerza el fundido al cambiar de color: sin ella, la
              // imagen se reemplaza de un salto.
              key={portada}
              src={portada}
              alt={`${modelo.nombre}${color ? ` — ${color.nombre}` : ""}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="anim-aparece object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="brand text-2xl text-saint-line">SAINT</span>
            </div>
          )}

          {!modelo.hayStock && (
            <span className="absolute left-3 top-3 bg-saint-black/80 px-3 py-1 text-[10px] uppercase tracking-wide2 text-saint-gray">
              Agotado
            </span>
          )}

          {/* La invitación. Sube desde el borde al pasar por encima. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-saint-black/85 py-3 text-center text-[10px] uppercase tracking-wide2 text-saint-white opacity-0 backdrop-blur-sm transition-all duration-500 ease-smooth group-hover:translate-y-0 group-hover:opacity-100"
          >
            Elegí tu bordado
          </span>
        </div>

        {/* Ficha */}
        <div className="mt-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wide2 text-saint-gray">
            {rubro}
          </p>
          <h3 className="font-serif text-lg transition-colors duration-300 group-hover:text-saint-gray">
            {modelo.nombre}
          </h3>
          <p className="text-sm text-saint-gray">{precio}</p>
        </div>
      </Link>

      {/* Colores. Fuera del link: tocarlos cambia la foto, no navega. */}
      {colores.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {colores.map((c, i) => (
            <PuntoColor
              key={c.nombre}
              nombre={c.nombre}
              activo={i === elegido}
              onSelect={() => setElegido(i)}
            />
          ))}
          <span className="ml-1 text-[10px] uppercase tracking-wide2 text-saint-gray">
            {colores.length === 1
              ? colores[0].nombre
              : `${colores.length} colores`}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * El punto de un color. Cuando no se reconoce el nombre se pinta gris claro:
 * el nombre escrito al lado sigue diciendo de cuál se trata, y es preferible a
 * inventar un tono que la foto va a desmentir.
 */
function PuntoColor({
  nombre,
  activo,
  onSelect,
}: {
  nombre: string;
  activo: boolean;
  onSelect: () => void;
}) {
  const hex = colorHex(nombre);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      aria-pressed={activo}
      title={nombre}
      className={`h-4 w-4 rounded-full border transition-all duration-300 ease-smooth hover:scale-110 ${
        activo
          ? "border-saint-white ring-1 ring-saint-white ring-offset-2 ring-offset-saint-black"
          : "border-saint-line"
      }`}
      style={{ backgroundColor: hex ?? "#d8d5cf" }}
    >
      <span className="sr-only">Ver en {nombre}</span>
    </button>
  );
}
