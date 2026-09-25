import type { Product } from "./types";
import {
  CATEGORIAS,
  ORDEN_SECCIONES,
  claveMolde,
  labelCategoria,
  labelMolde,
} from "./constants";

/**
 * Cómo se arma la vitrina.
 *
 * En la base, cada color es un producto: "Gorra Niño" verde, "Gorra Niño"
 * roja, "Gorra Niño" azul. Eso está bien para el stock —cada color se compra y
 * se cuenta por separado— pero es un desastre en la tienda: cuatro tarjetas
 * idénticas una al lado de la otra, y el catálogo entero se siente repetido.
 *
 * Acá los productos que son el mismo modelo se juntan en una sola tarjeta con
 * sus colores adentro. Y los modelos se reparten en secciones (Buzos, Remeras,
 * Gorras, Pilusos, Sombreros) para que entrar a la tienda sea entrar a algo
 * ordenado y no a una pila.
 */

/** Un color de un modelo, con el producto concreto al que lleva. */
export type ColorDeModelo = {
  nombre: string;
  /** El producto que hay que abrir para comprar ese color. */
  productId: string;
  imagen?: string;
  hayStock: boolean;
};

/** Un modelo: todos los productos que son la misma prenda en distinto color. */
export type Modelo = {
  clave: string;
  nombre: string;
  categoria: string;
  familia: string;
  molde: string;
  /** El producto que se muestra por defecto (el primero con stock y foto). */
  principal: Product;
  colores: ColorDeModelo[];
  precioMin: number;
  precioMax: number;
  hayStock: boolean;
  /** Lo último cargado del modelo, para poder ordenar por novedades. */
  creado: string;
};

/** Un bloque del catálogo con su título ("Gorras", "Buzos", …). */
export type SeccionCatalogo = {
  clave: string;
  titulo: string;
  modelos: Modelo[];
};

/** Dos productos son el mismo modelo si comparten rubro y nombre. */
function claveDeModelo(p: Product): string {
  return `${p.categoria}|${claveMolde(p.nombre)}`;
}

/**
 * Junta los productos en modelos, respetando el orden en que vinieron.
 *
 * El orden de entrada manda: si la consulta los trajo por precio, los modelos
 * salen por precio. Lo único que se decide acá es qué producto queda como cara
 * visible del modelo.
 */
export function agruparModelos(products: Product[]): Modelo[] {
  const porClave = new Map<string, Product[]>();

  for (const p of products) {
    const k = claveDeModelo(p);
    const actual = porClave.get(k);
    if (actual) actual.push(p);
    else porClave.set(k, [p]);
  }

  return [...porClave.entries()].map(([clave, grupo]) => {
    // La cara del modelo: se prefiere uno con stock, y entre esos, uno con
    // foto. Abrir la tienda y ver la tarjeta agotada de un modelo que sí
    // tenés en otros tres colores es el peor primer plano posible.
    const principal =
      grupo.find((p) => p.stock > 0 && p.imagenes?.length) ??
      grupo.find((p) => p.stock > 0) ??
      grupo.find((p) => p.imagenes?.length) ??
      grupo[0];

    // Un producto puede traer más de un color en su propio array; cada uno
    // entra como una opción, sin repetir los que ya estén.
    const colores: ColorDeModelo[] = [];
    const vistos = new Set<string>();
    for (const p of grupo) {
      for (const c of p.colores ?? []) {
        const k = claveMolde(c);
        if (!c || vistos.has(k)) continue;
        vistos.add(k);
        colores.push({
          nombre: c,
          productId: p.id,
          imagen: p.imagenes?.[0],
          hayStock: p.stock > 0,
        });
      }
    }

    const precios = grupo.map((p) => Number(p.precio) || 0);

    return {
      clave,
      nombre: principal.nombre,
      categoria: principal.categoria,
      // El rubro sale del producto que más completo esté cargado: si uno de
      // los colores quedó sin clasificar, el modelo no se cae de su sección
      // por culpa de ese.
      familia: grupo.find((p) => p.familia?.trim())?.familia ?? "",
      molde: grupo.find((p) => p.molde?.trim())?.molde ?? "",
      principal,
      colores,
      precioMin: Math.min(...precios),
      precioMax: Math.max(...precios),
      hayStock: grupo.some((p) => p.stock > 0),
      creado: grupo
        .map((p) => p.created_at)
        .sort()
        .at(-1)!,
    };
  });
}

/** A qué sección va un modelo: su familia si la usa, si no su categoría. */
function claveDeSeccion(m: Modelo): string {
  return m.familia?.trim() ? m.familia.trim() : m.categoria;
}

function tituloDeSeccion(clave: string): string {
  // Una categoría ("gorra") es un valor de base y tiene su etiqueta; una
  // familia ("Pilusos") ya viene escrita tal como se muestra.
  const esCategoria = CATEGORIAS.some((c) => c.value === clave);
  return esCategoria ? labelCategoria(clave) : labelMolde(clave);
}

/**
 * Reparte los modelos en las secciones del catálogo, en el orden en que se
 * quiere que se recorra la tienda.
 *
 * Adentro de cada sección los modelos van por tipo (todas las trucker juntas,
 * después las baseball) y, dentro del tipo, alfabético. Lo que está sin
 * clasificar cae al final del bloque en vez de mezclarse en el medio.
 */
export function agruparEnSecciones(modelos: Modelo[]): SeccionCatalogo[] {
  const porSeccion = new Map<string, Modelo[]>();

  for (const m of modelos) {
    const k = claveDeSeccion(m);
    const actual = porSeccion.get(k);
    if (actual) actual.push(m);
    else porSeccion.set(k, [m]);
  }

  const posicion = (clave: string) => {
    const i = ORDEN_SECCIONES.indexOf(clave);
    return i === -1 ? ORDEN_SECCIONES.length : i;
  };

  return [...porSeccion.entries()]
    .sort(([a], [b]) => {
      const d = posicion(a) - posicion(b);
      return d !== 0 ? d : tituloDeSeccion(a).localeCompare(tituloDeSeccion(b), "es");
    })
    .map(([clave, lista]) => ({
      clave,
      titulo: tituloDeSeccion(clave),
      modelos: [...lista].sort((a, b) => {
        // Sin tipo al final: es un pendiente de carga, no un grupo.
        const ka = claveMolde(a.molde);
        const kb = claveMolde(b.molde);
        if (!ka !== !kb) return ka ? -1 : 1;
        if (ka !== kb) return ka.localeCompare(kb, "es");
        return a.nombre.localeCompare(b.nombre, "es");
      }),
    }));
}

/**
 * Cómo se nombra un producto en una lista para elegir.
 *
 * El nombre solo no alcanza: como cada color es un producto aparte, un
 * desplegable termina con seis "Gorra Vintage" seguidas y no hay forma de
 * saber cuál es cuál. El color es lo que las distingue, así que va en la
 * etiqueta: "Gorra Vintage · Negro".
 */
export function etiquetaProducto(p: {
  nombre: string;
  colores?: string[] | null;
}): string {
  const colores = (p.colores ?? []).filter(Boolean);
  return colores.length ? `${p.nombre} · ${colores.join(" / ")}` : p.nombre;
}
