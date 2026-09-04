import type { Categoria, EstadoProduccion, Molde } from "./types";

/** Categorías con etiqueta legible (para selects y filtros). */
export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "buzo", label: "Buzos" },
  { value: "remera", label: "Remeras" },
  { value: "crop", label: "Crops" },
  { value: "canguro", label: "Canguros" },
  { value: "gorra", label: "Gorras" },
];

/** Moldes con etiqueta legible (para el select del admin). */
export const MOLDES: { value: Molde; label: string }[] = [
  { value: "oversize", label: "Oversize" },
  { value: "basica", label: "Básica" },
];

/** El molde de lo que ya estaba cargado antes de que existiera el campo. */
export const MOLDE_POR_DEFECTO: Molde = "oversize";

/**
 * Categorías donde el molde cambia las medidas y hay que elegirlo. En el resto
 * (buzos, canguros, gorras) hay un solo molde, así que el selector no aparece.
 */
export const CATEGORIAS_CON_MOLDE: string[] = ["remera", "crop"];

/** Devuelve la etiqueta legible de un molde. */
export function labelMolde(value: string): string {
  return MOLDES.find((m) => m.value === value)?.label ?? value;
}

/** Categoría de los ítems que no se pueden clasificar. */
export const CATEGORIA_OTROS = "otros";

/** Devuelve la etiqueta legible de una categoría. */
export function labelCategoria(value: string): string {
  if (value === CATEGORIA_OTROS) return "Otros";
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

/**
 * A qué categoría pertenece un ítem vendido.
 *
 * Los ítems de una venta no guardan la categoría (vive en `products`), así que
 * se resuelve por `product_id`. Las ventas manuales pueden tener ítems escritos
 * a mano, sin producto: para esos se mira el nombre, y si no dice nada quedan
 * en "Otros" antes que en una categoría equivocada.
 */
export function categoriaDeItem(
  item: { product_id?: string | null; nombre?: string },
  categoriaPorProducto: Record<string, string>,
): string {
  if (item.product_id && categoriaPorProducto[item.product_id])
    return categoriaPorProducto[item.product_id];

  const nombre = (item.nombre ?? "").toLowerCase();
  const porNombre = CATEGORIAS.find((c) => nombre.includes(c.value));
  return porNombre?.value ?? CATEGORIA_OTROS;
}

/** Talles sugeridos en el admin (se pueden agregar otros a mano). */
export const TALLES_SUGERIDOS = ["XS", "S", "M", "L", "XL", "XXL", "Único"];

/**
 * Orden en que se muestran los talles.
 *
 * Ordenar alfabéticamente pondría "L" antes que "M" y "S", que es justo al
 * revés de como se lee un talle. Los numéricos (12, 14, 16, 18) van primero y
 * en orden numérico; después los de letra en su orden natural; y al final
 * cualquier talle raro cargado a mano, alfabético para que no quede al azar.
 */
export function ordenarTalles(talles: string[]): string[] {
  const orden = TALLES_SUGERIDOS;
  return [...talles].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aEsNum = a.trim() !== "" && !Number.isNaN(na);
    const bEsNum = b.trim() !== "" && !Number.isNaN(nb);
    if (aEsNum && bEsNum) return na - nb;
    if (aEsNum) return -1;
    if (bEsNum) return 1;

    const ia = orden.indexOf(a);
    const ib = orden.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, "es");
  });
}

/**
 * Criterios para ordenar el catálogo. El `value` viaja en la URL (?orden=),
 * así que un listado filtrado se puede compartir tal cual se ve.
 */
export const ORDENES_CATALOGO = [
  { value: "nuevo", label: "Novedades" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre: A - Z" },
] as const;

export const ORDEN_POR_DEFECTO = "nuevo";

/** Colores frecuentes sugeridos en el admin. */
export const COLORES_SUGERIDOS = [
  "Negro",
  "Blanco",
  "Gris",
  "Beige",
  "Crema",
  "Verde militar",
  "Azul",
];

/* --- Enlaces de contacto --- */
// Número de WhatsApp en formato internacional, sin +, espacios ni guiones.
// +54 9 3512 08-1452  →  5493512081452
export const WHATSAPP_NUMERO = "5493512081452";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}`;
export const INSTAGRAM_USER = "saint";
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_USER}`;

/** Arma un link de WhatsApp con un mensaje pre-escrito (opcional). */
export function whatsappLink(mensaje?: string): string {
  return mensaje
    ? `${WHATSAPP_URL}?text=${encodeURIComponent(mensaje)}`
    : WHATSAPP_URL;
}

/** Bucket de Supabase Storage donde viven las imágenes de productos. */
export const STORAGE_BUCKET = "productos";

/** Estados de una orden de producción (para el Kanban), con sus colores. */
export const ESTADOS_PRODUCCION = [
  {
    value: "pendiente",
    label: "Pendiente",
    col: "bg-amber-50 border-amber-200",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    value: "en_produccion",
    label: "En producción",
    col: "bg-blue-50 border-blue-200",
    chip: "bg-blue-100 text-blue-800",
  },
  {
    value: "fabricado",
    label: "Fabricado",
    col: "bg-green-50 border-green-200",
    chip: "bg-green-100 text-green-800",
  },
  {
    value: "entregado",
    label: "Entregado",
    col: "bg-neutral-100 border-neutral-200",
    chip: "bg-neutral-200 text-neutral-700",
  },
  {
    value: "vendido",
    label: "Vendido",
    col: "bg-purple-50 border-purple-200",
    chip: "bg-purple-100 text-purple-800",
  },
  {
    value: "cobrado",
    label: "Cobrado",
    col: "bg-emerald-50 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-800",
  },
] as const;

export function labelEstado(value: string): string {
  return ESTADOS_PRODUCCION.find((e) => e.value === value)?.label ?? value;
}

/**
 * Columnas del Kanban de producción.
 *
 * No son uno a uno con los estados: "Entregado" y "Vendido" comparten columna
 * para que el tablero entre en pantalla sin scrollear al costado. En la base
 * siguen siendo estados distintos —"vendido" lo produce la venta y de ahí sale
 * el circuito de cobro—, así que la tarjeta aclara en cuál está.
 *
 * `estados` son los que caen en la columna; `destino` es a cuál se pasa la
 * orden cuando se la suelta ahí.
 */
export const COLUMNAS_PRODUCCION: {
  id: string;
  label: string;
  /** Versión corta para el selector de la tarjeta, donde sobra poco ancho. */
  labelCorto?: string;
  estados: EstadoProduccion[];
  destino: EstadoProduccion;
  col: string;
  chip: string;
}[] = [
  {
    id: "pendiente",
    label: "Pendiente",
    estados: ["pendiente"],
    destino: "pendiente",
    col: "bg-amber-50 border-amber-200",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    id: "en_produccion",
    label: "En producción",
    estados: ["en_produccion"],
    destino: "en_produccion",
    col: "bg-blue-50 border-blue-200",
    chip: "bg-blue-100 text-blue-800",
  },
  {
    id: "fabricado",
    label: "Fabricado",
    estados: ["fabricado"],
    destino: "fabricado",
    col: "bg-green-50 border-green-200",
    chip: "bg-green-100 text-green-800",
  },
  {
    id: "entregado",
    label: "Entregado / Vendido",
    labelCorto: "Entreg./Vend.",
    estados: ["entregado", "vendido"],
    // Al soltar acá la orden queda "entregado": "vendido" se gana cargando la
    // venta, no arrastrando la tarjeta.
    destino: "entregado",
    col: "bg-neutral-100 border-neutral-200",
    chip: "bg-neutral-200 text-neutral-700",
  },
  {
    id: "cobrado",
    label: "Cobrado",
    estados: ["cobrado"],
    destino: "cobrado",
    col: "bg-emerald-50 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-800",
  },
];

/** La columna del tablero donde cae una orden según su estado. */
export function columnaDeEstado(estado: string) {
  return (
    COLUMNAS_PRODUCCION.find((c) =>
      (c.estados as string[]).includes(estado),
    ) ?? COLUMNAS_PRODUCCION[0]
  );
}

/**
 * Estados en los que la orden ya salió del taller: no tiene sentido marcarlos
 * como atrasados ni volver a descontar stock.
 */
export const ESTADOS_CERRADOS = ["entregado", "vendido", "cobrado"] as const;

/** Estado de cobro de una venta, con su etiqueta y color. */
export const ESTADOS_COBRO = [
  {
    value: "pendiente",
    label: "Pendiente de cobro",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    value: "parcial",
    label: "Cobro parcial",
    chip: "bg-blue-100 text-blue-800",
  },
  {
    value: "cobrado",
    label: "Cobrado",
    chip: "bg-emerald-100 text-emerald-800",
  },
] as const;

export function labelCobro(value: string): string {
  return ESTADOS_COBRO.find((e) => e.value === value)?.label ?? value;
}

export function chipCobro(value: string): string {
  return (
    ESTADOS_COBRO.find((e) => e.value === value)?.chip ??
    "bg-neutral-100 text-neutral-600"
  );
}

/** Prioridad de una orden de producción. Sin rojo: ese color queda reservado
 *  para marcar pedidos atrasados (ver `estaAtrasada` más abajo). */
export const PRIORIDADES_PRODUCCION = [
  { value: "alta", label: "Alta", chip: "bg-orange-100 text-orange-800" },
  { value: "media", label: "Media", chip: "bg-amber-50 text-amber-700" },
  { value: "baja", label: "Baja", chip: "bg-neutral-100 text-neutral-500" },
] as const;

export function labelPrioridad(value: string): string {
  return PRIORIDADES_PRODUCCION.find((p) => p.value === value)?.label ?? value;
}

/**
 * Una orden está "atrasada" si tiene fecha estimada de entrega, esa fecha ya
 * pasó, y todavía no se entregó. Compara por día (no por hora) para no marcar
 * atrasado el mismo día en que vence.
 */
export function estaAtrasada(
  fechaEstimadaEntrega: string | null,
  estado: string,
): boolean {
  if (
    !fechaEstimadaEntrega ||
    (ESTADOS_CERRADOS as readonly string[]).includes(estado)
  )
    return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fechaEstimadaEntrega);
  limite.setHours(0, 0, 0, 0);
  return limite < hoy;
}

/** Muestra el número de orden con formato #00025. */
export function formatNumeroOrden(n: number): string {
  return "#" + String(n).padStart(5, "0");
}

/* --- Tablas de talles (medidas de la prenda en cm) --- */
type FilaTalle = { talle: string; ancho: string; largo: string };
type TablaTalles = { titulo: string; filas: FilaTalle[] };

/**
 * Las medidas de la prenda, por familia y molde. La clave es
 * `${familia}_${molde}`: dos prendas de la misma familia calzan distinto según
 * el molde, y por eso la remera básica tiene su propia tabla.
 */
export const TABLAS_TALLES: Record<string, TablaTalles> = {
  remera_oversize: {
    titulo: "Remera Oversize",
    filas: [
      { talle: "S", ancho: "57 cm", largo: "78 cm" },
      { talle: "M", ancho: "59 cm", largo: "80 cm" },
      { talle: "L", ancho: "62 cm", largo: "82 cm" },
      { talle: "XL", ancho: "65 cm", largo: "84 cm" },
    ],
  },
  remera_basica: {
    titulo: "Remera Básica",
    filas: [
      { talle: "12", ancho: "41 cm", largo: "53 cm" },
      { talle: "14", ancho: "43 cm", largo: "55 cm" },
      { talle: "16", ancho: "45 cm", largo: "57 cm" },
      { talle: "18", ancho: "47 cm", largo: "59 cm" },
      { talle: "S", ancho: "54 cm", largo: "69 cm" },
      { talle: "M", ancho: "56 cm", largo: "73 cm" },
      { talle: "L", ancho: "59 cm", largo: "76 cm" },
      { talle: "XL", ancho: "62 cm", largo: "79 cm" },
    ],
  },
  buzo_oversize: {
    titulo: "Buzo Oversize",
    filas: [
      { talle: "S", ancho: "64 cm", largo: "73 cm" },
      { talle: "M", ancho: "67 cm", largo: "75 cm" },
      { talle: "L", ancho: "70 cm", largo: "77 cm" },
      { talle: "XL", ancho: "73 cm", largo: "79 cm" },
    ],
  },
};

/** Qué tabla comparten las categorías: los crops usan la de remera, los
 *  canguros la de buzo. Las gorras no llevan tabla (no están acá). */
const FAMILIA_DE_CATEGORIA: Record<string, string> = {
  remera: "remera",
  crop: "remera",
  buzo: "buzo",
  canguro: "buzo",
};

/**
 * Devuelve la tabla de talles de un producto según su categoría y su molde.
 *
 * Si esa familia no tiene tabla para el molde pedido (hoy: un buzo marcado como
 * básico) cae en la del molde por defecto antes que no mostrar nada.
 */
export function tablaTallesDe(
  categoria: string,
  molde: string = MOLDE_POR_DEFECTO,
): TablaTalles | null {
  const familia = FAMILIA_DE_CATEGORIA[categoria];
  if (!familia) return null;
  return (
    TABLAS_TALLES[`${familia}_${molde}`] ??
    TABLAS_TALLES[`${familia}_${MOLDE_POR_DEFECTO}`] ??
    null
  );
}

/** Formatea un precio en pesos argentinos (sin centavos). */
export function formatPrecio(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);
}
