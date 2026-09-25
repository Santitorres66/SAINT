import type { Categoria, EstadoProduccion, Molde } from "./types";

/**
 * Categorías con etiqueta legible (para selects y filtros).
 *
 * "crop" ya no está: los crops pasaron a ser un tipo de remera. La etiqueta de
 * "gorra" dice "Gorras y sombreros" porque ahí adentro conviven gorras,
 * pilusos y sombreros; el valor guardado sigue siendo "gorra".
 */
export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "buzo", label: "Buzos" },
  { value: "remera", label: "Remeras" },
  { value: "canguro", label: "Canguros" },
  { value: "gorra", label: "Gorras y sombreros" },
];

/**
 * Familias: el nivel intermedio, cuando una categoría lo necesita.
 *
 * "Gorras y sombreros" no se divide en tipos de una: primero están las gorras,
 * los pilusos y los sombreros, y recién adentro de las gorras viven baseball,
 * trucker y compañía. Las prendas no lo necesitan (un buzo es oversize o
 * básico, y ahí termina), así que para ellas este nivel no existe y el
 * formulario ni lo muestra.
 */
export const FAMILIAS_SUGERIDAS: Record<string, string[]> = {
  gorra: ["Gorras", "Pilusos", "Sombreros"],
};

/** Las familias de una categoría. Vacío = esa categoría no usa el nivel. */
export function familiasDe(categoria: string): string[] {
  return FAMILIAS_SUGERIDAS[categoria] ?? [];
}

/** Si la categoría trabaja con familias (hoy: solo gorras y sombreros). */
export function usaFamilias(categoria: string): boolean {
  return familiasDe(categoria).length > 0;
}

/**
 * Tipos que el admin ofrece, según la categoría y —si la usa— la familia.
 *
 * Son sugerencias, no una lista cerrada: siempre se puede escribir uno nuevo.
 * Están para que el mismo modelo no termine cargado de tres formas distintas,
 * que es lo que rompe el agrupado del listado.
 *
 * La clave es `categoria` o `categoria:familia` (la familia, normalizada).
 */
export const MOLDES_SUGERIDOS: Record<string, string[]> = {
  buzo: ["Oversize", "Básico"],
  remera: ["Básica", "Oversize", "Crop"],
  canguro: ["Oversize", "Básico"],
  "gorra:gorras": ["Baseball", "Vintage", "Trucker", "Niño"],
  // Los pilusos todavía no se subdividen; cuando pase, van acá.
  "gorra:pilusos": [],
  "gorra:sombreros": ["Australiano"],
};

/** Los tipos sugeridos para una categoría (y familia, si corresponde). */
export function moldesDe(categoria: string, familia = ""): string[] {
  if (usaFamilias(categoria)) {
    return MOLDES_SUGERIDOS[`${categoria}:${claveMolde(familia)}`] ?? [];
  }
  return MOLDES_SUGERIDOS[categoria] ?? [];
}

/**
 * La clave con la que se agrupan dos moldes.
 *
 * "Oversize", "oversize" y " Oversize " son el mismo grupo: sin esto, un
 * espacio de más partiría un bloque en dos y el listado mentiría.
 */
export function claveMolde(molde: string): string {
  return (molde ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Devuelve el molde con la grafía de la sugerencia que le corresponde.
 *
 * Lo guardado de antes viene en minúscula ("oversize") y las sugerencias están
 * capitalizadas ("Oversize"). Sin esto, el select del formulario no encontraría
 * su opción y se vería vacío al editar un producto que sí tiene tipo.
 */
export function canonizarMolde(
  categoria: string,
  molde: string,
  familia = "",
): string {
  const k = claveMolde(molde);
  return moldesDe(categoria, familia).find((m) => claveMolde(m) === k) ?? molde;
}

/** Lo mismo para la familia. */
export function canonizarFamilia(categoria: string, familia: string): string {
  const k = claveMolde(familia);
  return familiasDe(categoria).find((f) => claveMolde(f) === k) ?? familia;
}

/** Lo que se muestra cuando un producto todavía no tiene tipo o familia. */
export const SIN_CLASIFICAR = "Sin clasificar";

/**
 * El molde como se muestra. Vacío no es "—" sino "Sin clasificar": es algo
 * pendiente de cargar, y el listado tiene que decirlo para que se vea.
 */
export function labelMolde(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return SIN_CLASIFICAR;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** La familia como se muestra. Misma idea que labelMolde. */
export function labelFamilia(value: string): string {
  return labelMolde(value);
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

/**
 * Qué tabla de talles comparten las categorías: los canguros miden como los
 * buzos. Las gorras no llevan tabla (no están acá).
 *
 * Ojo con el nombre: "línea" es la familia DE MEDIDAS, que no tiene nada que
 * ver con la familia del producto (Gorras / Pilusos / Sombreros).
 */
const LINEA_DE_CATEGORIA: Record<string, string> = {
  remera: "remera",
  // "crop" ya no es una categoría, pero si quedara alguno sin migrar igual
  // tiene que encontrar su tabla.
  crop: "remera",
  buzo: "buzo",
  canguro: "buzo",
};

/** El molde con el que se busca la tabla cuando el producto no tiene la suya. */
const MOLDE_TALLES_FALLBACK = "oversize";

/**
 * Devuelve la tabla de talles de un producto según su categoría y su molde.
 *
 * Si esa línea no tiene tabla para el molde pedido (un buzo "Básico", o una
 * remera sin clasificar) cae en la del molde por defecto antes que no mostrar
 * nada: una tabla aproximada ayuda más que ninguna.
 */
export function tablaTallesDe(
  categoria: string,
  molde: string = "",
): TablaTalles | null {
  const linea = LINEA_DE_CATEGORIA[categoria];
  if (!linea) return null;
  // Las tablas se indexan en minúscula y sin tildes; el molde se guarda como
  // se escribió ("Básica"), así que se normaliza antes de buscar.
  return (
    TABLAS_TALLES[`${linea}_${claveMolde(molde)}`] ??
    TABLAS_TALLES[`${linea}_${MOLDE_TALLES_FALLBACK}`] ??
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
