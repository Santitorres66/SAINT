"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { claveMolde } from "@/lib/constants";

/**
 * Un campo que se escribe y va filtrando, en lugar de una lista para scrollear.
 *
 * Con cuarenta productos o doscientos clientes, un `<select>` deja de ser una
 * ayuda: hay que bajar buscando con el ojo y es facilísimo elegir el de al
 * lado. Acá se escriben tres letras y quedan dos opciones.
 *
 * Se maneja entero con el teclado (flechas para moverse, Enter para elegir,
 * Escape para cerrar), porque cargar diez líneas de una compra sin soltar el
 * teclado es la diferencia entre dos minutos y diez.
 */

export type OpcionBuscador = {
  value: string;
  /** Lo que se ve y sobre lo que se busca. */
  label: string;
  /** Un dato al costado, más apagado: stock, precio, teléfono. */
  detalle?: string;
};

export default function Buscador({
  opciones,
  value,
  onSelect,
  placeholder = "Escribí para buscar…",
  vacio = "— Sin elegir —",
  libre = false,
  textoLibre = "",
  id,
  className = "",
  disabled = false,
}: {
  opciones: OpcionBuscador[];
  /** El `value` de la opción elegida, o "" si no hay ninguna. */
  value: string;
  /**
   * Avisa qué se eligió. Con `libre`, una opción escrita a mano llega con
   * `value: ""` y el texto tal cual se tipeó en `label`.
   */
  onSelect: (opcion: OpcionBuscador | null) => void;
  placeholder?: string;
  /** El texto de la opción que no elige nada. */
  vacio?: string;
  /**
   * Permite escribir algo que no está en la lista. Para el nombre de un
   * cliente que todavía no está cargado en el master, por ejemplo: obligarlo a
   * darlo de alta antes de poder anotar la venta frena el trabajo.
   */
  libre?: boolean;
  /** Con `libre`, el texto escrito que hay que mostrar al abrir el formulario. */
  textoLibre?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const generado = useId();
  const idCampo = id ?? generado;

  const elegida = opciones.find((o) => o.value === value) ?? null;
  /** Lo que tiene que decir el campo cuando no se lo está editando. */
  const textoEnReposo = elegida?.label ?? (libre ? textoLibre : "");

  const [q, setQ] = useState(textoEnReposo);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  // Si la elección cambia desde afuera (se limpió el formulario, se cargó uno
  // para editar), el campo se pone al día solo.
  useEffect(() => {
    setQ(textoEnReposo);
  }, [textoEnReposo]);

  // Un clic en cualquier otro lado cierra la lista. Sin esto queda abierta
  // flotando sobre el resto del formulario.
  useEffect(() => {
    if (!abierto) return;
    function afuera(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) cerrar();
    }
    document.addEventListener("mousedown", afuera);
    return () => document.removeEventListener("mousedown", afuera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, textoEnReposo]);

  const filtradas = useMemo(() => {
    // Mientras no se escriba nada (o esté el texto de lo ya elegido), se
    // muestra todo: la lista completa sigue estando a un clic.
    const busqueda = q.trim() === textoEnReposo.trim() ? "" : q;
    return filtrar(opciones, busqueda);
  }, [opciones, q, textoEnReposo]);

  function abrir() {
    if (disabled) return;
    setAbierto(true);
    setResaltado(0);
  }

  function cerrar() {
    setAbierto(false);
    // Lo escrito a mano se conserva solo si el campo lo permite; si no, el
    // campo vuelve a mostrar lo que está realmente elegido, para que nunca
    // diga una cosa y valga otra.
    if (libre) {
      const limpio = q.trim();
      if (limpio !== textoEnReposo.trim()) {
        onSelect(limpio ? { value: "", label: limpio } : null);
      }
    } else {
      setQ(textoEnReposo);
    }
  }

  function elegir(opcion: OpcionBuscador | null) {
    onSelect(opcion);
    setQ(opcion?.label ?? "");
    setAbierto(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) return abrir();
      const total = filtradas.length + 1; // +1 por la opción vacía
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setResaltado((r) => (r + paso + total) % total);
      return;
    }
    if (e.key === "Enter") {
      if (!abierto) return;
      e.preventDefault();
      elegir(resaltado === 0 ? null : filtradas[resaltado - 1] ?? null);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    }
  }

  // Que la opción resaltada con el teclado no quede fuera de la vista.
  useEffect(() => {
    if (!abierto) return;
    const nodo = lista.current?.children[resaltado] as HTMLElement | undefined;
    nodo?.scrollIntoView({ block: "nearest" });
  }, [resaltado, abierto]);

  const base =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-100";

  return (
    <div ref={caja} className={`relative ${className}`}>
      <input
        id={idCampo}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        aria-controls={`${idCampo}-lista`}
        autoComplete="off"
        disabled={disabled}
        value={q}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
          setResaltado(0);
        }}
        onFocus={abrir}
        onKeyDown={onKeyDown}
        className={base}
      />

      {/* La crucecita para soltar lo elegido sin tener que borrar a mano. */}
      {!disabled && (value || (libre && q)) && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => elegir(null)}
          aria-label="Limpiar"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition hover:text-neutral-700"
        >
          ✕
        </button>
      )}

      {abierto && (
        <ul
          ref={lista}
          id={`${idCampo}-lista`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <li
            role="option"
            aria-selected={!value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => elegir(null)}
            onMouseEnter={() => setResaltado(0)}
            className={`cursor-pointer px-4 py-2 text-sm text-neutral-500 ${
              resaltado === 0 ? "bg-neutral-100" : ""
            }`}
          >
            {vacio}
          </li>

          {filtradas.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o)}
              onMouseEnter={() => setResaltado(i + 1)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm ${
                resaltado === i + 1 ? "bg-neutral-100" : ""
              } ${o.value === value ? "font-medium" : ""}`}
            >
              <span>{o.label}</span>
              {o.detalle && (
                <span className="shrink-0 text-xs text-neutral-400">
                  {o.detalle}
                </span>
              )}
            </li>
          ))}

          {filtradas.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-400">
              {libre
                ? "No está en la lista — se guarda lo que escribiste."
                : "No hay resultados."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Filtra por palabras sueltas y sin acentos: "gorra neg" encuentra
 * "Gorra Vintage · Negro", y "nego" no encuentra nada aunque exista "Negro"
 * —buscar tolerando errores de tipeo traería más ruido que ayuda—.
 *
 * Se piden TODAS las palabras, en cualquier orden: así cada palabra que se
 * agrega achica la lista, que es como uno espera que funcione.
 */
function filtrar(
  opciones: OpcionBuscador[],
  busqueda: string,
): OpcionBuscador[] {
  const palabras = claveMolde(busqueda).split(/\s+/).filter(Boolean);
  if (!palabras.length) return opciones;

  return opciones.filter((o) => {
    const texto = claveMolde(`${o.label} ${o.detalle ?? ""}`);
    return palabras.every((p) => texto.includes(p));
  });
}
