"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  describirBordado,
  ESCALA_INICIAL,
  ESCALA_MAX,
  ESCALA_MIN,
  HILOS,
  MAX_TEXTO,
  MOTIVOS,
  POSICION_INICIAL,
  UBICACIONES_RAPIDAS,
  motivoPorId,
  tamanoDe,
  ubicacionDe,
} from "@/lib/bordado";
import type { BordadoSpec, Posicion, TipoBordado } from "@/lib/bordado";

/**
 * PREVISUALIZADOR DE BORDADO
 *
 * El cliente arrastra un motivo sobre la foto de su prenda, lo agranda y le
 * elige el hilo. No pretende ser exacto —el bordado real lo hace una persona,
 * no un render— y por eso lo dice en pantalla: está para que se anime a
 * imaginarlo, que es lo que hoy le estamos pidiendo que haga de memoria.
 *
 * La imagen propia NO se sube a ningún lado: se mira desde el archivo que ya
 * está en el teléfono y se manda después por WhatsApp. Así el previsualizador
 * no necesita servidor, ni permisos de storage, ni guardar fotos de nadie.
 */
export default function BordadoStudio({
  imagen,
  nombreProducto,
  aplicado,
  onAplicar,
}: {
  /** La foto de la prenda sobre la que se prueba. */
  imagen?: string;
  nombreProducto: string;
  /** El bordado que ya está sumado al pedido, si hay alguno. */
  aplicado: BordadoSpec | null;
  /** Suma el bordado al pedido, o lo saca con `null`. */
  onAplicar: (bordado: BordadoSpec | null) => void;
}) {
  const [tipo, setTipo] = useState<TipoBordado>("motivo");
  const [motivoId, setMotivoId] = useState(MOTIVOS[0].id);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [pos, setPos] = useState<Posicion>(POSICION_INICIAL);
  const [escala, setEscala] = useState(ESCALA_INICIAL);
  const [hilo, setHilo] = useState(HILOS[0]);
  const [arrastrando, setArrastrando] = useState(false);

  const lienzo = useRef<HTMLDivElement>(null);
  /** Distancia entre el dedo y el centro del bordado al empezar a arrastrar. */
  const agarre = useRef<Posicion>({ x: 0, y: 0 });

  // La URL del archivo elegido vive en memoria del navegador: hay que soltarla
  // al cambiarla o al irse, o el navegador se queda con la imagen colgada.
  useEffect(() => {
    return () => {
      if (archivo) URL.revokeObjectURL(archivo);
    };
  }, [archivo]);

  const motivo = motivoPorId(motivoId) ?? MOTIVOS[0];
  const ubicacion = ubicacionDe(pos);
  const tamano = tamanoDe(escala);

  // Qué dice el bordado según lo que se está bordando. Un texto vacío o una
  // imagen sin elegir no son un bordado todavía: ahí no hay nada que anotar.
  const nombreBordado =
    tipo === "motivo"
      ? motivo.nombre
      : tipo === "texto"
        ? texto.trim()
          ? `Texto "${texto.trim()}"`
          : ""
        : archivo
          ? `Imagen propia${nombreArchivo ? ` (${nombreArchivo})` : ""}`
          : "";

  // El bordado que se está viendo en pantalla. Todavía no es parte del pedido:
  // recién lo es cuando se lo confirma con el botón. Mirar el previsualizador
  // no tiene que dejarte un corazón bordado en el carrito sin haberlo pedido.
  const enPantalla: BordadoSpec | null = nombreBordado
    ? { tipo, motivo: nombreBordado, ubicacion, tamano, hilo: hilo.nombre }
    : null;

  const yaEsteMismo =
    !!aplicado &&
    !!enPantalla &&
    describirBordado(aplicado) === describirBordado(enPantalla);

  /** Dónde está el puntero dentro del lienzo, en % de su ancho y alto. */
  function enLienzo(clientX: number, clientY: number): Posicion | null {
    const caja = lienzo.current?.getBoundingClientRect();
    if (!caja) return null;
    return {
      x: ((clientX - caja.left) / caja.width) * 100,
      y: ((clientY - caja.top) / caja.height) * 100,
    };
  }

  /**
   * Mueve el bordado siguiendo al dedo, conservando desde dónde se lo agarró:
   * si lo tomás de una punta, esa punta es la que sigue al dedo. Sin esto el
   * bordado salta y se centra bajo el puntero apenas lo tocás, que se siente
   * como si se te escapara de la mano.
   */
  function mover(clientX: number, clientY: number) {
    const p = enLienzo(clientX, clientY);
    if (!p) return;
    // El margen impide soltarlo justo en el borde, donde quedaría cortado.
    setPos({
      x: acotar(p.x - agarre.current.x, 8, 92),
      y: acotar(p.y - agarre.current.y, 8, 92),
    });
  }

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (archivo) URL.revokeObjectURL(archivo);
    setArchivo(URL.createObjectURL(f));
    setNombreArchivo(f.name);
    setTipo("imagen");
  }

  const tabBase =
    "px-4 py-2 text-[11px] uppercase tracking-wide2 transition-colors duration-300";

  return (
    <div className="space-y-5">
      {/* EL LIENZO */}
      <div
        ref={lienzo}
        className="relative aspect-[3/4] w-full select-none overflow-hidden bg-saint-ink"
        onPointerMove={(e) => arrastrando && mover(e.clientX, e.clientY)}
        onPointerUp={() => setArrastrando(false)}
        onPointerLeave={() => setArrastrando(false)}
      >
        {imagen ? (
          <Image
            src={imagen}
            alt={nombreProducto}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="brand text-3xl text-saint-line">SAINT</span>
          </div>
        )}

        {/* EL BORDADO. Se arrastra con el dedo o con el mouse; `touch-none`
            evita que el celular scrollee la página mientras se lo mueve. */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Mover el bordado. También se puede mover con las flechas del teclado."
          onPointerDown={(e) => {
            e.preventDefault();
            const p = enLienzo(e.clientX, e.clientY);
            agarre.current = p ? { x: p.x - pos.x, y: p.y - pos.y } : { x: 0, y: 0 };
            setArrastrando(true);
          }}
          onKeyDown={(e) => {
            // Con teclado se mueve de a un punto; quien no puede arrastrar
            // igual tiene que poder ubicar su bordado.
            const paso = e.shiftKey ? 5 : 1;
            const salto: Record<string, Posicion> = {
              ArrowLeft: { x: -paso, y: 0 },
              ArrowRight: { x: paso, y: 0 },
              ArrowUp: { x: 0, y: -paso },
              ArrowDown: { x: 0, y: paso },
            };
            const d = salto[e.key];
            if (!d) return;
            e.preventDefault();
            setPos((p) => ({
              x: acotar(p.x + d.x, 8, 92),
              y: acotar(p.y + d.y, 8, 92),
            }));
          }}
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: `${escala}%`,
          }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none outline-none ring-offset-2 ring-offset-saint-black focus-visible:ring-1 focus-visible:ring-saint-white ${
            arrastrando ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <Puntada
            tipo={tipo}
            motivo={motivo}
            texto={texto}
            archivo={archivo}
            hilo={hilo.hex}
          />
        </div>

        {/* La pista de que esto se toca. Se va apenas se lo mueve. */}
        {!arrastrando && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-saint-black/70 py-2 text-center text-[10px] uppercase tracking-wide2 text-saint-gray backdrop-blur-sm">
            Arrastrá el bordado sobre la prenda
          </span>
        )}
      </div>

      {/* QUÉ SE BORDA */}
      <div className="flex border border-saint-line">
        {(
          [
            ["motivo", "Motivos"],
            ["texto", "Texto"],
            ["imagen", "Tu imagen"],
          ] as [TipoBordado, string][]
        ).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setTipo(valor)}
            aria-pressed={tipo === valor}
            className={`flex-1 ${tabBase} ${
              tipo === valor
                ? "bg-saint-white text-saint-black"
                : "text-saint-gray hover:text-saint-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tipo === "motivo" && (
        <div className="flex flex-wrap gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMotivoId(m.id)}
              aria-pressed={m.id === motivoId}
              title={m.nombre}
              className={`flex h-12 w-12 items-center justify-center border transition-all duration-300 ${
                m.id === motivoId
                  ? "border-saint-white"
                  : "border-saint-line hover:border-saint-white"
              }`}
            >
              <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
                {m.trazos.map((d) => (
                  <path
                    key={d}
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
              <span className="sr-only">{m.nombre}</span>
            </button>
          ))}
        </div>
      )}

      {tipo === "texto" && (
        <div>
          <input
            type="text"
            value={texto}
            maxLength={MAX_TEXTO}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Tus iniciales, una fecha, una palabra"
            aria-label="Texto del bordado"
            className="w-full border-b border-saint-line bg-transparent py-2 text-sm outline-none placeholder:text-saint-gray focus:border-saint-white"
          />
          <p className="mt-2 text-[11px] text-saint-gray">
            Hasta {MAX_TEXTO} caracteres. Se borda en la tipografía de SAINT.
          </p>
        </div>
      )}

      {tipo === "imagen" && (
        <div>
          <label className="block cursor-pointer border border-dashed border-saint-line px-6 py-5 text-center text-xs uppercase tracking-wide2 text-saint-gray transition-colors duration-300 hover:border-saint-white hover:text-saint-white">
            {nombreArchivo || "Elegí una imagen de tu galería"}
            <input
              type="file"
              accept="image/*"
              onChange={elegirArchivo}
              className="sr-only"
            />
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-saint-gray">
            La imagen no se sube: la ves acá, en tu teléfono, para probar cómo
            queda. Nos la mandás por WhatsApp cuando coordinemos el bordado.
          </p>
        </div>
      )}

      {/* DÓNDE Y DE QUÉ TAMAÑO */}
      <div className="space-y-4 border-t border-saint-line pt-5">
        <div className="flex flex-wrap gap-2">
          {UBICACIONES_RAPIDAS.map((u) => (
            <button
              key={u.nombre}
              type="button"
              onClick={() => setPos(u.pos)}
              className={`border px-3 py-1.5 text-[10px] uppercase tracking-wide2 transition-all duration-300 ${
                ubicacion === u.nombre
                  ? "border-saint-white text-saint-white"
                  : "border-saint-line text-saint-gray hover:border-saint-white hover:text-saint-white"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-4">
          <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide2 text-saint-gray">
            Tamaño
          </span>
          <input
            type="range"
            min={ESCALA_MIN}
            max={ESCALA_MAX}
            value={escala}
            onChange={(e) => setEscala(Number(e.target.value))}
            className="h-px flex-1 cursor-pointer appearance-none bg-saint-line accent-saint-white"
            aria-label="Tamaño del bordado"
          />
          <span className="w-20 text-right text-[10px] uppercase tracking-wide2 text-saint-gray">
            {tamano}
          </span>
        </label>

        <div className="flex items-center gap-4">
          <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide2 text-saint-gray">
            Hilo
          </span>
          <div className="flex flex-wrap gap-2">
            {HILOS.map((h) => (
              <button
                key={h.nombre}
                type="button"
                onClick={() => setHilo(h)}
                aria-pressed={h.nombre === hilo.nombre}
                title={h.nombre}
                className={`h-5 w-5 rounded-full border transition-all duration-300 hover:scale-110 ${
                  h.nombre === hilo.nombre
                    ? "border-saint-white ring-1 ring-saint-white ring-offset-2 ring-offset-saint-black"
                    : "border-saint-line"
                }`}
                style={{ backgroundColor: h.hex }}
              >
                <span className="sr-only">Hilo {h.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMARLO AL PEDIDO */}
      <div className="space-y-3 border-t border-saint-line pt-5">
        <button
          type="button"
          onClick={() => onAplicar(enPantalla)}
          disabled={!enPantalla || yaEsteMismo}
          className="btn-line w-full disabled:cursor-not-allowed disabled:border-saint-line disabled:text-saint-gray disabled:hover:bg-transparent disabled:hover:text-saint-gray"
        >
          {yaEsteMismo
            ? "Bordado sumado al pedido"
            : aplicado
              ? "Actualizar el bordado"
              : "Sumar este bordado"}
        </button>

        {aplicado && (
          <button
            type="button"
            onClick={() => onAplicar(null)}
            className="w-full text-center text-[11px] uppercase tracking-wide2 text-saint-gray underline underline-offset-4 transition-colors hover:text-saint-white"
          >
            Quitar el bordado y llevar la prenda lisa
          </button>
        )}

        {/* La aclaración va acá, junto al botón, y no al pie en letra chica:
            es el momento exacto en que la persona decide. Que el bordado real
            no es igual al dibujo tiene que quedar dicho ANTES de comprar, no
            después, cuando ya es un reclamo. */}
        <div className="border border-saint-line bg-saint-ink/40 p-4">
          <p className="text-[11px] uppercase tracking-wide2 text-saint-gray">
            Esto es un dibujo, no el bordado
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-saint-gray">
            La vista es aproximada y sirve para ubicar y dimensionar. El bordado
            real lo hace una persona con hilo: tiene relieve, textura y sus
            propias variaciones, y el color del hilo puede verse distinto según
            la tela y la luz. El tamaño y la posición finales los confirmamos
            con vos por WhatsApp, junto con el precio del bordado, que no está
            incluido en el de la prenda.
          </p>
          <Link
            href="/galeria"
            className="mt-3 inline-block text-[11px] uppercase tracking-wide2 text-saint-white underline underline-offset-4 transition-colors hover:text-saint-gray"
          >
            Mirá cómo quedan los bordados reales →
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * El bordado dibujado. El trazo va cortado (`strokeDasharray`) para que se lea
 * como puntadas y no como una línea impresa, que es justo la diferencia que la
 * marca quiere mostrar.
 */
function Puntada({
  tipo,
  motivo,
  texto,
  archivo,
  hilo,
}: {
  tipo: TipoBordado;
  motivo: { nombre: string; trazos: string[] };
  texto: string;
  archivo: string | null;
  hilo: string;
}) {
  // Una sombra apenas marcada: el hilo tiene relieve, no está impreso.
  const relieve = { filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))" };

  if (tipo === "texto") {
    const escrito = texto || "…";
    // El texto se dibuja dentro de un SVG y no como texto suelto: así crece
    // con el control de tamaño igual que un motivo, sin depender de la
    // tipografía base de la página. El cuerpo se achica a medida que se
    // escribe para que una palabra larga no se salga de la prenda.
    const cuerpo = Math.min(30, 170 / Math.max(escrito.length, 2));

    return (
      <svg viewBox="0 0 100 40" className="anim-aparece w-full" style={relieve}>
        <text
          x="50"
          y="26"
          textAnchor="middle"
          fill={hilo}
          fontSize={cuerpo}
          fontFamily="var(--font-serif), serif"
          letterSpacing="1"
        >
          {escrito}
        </text>
      </svg>
    );
  }

  if (tipo === "imagen") {
    if (!archivo) return null;
    return (
      // Es un archivo local del cliente (blob:), no una imagen del sitio:
      // next/image no puede optimizar lo que no existe en ningún servidor.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={archivo}
        alt="Tu bordado"
        className="anim-aparece w-full"
        style={relieve}
      />
    );
  }

  return (
    <svg viewBox="0 0 100 100" className="anim-aparece w-full" style={relieve}>
      {motivo.trazos.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={hilo}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="7 5"
        />
      ))}
    </svg>
  );
}

function acotar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}
