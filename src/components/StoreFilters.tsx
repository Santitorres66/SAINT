"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CATEGORIAS,
  ORDENES_CATALOGO,
  ORDEN_POR_DEFECTO,
  formatPrecio,
  labelCategoria,
} from "@/lib/constants";

/** Las opciones que existen de verdad en el catálogo (salen de la base). */
export type OpcionesCatalogo = {
  talles: string[];
  colores: string[];
  precioMin: number;
  precioMax: number;
};

/**
 * Barra de filtros y orden del catálogo.
 *
 * Todo el estado vive en la URL (?categoria=&q=&talle=&color=&min=&max=&orden=)
 * y no en el componente: así la búsqueda se puede compartir, el botón "atrás"
 * del navegador funciona, y quien vuelve al listado desde un producto lo
 * encuentra como lo dejó.
 *
 * Los filtros de talle y color son de selección múltiple y suman: elegir S y M
 * trae las prendas que tengan cualquiera de los dos.
 */
export default function StoreFilters({
  opciones,
  cantidad,
}: {
  opciones: OpcionesCatalogo;
  /** Cuántos productos quedaron, para mostrar el resultado del filtrado. */
  cantidad: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  const categoria = searchParams.get("categoria");
  const q = searchParams.get("q") ?? "";
  const tallesSel = leerLista(searchParams.get("talle"));
  const coloresSel = leerLista(searchParams.get("color"));
  const min = searchParams.get("min") ?? "";
  const max = searchParams.get("max") ?? "";
  const orden = searchParams.get("orden") ?? ORDEN_POR_DEFECTO;

  const [abierto, setAbierto] = useState(false);

  /** Reescribe la URL con los params cambiados. `null` borra el param. */
  function navegar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    const qs = params.toString();
    startTransition(() =>
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  // Los campos que se escriben (búsqueda y precios) se editan local y recién
  // viajan a la URL cuando el cliente deja de tipear: navegar en cada tecla
  // dispararía una consulta por letra.
  const [texto, setTexto] = useCampoDemorado(q, (v) => navegar({ q: v }));
  const [minTxt, setMinTxt] = useCampoDemorado(min, (v) => navegar({ min: v }));
  const [maxTxt, setMaxTxt] = useCampoDemorado(max, (v) => navegar({ max: v }));

  /** Agrega o saca un valor de un filtro de selección múltiple. */
  function alternar(clave: "talle" | "color", valor: string) {
    const actuales = clave === "talle" ? tallesSel : coloresSel;
    const nuevos = actuales.includes(valor)
      ? actuales.filter((v) => v !== valor)
      : [...actuales, valor];
    navegar({ [clave]: nuevos.length ? nuevos.join(",") : null });
  }

  function limpiarTodo() {
    // La categoría no se toca: es navegación del catálogo, no un filtro más.
    navegar({
      q: null,
      talle: null,
      color: null,
      min: null,
      max: null,
      orden: null,
    });
  }

  // Chips de "esto está filtrando ahora", para poder sacarlos de a uno.
  const activos: { label: string; quitar: () => void }[] = [
    ...tallesSel.map((t) => ({
      label: `Talle ${t}`,
      quitar: () => alternar("talle", t),
    })),
    ...coloresSel.map((c) => ({
      label: c,
      quitar: () => alternar("color", c),
    })),
  ];
  if (q) activos.push({ label: `"${q}"`, quitar: () => navegar({ q: null }) });
  if (min)
    activos.push({
      label: `Desde ${formatPrecio(Number(min))}`,
      quitar: () => navegar({ min: null }),
    });
  if (max)
    activos.push({
      label: `Hasta ${formatPrecio(Number(max))}`,
      quitar: () => navegar({ max: null }),
    });

  const hayFiltros = activos.length > 0 || orden !== ORDEN_POR_DEFECTO;

  const chipBase =
    "border px-4 py-2 text-xs uppercase tracking-wide2 transition-all duration-300";
  const chipOn = "border-saint-white bg-saint-white text-saint-black";
  const chipOff =
    "border-saint-line text-saint-gray hover:border-saint-white hover:text-saint-white";

  return (
    <div className="space-y-6">
      {/* Categorías */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <BotonCategoria
          activo={!categoria}
          onClick={() => navegar({ categoria: null, talle: null, color: null })}
        >
          Todo
        </BotonCategoria>
        {CATEGORIAS.map((c) => (
          <BotonCategoria
            key={c.value}
            activo={categoria === c.value}
            onClick={() =>
              // Al cambiar de rubro se sueltan talle y color: los de la
              // categoría anterior podrían no existir en la nueva y dejarían
              // la grilla vacía sin que se entienda por qué.
              navegar({ categoria: c.value, talle: null, color: null })
            }
          >
            {c.label}
          </BotonCategoria>
        ))}
      </div>

      <span className="hairline block" />

      {/* Buscador · Filtros · Orden */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            className="w-full border-b border-saint-line bg-transparent py-2 pr-6 text-sm outline-none transition-colors placeholder:text-saint-gray focus:border-saint-white"
          />
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-saint-white"
          >
            Filtros{activos.length > 0 && ` (${activos.length})`}
            <span aria-hidden className="ml-2 inline-block">
              {abierto ? "−" : "+"}
            </span>
          </button>

          <label className="flex items-center gap-2 text-xs uppercase tracking-wide2 text-saint-gray">
            Ordenar
            <select
              value={orden}
              onChange={(e) =>
                navegar({
                  orden:
                    e.target.value === ORDEN_POR_DEFECTO
                      ? null
                      : e.target.value,
                })
              }
              className="cursor-pointer border-b border-saint-line bg-transparent py-1 text-xs uppercase tracking-wide2 text-saint-white outline-none transition-colors focus:border-saint-white"
            >
              {ORDENES_CATALOGO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Panel desplegable */}
      {abierto && (
        <div className="grid gap-8 border border-saint-line p-6 sm:grid-cols-2 lg:grid-cols-3">
          {opciones.talles.length > 0 && (
            <GrupoFiltro titulo="Talle">
              <div className="flex flex-wrap gap-2">
                {opciones.talles.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternar("talle", t)}
                    aria-pressed={tallesSel.includes(t)}
                    className={`${chipBase} min-w-[3rem] ${
                      tallesSel.includes(t) ? chipOn : chipOff
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </GrupoFiltro>
          )}

          {opciones.colores.length > 0 && (
            <GrupoFiltro titulo="Color">
              <div className="flex flex-wrap gap-2">
                {opciones.colores.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => alternar("color", c)}
                    aria-pressed={coloresSel.includes(c)}
                    className={`${chipBase} ${
                      coloresSel.includes(c) ? chipOn : chipOff
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </GrupoFiltro>
          )}

          <GrupoFiltro titulo="Precio">
            <div className="flex items-center gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={minTxt}
                onChange={(e) => setMinTxt(e.target.value)}
                placeholder={String(Math.floor(opciones.precioMin))}
                aria-label="Precio mínimo"
                className="w-full border-b border-saint-line bg-transparent py-2 text-sm outline-none placeholder:text-saint-gray focus:border-saint-white"
              />
              <span className="text-saint-gray">—</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={maxTxt}
                onChange={(e) => setMaxTxt(e.target.value)}
                placeholder={String(Math.ceil(opciones.precioMax))}
                aria-label="Precio máximo"
                className="w-full border-b border-saint-line bg-transparent py-2 text-sm outline-none placeholder:text-saint-gray focus:border-saint-white"
              />
            </div>
            <p className="mt-2 text-xs text-saint-gray">
              {categoria ? labelCategoria(categoria) : "El catálogo"} va de{" "}
              {formatPrecio(opciones.precioMin)} a{" "}
              {formatPrecio(opciones.precioMax)}
            </p>
          </GrupoFiltro>
        </div>
      )}

      {/* Filtros activos + resultado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {activos.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={f.quitar}
              className="group flex items-center gap-2 border border-saint-line px-3 py-1.5 text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:border-saint-white hover:text-saint-white"
            >
              {f.label}
              <span aria-hidden>✕</span>
              <span className="sr-only">Quitar filtro</span>
            </button>
          ))}
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarTodo}
              className="px-2 text-xs uppercase tracking-wide2 text-saint-gray underline underline-offset-4 transition-colors hover:text-saint-white"
            >
              Limpiar todo
            </button>
          )}
        </div>

        <p
          aria-live="polite"
          className={`text-xs uppercase tracking-wide2 text-saint-gray transition-opacity duration-300 ${
            pendiente ? "opacity-40" : "opacity-100"
          }`}
        >
          {cantidad === 1 ? "1 producto" : `${cantidad} productos`}
        </p>
      </div>
    </div>
  );
}

/* --- Piezas internas --- */

function BotonCategoria({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-xs uppercase tracking-wide2 transition-colors duration-300 ${
        activo ? "text-saint-white" : "text-saint-gray hover:text-saint-white"
      }`}
    >
      {children}
    </button>
  );
}

function GrupoFiltro({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-xs uppercase tracking-wide2 text-saint-gray">
        {titulo}
      </p>
      {children}
    </div>
  );
}

/**
 * Un campo de texto que se edita al instante pero recién avisa 400 ms después
 * de la última tecla. Si el valor cambia desde afuera (el botón "atrás", o
 * "Limpiar todo") el campo se pone al día solo.
 */
function useCampoDemorado(
  valorUrl: string,
  aplicar: (valor: string | null) => void,
): [string, (v: string) => void] {
  const [valor, setValor] = useState(valorUrl);

  useEffect(() => setValor(valorUrl), [valorUrl]);

  useEffect(() => {
    if (valor === valorUrl) return;
    const t = setTimeout(() => aplicar(valor || null), 400);
    return () => clearTimeout(t);
    // `aplicar` se recrea en cada render: incluirlo reiniciaría la espera sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, valorUrl]);

  return [valor, setValor];
}

/** "S,M,L" → ["S","M","L"], tolerando espacios y valores vacíos. */
function leerLista(valor: string | null): string[] {
  if (!valor) return [];
  return valor
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
