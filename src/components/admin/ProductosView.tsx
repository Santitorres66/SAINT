"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product, ProductVariante } from "@/lib/types";
import {
  CATEGORIAS,
  claveMolde,
  formatPrecio,
  labelCategoria,
  labelMolde,
} from "@/lib/constants";
import {
  actualizarPrecios,
  deleteProduct,
  toggleActivo,
  registrarPerdida,
} from "@/app/admin/actions";

type Orden = "precio_desc" | "precio_asc" | "nombre" | "stock_asc";

/** Un subgrupo dentro de una categoría: "Oversize", "Trucker"… */
type Grupo = {
  /** Clave estable para plegar/desplegar y para el precio por bloque. */
  clave: string;
  /** El molde tal como se muestra. */
  molde: string;
  productos: Product[];
  unidades: number;
  valorizado: number;
};

/** Un bloque del listado: una categoría con sus subgrupos. */
type Bloque = {
  categoria: string;
  grupos: Grupo[];
  cantidad: number;
  unidades: number;
  valorizado: number;
};

export default function ProductosView({
  products,
  variantes,
}: {
  products: Product[];
  variantes: ProductVariante[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<Product | null>(null);
  const [perdidaDe, setPerdidaDe] = useState<Product | null>(null);

  const [busca, setBusca] = useState("");
  const [fProducto, setFProducto] = useState("");
  const [fColor, setFColor] = useState("");
  const [fTalle, setFTalle] = useState("");
  const [orden, setOrden] = useState<Orden>("precio_desc");

  /* Qué está desplegado. Las categorías arrancan abiertas (se ven los
     subgrupos y sus totales) y los subgrupos cerrados: así la pantalla entra
     de un vistazo en vez de ser la lista de 39 filas de siempre. */
  const [catCerradas, setCatCerradas] = useState<Set<string>>(new Set());
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set());

  /** Precio que se está editando en una fila. */
  const [editando, setEditando] = useState<{ id: string; valor: string } | null>(
    null,
  );
  /** Precio que se está por aplicar a todo un subgrupo. */
  const [precioGrupo, setPrecioGrupo] = useState<{
    clave: string;
    valor: string;
  } | null>(null);

  const variantesPorProd = useMemo(() => {
    const m = new Map<string, ProductVariante[]>();
    variantes.forEach((v) => {
      const a = m.get(v.product_id) ?? [];
      a.push(v);
      m.set(v.product_id, a);
    });
    return m;
  }, [variantes]);

  const productosUnicos = [...new Set(products.map((p) => p.nombre))].sort();
  const coloresUnicos = [...new Set(products.flatMap((p) => p.colores))].sort();
  const tallesUnicos = [...new Set(products.flatMap((p) => p.talles))].sort();

  const filtrados = useMemo(() => {
    const r = products.filter((p) => {
      if (busca && !p.nombre.toLowerCase().includes(busca.toLowerCase()))
        return false;
      if (fProducto && p.nombre !== fProducto) return false;
      if (fColor && !p.colores.includes(fColor)) return false;
      if (fTalle && !p.talles.includes(fTalle)) return false;
      return true;
    });
    return r.sort((a, b) =>
      orden === "precio_desc"
        ? b.precio - a.precio
        : orden === "precio_asc"
          ? a.precio - b.precio
          : orden === "stock_asc"
            ? a.stock - b.stock
            : a.nombre.localeCompare(b.nombre),
    );
  }, [products, busca, fProducto, fColor, fTalle, orden]);

  const hayFiltros = Boolean(busca || fProducto || fColor || fTalle);

  // Stock a mostrar según los filtros: si filtrás color/talle, muestra el
  // stock de esa variante; si no, el total del producto.
  function stockMostrado(p: Product): number {
    if (!fColor && !fTalle) return p.stock;
    const vs = variantesPorProd.get(p.id) ?? [];
    return vs
      .filter(
        (v) =>
          (!fColor || v.color === fColor) && (!fTalle || v.talle === fTalle),
      )
      .reduce((a, v) => a + v.stock, 0);
  }

  const valorVenta = filtrados.reduce(
    (a, p) => a + stockMostrado(p) * p.precio,
    0,
  );
  const valorCosto = filtrados.reduce(
    (a, p) => a + stockMostrado(p) * (p.costo || 0),
    0,
  );
  const unidades = filtrados.reduce((a, p) => a + stockMostrado(p), 0);

  /* --- El listado, armado por bloques ---
     Las categorías salen en el orden de CATEGORIAS (el mismo del resto del
     admin y de la tienda) y no por cantidad: que un bloque cambie de lugar
     porque cargaste un producto es peor que verlo siempre donde estaba. */
  const bloques = useMemo<Bloque[]>(() => {
    const porCategoria = new Map<string, Product[]>();
    for (const p of filtrados) {
      const a = porCategoria.get(p.categoria) ?? [];
      a.push(p);
      porCategoria.set(p.categoria, a);
    }

    const orden = CATEGORIAS.map((c) => c.value as string);
    const categorias = [
      ...orden.filter((c) => porCategoria.has(c)),
      // Cualquier categoría que no esté en la lista igual tiene que verse.
      ...[...porCategoria.keys()].filter((c) => !orden.includes(c)).sort(),
    ];

    return categorias.map((categoria) => {
      const items = porCategoria.get(categoria) ?? [];

      const porMolde = new Map<string, Product[]>();
      for (const p of items) {
        const k = claveMolde(p.molde) || "otros";
        const a = porMolde.get(k) ?? [];
        a.push(p);
        porMolde.set(k, a);
      }

      const grupos: Grupo[] = [...porMolde.entries()]
        .map(([k, ps]) => ({
          clave: `${categoria}:${k}`,
          molde: labelMolde(ps[0].molde),
          productos: ps,
          unidades: ps.reduce((a, p) => a + stockMostrado(p), 0),
          valorizado: ps.reduce((a, p) => a + stockMostrado(p) * p.precio, 0),
        }))
        .sort((a, b) => a.molde.localeCompare(b.molde, "es"));

      return {
        categoria,
        grupos,
        cantidad: items.length,
        unidades: grupos.reduce((a, g) => a + g.unidades, 0),
        valorizado: grupos.reduce((a, g) => a + g.valorizado, 0),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, fColor, fTalle, variantesPorProd]);

  const todasLasClaves = bloques.flatMap((b) => b.grupos.map((g) => g.clave));
  // Con filtros puestos se abre todo: esconder lo que la búsqueda encontró
  // sería justo lo contrario de buscar.
  const grupoAbierto = (clave: string) =>
    hayFiltros || gruposAbiertos.has(clave);
  const categoriaAbierta = (cat: string) =>
    hayFiltros || !catCerradas.has(cat);
  const todoAbierto = todasLasClaves.every((c) => grupoAbierto(c));

  function alternarGrupo(clave: string) {
    setGruposAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }
  function alternarCategoria(cat: string) {
    setCatCerradas((prev) => {
      const s = new Set(prev);
      if (s.has(cat)) s.delete(cat);
      else s.add(cat);
      return s;
    });
  }

  /* --- Precios --- */

  function guardarPrecioFila(p: Product, valor: string) {
    setEditando(null);
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) {
      setError("El precio tiene que ser un número de 0 para arriba.");
      return;
    }
    if (n === p.precio) return; // No se cambió nada: no hay nada que guardar.
    setError(null);
    startTransition(async () => {
      const res = await actualizarPrecios([p.id], n);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function aplicarPrecioGrupo(g: Grupo) {
    const n = Number(precioGrupo?.valor);
    if (!Number.isFinite(n) || n < 0) {
      setError("El precio tiene que ser un número de 0 para arriba.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await actualizarPrecios(
        g.productos.map((p) => p.id),
        n,
      );
      if (res?.error) setError(res.error);
      else {
        setPrecioGrupo(null);
        router.refresh();
      }
    });
  }

  function cambiarActivo(p: Product) {
    setError(null);
    startTransition(async () => {
      const res = await toggleActivo(p.id, !p.activo);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }
  function confirmarBorrado() {
    if (!aBorrar) return;
    const id = aBorrar.id;
    setError(null);
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (res?.error) setError(res.error);
      else {
        setABorrar(null);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {/* Resumen de valorización */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Stock valorizado (venta)</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatPrecio(valorVenta)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Valorizado a costo</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {formatPrecio(valorCosto)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Unidades en stock</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {unidades}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar producto…"
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        />
        <select
          value={fProducto}
          onChange={(e) => setFProducto(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="">Todos los productos</option>
          {productosUnicos.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={fColor}
          onChange={(e) => setFColor(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="">Todos los colores</option>
          {coloresUnicos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={fTalle}
          onChange={(e) => setFTalle(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="">Todos los talles</option>
          {tallesUnicos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
        >
          <option value="precio_desc">Precio: mayor a menor</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="stock_asc">Menos stock primero</option>
          <option value="nombre">Nombre (A-Z)</option>
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setFProducto("");
              setFColor("");
              setFTalle("");
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Ayuda + abrir/cerrar todo */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {hayFiltros
            ? "Mostrando todo lo que coincide con los filtros."
            : "Tocá un tipo para ver sus productos. El precio se edita en la tabla."}
        </p>
        {!hayFiltros && todasLasClaves.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setGruposAbiertos(
                todoAbierto ? new Set() : new Set(todasLasClaves),
              )
            }
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            {todoAbierto ? "Contraer todo" : "Expandir todo"}
          </button>
        )}
      </div>

      {/* Bloques */}
      {bloques.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center text-sm text-neutral-500">
          No hay productos con esos filtros.
        </p>
      ) : (
        <div className="space-y-4">
          {bloques.map((b) => (
            <section
              key={b.categoria}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
            >
              {/* Cabecera de la categoría */}
              <button
                type="button"
                onClick={() => alternarCategoria(b.categoria)}
                aria-expanded={categoriaAbierta(b.categoria)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-neutral-50"
              >
                <span className="flex items-center gap-2">
                  <Chevron abierto={categoriaAbierta(b.categoria)} />
                  <span className="text-base font-semibold text-neutral-900">
                    {labelCategoria(b.categoria)}
                  </span>
                  <span className="text-sm text-neutral-400">
                    {b.cantidad} {b.cantidad === 1 ? "producto" : "productos"}
                  </span>
                </span>
                <span className="text-sm text-neutral-500">
                  {b.unidades} u. ·{" "}
                  <strong className="font-semibold text-neutral-900">
                    {formatPrecio(b.valorizado)}
                  </strong>
                </span>
              </button>

              {categoriaAbierta(b.categoria) && (
                <div className="border-t border-neutral-100">
                  {b.grupos.map((g) => (
                    <div
                      key={g.clave}
                      className="border-b border-neutral-100 last:border-b-0"
                    >
                      {/* Cabecera del subgrupo */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50/60 px-5 py-2.5">
                        <button
                          type="button"
                          onClick={() => alternarGrupo(g.clave)}
                          aria-expanded={grupoAbierto(g.clave)}
                          className="flex items-center gap-2 text-left"
                        >
                          <Chevron abierto={grupoAbierto(g.clave)} chico />
                          <span className="text-sm font-medium text-neutral-800">
                            {g.molde}
                          </span>
                          <span className="text-xs text-neutral-400">
                            ({g.productos.length})
                          </span>
                        </button>

                        <div className="flex items-center gap-4">
                          <span className="text-xs text-neutral-500">
                            {g.unidades} u. · {formatPrecio(g.valorizado)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPrecioGrupo(
                                precioGrupo?.clave === g.clave
                                  ? null
                                  : {
                                      clave: g.clave,
                                      // Arranca con el precio que ya comparten,
                                      // que es el caso normal.
                                      valor: String(g.productos[0].precio),
                                    },
                              )
                            }
                            className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                          >
                            Precio del grupo
                          </button>
                        </div>
                      </div>

                      {/* Cambiar el precio de todo el subgrupo */}
                      {precioGrupo?.clave === g.clave && (
                        <div className="flex flex-wrap items-center gap-3 border-y border-amber-200 bg-amber-50 px-5 py-3">
                          <label className="text-sm text-amber-900">
                            Nuevo precio para {g.productos.length}{" "}
                            {g.productos.length === 1 ? "producto" : "productos"}{" "}
                            de {labelCategoria(b.categoria)} · {g.molde}
                          </label>
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="1"
                            value={precioGrupo.valor}
                            onChange={(e) =>
                              setPrecioGrupo({
                                clave: g.clave,
                                valor: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") aplicarPrecioGrupo(g);
                              if (e.key === "Escape") setPrecioGrupo(null);
                            }}
                            className="w-36 rounded-lg border border-amber-300 px-3 py-1.5 text-sm outline-none focus:border-amber-600"
                          />
                          <button
                            type="button"
                            onClick={() => aplicarPrecioGrupo(g)}
                            disabled={pending}
                            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                          >
                            {pending ? "Aplicando…" : "Aplicar a todos"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrecioGrupo(null)}
                            className="text-sm font-medium text-amber-900 underline underline-offset-2"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Productos del subgrupo */}
                      {grupoAbierto(g.clave) && (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[820px] text-sm">
                            <thead>
                              <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                <th className="px-5 py-2 font-medium">
                                  Producto
                                </th>
                                <th className="px-4 py-2 font-medium">Color</th>
                                <th className="px-4 py-2 font-medium">Talles</th>
                                <th className="px-4 py-2 text-right font-medium">
                                  Precio
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                  Stock
                                </th>
                                <th className="px-4 py-2 text-right font-medium">
                                  Valorizado
                                </th>
                                <th className="px-4 py-2 font-medium">Estado</th>
                                <th className="px-4 py-2 text-right font-medium">
                                  Acciones
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {g.productos.map((p) => (
                                <tr key={p.id}>
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                                        {p.imagenes?.[0] ? (
                                          <Image
                                            src={p.imagenes[0]}
                                            alt={p.nombre}
                                            fill
                                            sizes="40px"
                                            className="object-cover"
                                          />
                                        ) : null}
                                      </div>
                                      <p className="font-medium text-neutral-900">
                                        {p.nombre}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-neutral-700">
                                    {p.colores.join(", ") || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-700">
                                    {p.talles.join(", ") || "—"}
                                  </td>

                                  {/* Precio editable en la fila */}
                                  <td className="px-4 py-3 text-right">
                                    {editando?.id === p.id ? (
                                      <input
                                        autoFocus
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={editando.valor}
                                        onChange={(e) =>
                                          setEditando({
                                            id: p.id,
                                            valor: e.target.value,
                                          })
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            guardarPrecioFila(
                                              p,
                                              editando.valor,
                                            );
                                          if (e.key === "Escape")
                                            setEditando(null);
                                        }}
                                        onBlur={() =>
                                          guardarPrecioFila(p, editando.valor)
                                        }
                                        className="w-28 rounded-lg border border-neutral-900 px-2 py-1 text-right text-sm outline-none"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditando({
                                            id: p.id,
                                            valor: String(p.precio),
                                          })
                                        }
                                        title="Tocá para cambiar el precio"
                                        className="rounded-lg border border-transparent px-2 py-1 text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                                      >
                                        {formatPrecio(p.precio)}
                                      </button>
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-right text-neutral-700">
                                    {stockMostrado(p)}
                                    {hayFiltros &&
                                      stockMostrado(p) !== p.stock && (
                                        <span className="ml-1 text-xs text-neutral-400">
                                          (de {p.stock})
                                        </span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-neutral-900">
                                    {formatPrecio(stockMostrado(p) * p.precio)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => cambiarActivo(p)}
                                      disabled={pending}
                                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                                        p.activo
                                          ? "bg-green-100 text-green-800"
                                          : "bg-neutral-100 text-neutral-500"
                                      }`}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${p.activo ? "bg-green-500" : "bg-neutral-400"}`}
                                      />
                                      {p.activo ? "Visible" : "Oculto"}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1.5">
                                      <Link
                                        href={`/admin/editar/${p.id}`}
                                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
                                      >
                                        Editar
                                      </Link>
                                      <button
                                        onClick={() => setPerdidaDe(p)}
                                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
                                      >
                                        Pérdida
                                      </button>
                                      <button
                                        onClick={() => setABorrar(p)}
                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Modal eliminar */}
      {aBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h3 className="text-xl font-semibold text-neutral-900">
              ¿Eliminar este producto?
            </h3>
            <p className="mt-2 text-neutral-600">
              Estás por eliminar <strong>{aBorrar.nombre}</strong>. No se puede
              deshacer.
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setABorrar(null)}
                disabled={pending}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                disabled={pending}
                className="rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pérdida */}
      {perdidaDe && (
        <PerdidaModal
          product={perdidaDe}
          variantes={variantesPorProd.get(perdidaDe.id) ?? []}
          onClose={() => setPerdidaDe(null)}
          onDone={() => {
            setPerdidaDe(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** La flechita de plegar/desplegar. */
function Chevron({ abierto, chico }: { abierto: boolean; chico?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block text-neutral-400 transition-transform ${
        chico ? "text-[10px]" : "text-xs"
      } ${abierto ? "rotate-90" : ""}`}
    >
      ▶
    </span>
  );
}

/* ------------------------- Modal de pérdida ------------------------- */
function PerdidaModal({
  product,
  variantes,
  onClose,
  onDone,
}: {
  product: Product;
  variantes: ProductVariante[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [varKey, setVarKey] = useState(
    variantes[0] ? `${variantes[0].talle}|${variantes[0].color}` : "",
  );
  const [cantidad, setCantidad] = useState("1");

  const seleccion = variantes.find((v) => `${v.talle}|${v.color}` === varKey);
  const maxCant = seleccion?.stock ?? 0;

  function registrar() {
    if (!seleccion) {
      setError("Elegí una variante.");
      return;
    }
    const cant = Math.min(Number(cantidad) || 0, maxCant);
    if (cant <= 0) {
      setError("Cantidad inválida.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await registrarPerdida(
        product.id,
        seleccion.talle,
        seleccion.color,
        cant,
      );
      if (res?.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h3 className="text-xl font-semibold text-neutral-900">
          Registrar pérdida
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          {product.nombre} · descuenta stock por rotura, robo o defecto.
        </p>

        {variantes.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            Este producto no tiene variantes con stock cargado.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Talle / color
              </label>
              <select
                value={varKey}
                onChange={(e) => setVarKey(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
              >
                {variantes.map((v) => (
                  <option key={`${v.talle}|${v.color}`} value={`${v.talle}|${v.color}`}>
                    {[v.talle, v.color].filter(Boolean).join(" · ") || "General"}{" "}
                    (stock {v.stock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                Cantidad a descontar (máx. {maxCant})
              </label>
              <input
                type="number"
                min="1"
                max={maxCant}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={registrar}
            disabled={pending || variantes.length === 0}
            className="rounded-lg bg-amber-600 px-5 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Registrando…" : "Registrar pérdida"}
          </button>
        </div>
      </div>
    </div>
  );
}
