/**
 * El bordado, como lo arma el cliente y como lo lee el taller.
 *
 * El previsualizador deja mover, agrandar y teñir un motivo sobre la foto de
 * la prenda. Eso, que en pantalla son coordenadas y porcentajes, acá se
 * traduce al idioma con el que se trabaja en producción: "pecho izquierdo",
 * "mediano", "hilo crudo". Las órdenes de producción ya guardan
 * `bordado_ubicacion` y `bordado_tamano`; esto escribe en esos mismos términos
 * para que lo que eligió el cliente se pueda copiar sin interpretar nada.
 */

/** Un motivo del catálogo: se dibuja con trazo, como una puntada. */
export type Motivo = {
  id: string;
  nombre: string;
  /** Trazos sobre un lienzo de 100×100. Se pintan con el color del hilo. */
  trazos: string[];
};

/**
 * Los motivos que se pueden probar en la web.
 *
 * Son pocos y a propósito: están para que el cliente vea CÓMO queda un bordado
 * en su prenda, no para reemplazar el diseño que va a pedir. El que ya sabe lo
 * que quiere sube su imagen o escribe su texto.
 */
export const MOTIVOS: Motivo[] = [
  {
    id: "corazon",
    nombre: "Corazón",
    trazos: [
      "M50 84 C 18 60, 10 34, 28 22 C 40 14, 50 24, 50 32 C 50 24, 60 14, 72 22 C 90 34, 82 60, 50 84 Z",
    ],
  },
  {
    id: "estrella",
    nombre: "Estrella",
    trazos: [
      "M50 10 L61 38 L91 40 L68 59 L76 88 L50 72 L24 88 L32 59 L9 40 L39 38 Z",
    ],
  },
  {
    id: "rayo",
    nombre: "Rayo",
    trazos: ["M58 8 L26 54 L46 54 L40 92 L74 44 L54 44 Z"],
  },
  {
    id: "luna",
    nombre: "Luna",
    trazos: ["M64 10 A 40 40 0 1 0 64 90 A 32 32 0 1 1 64 10 Z"],
  },
  {
    id: "cruz",
    nombre: "Cruz",
    trazos: ["M50 12 L50 88", "M26 38 L74 38"],
  },
  {
    id: "huella",
    nombre: "Huella",
    trazos: [
      "M50 52 C 62 52, 72 60, 72 70 C 72 80, 62 86, 50 86 C 38 86, 28 80, 28 70 C 28 60, 38 52, 50 52 Z",
      "M30 40 m -8 0 a 8 10 0 1 0 16 0 a 8 10 0 1 0 -16 0",
      "M70 40 m -8 0 a 8 10 0 1 0 16 0 a 8 10 0 1 0 -16 0",
      "M44 22 m -7 0 a 7 9 0 1 0 14 0 a 7 9 0 1 0 -14 0",
      "M64 20 m -7 0 a 7 9 0 1 0 14 0 a 7 9 0 1 0 -14 0",
    ],
  },
];

export function motivoPorId(id: string): Motivo | undefined {
  return MOTIVOS.find((m) => m.id === id);
}

/** Los hilos con los que se puede ver el bordado. */
export const HILOS: { nombre: string; hex: string }[] = [
  { nombre: "Crudo", hex: "#ece5d8" },
  { nombre: "Negro", hex: "#141414" },
  { nombre: "Blanco", hex: "#ffffff" },
  { nombre: "Dorado", hex: "#c9a227" },
  { nombre: "Bordó", hex: "#5e1a1f" },
  { nombre: "Verde militar", hex: "#4b5320" },
];

/** Qué se borda: uno del catálogo, un texto, o una imagen del cliente. */
export type TipoBordado = "motivo" | "texto" | "imagen";

/**
 * El bordado tal como queda armado. Es lo que viaja con el ítem del carrito y
 * termina anotado en la orden, así que son todos datos legibles: nada de
 * coordenadas ni de porcentajes, que al taller no le dicen nada.
 */
export type BordadoSpec = {
  tipo: TipoBordado;
  /** "Corazón", el texto escrito, o "Imagen propia". */
  motivo: string;
  ubicacion: string;
  tamano: string;
  hilo: string;
};

/** Posición del bordado sobre la prenda, en % del ancho y del alto. */
export type Posicion = { x: number; y: number };

/**
 * El nombre de un lugar de la prenda a partir de dónde se soltó el bordado.
 *
 * La foto se piensa como la prenda de frente, así que la izquierda de la
 * pantalla es el pecho izquierdo de quien la mira. Es una aproximación
 * deliberada: al taller le alcanza con "pecho izquierdo" y el milímetro se
 * define después, con la prenda en la mano.
 */
export function ubicacionDe({ x, y }: Posicion): string {
  const alto = y < 34 ? "alto" : y < 62 ? "medio" : "bajo";
  const lado = x < 38 ? "izquierdo" : x > 62 ? "derecho" : "centro";

  if (alto === "alto") {
    if (lado === "centro") return "Pecho centro";
    return `Pecho ${lado}`;
  }
  if (alto === "medio") {
    if (lado === "centro") return "Centro del frente";
    return `Costado ${lado}`;
  }
  if (lado === "centro") return "Bajo, al centro";
  return `Bajo ${lado}`;
}

/** El tamaño del bordado, a partir de cuánto ocupa del ancho de la prenda. */
export function tamanoDe(escala: number): string {
  if (escala < 14) return "Chico";
  if (escala < 26) return "Mediano";
  return "Grande";
}

/** Cuánto ocupa un bordado, en % del ancho, cuando se abre el previsualizador. */
export const ESCALA_INICIAL = 16;
export const ESCALA_MIN = 7;
export const ESCALA_MAX = 40;

/** Dónde aparece el bordado la primera vez: el pecho izquierdo, el clásico. */
export const POSICION_INICIAL: Posicion = { x: 32, y: 26 };

/** Atajos de ubicación, para no tener que arrastrar si no se quiere. */
export const UBICACIONES_RAPIDAS: { nombre: string; pos: Posicion }[] = [
  { nombre: "Pecho izquierdo", pos: { x: 32, y: 26 } },
  { nombre: "Pecho centro", pos: { x: 50, y: 28 } },
  { nombre: "Centro del frente", pos: { x: 50, y: 50 } },
  { nombre: "Bajo derecho", pos: { x: 68, y: 74 } },
];

/** Cuántos caracteres se aceptan en un bordado de texto. */
export const MAX_TEXTO = 24;

/**
 * El bordado en una línea: "Corazón · pecho izquierdo · mediano · hilo crudo".
 * Se usa en el carrito, en el mensaje de WhatsApp y en el detalle de la venta.
 */
export function describirBordado(b: BordadoSpec): string {
  return [b.motivo, b.ubicacion.toLowerCase(), b.tamano.toLowerCase(), `hilo ${b.hilo.toLowerCase()}`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Deja un bordado listo para guardarse: recorta los textos y descarta lo que
 * venga vacío o mal formado.
 *
 * Corre en el servidor, sobre lo que mandó un navegador, así que no se confía
 * en nada: si el objeto no tiene la forma esperada, no hay bordado y la orden
 * se crea igual. Un bordado raro nunca puede voltear una compra.
 */
export function sanearBordado(valor: unknown): BordadoSpec | null {
  if (!valor || typeof valor !== "object") return null;
  const b = valor as Record<string, unknown>;

  const texto = (clave: string, max: number): string =>
    typeof b[clave] === "string" ? (b[clave] as string).trim().slice(0, max) : "";

  const tipo = texto("tipo", 10);
  if (tipo !== "motivo" && tipo !== "texto" && tipo !== "imagen") return null;

  const motivo = texto("motivo", MAX_TEXTO + 20);
  if (!motivo) return null;

  return {
    tipo,
    motivo,
    ubicacion: texto("ubicacion", 40) || "A definir",
    tamano: texto("tamano", 20) || "A definir",
    hilo: texto("hilo", 20) || "A definir",
  };
}
