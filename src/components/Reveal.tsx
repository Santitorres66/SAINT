"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hace que una pieza entre (suba y se revele) cuando asoma en pantalla.
 *
 * Se anima una sola vez: volver a subir con el scroll no tiene que repetir el
 * número. Y si el navegador no soporta IntersectionObserver, el contenido se
 * muestra igual en vez de quedar invisible para siempre — una animación que
 * falla nunca puede esconder la tienda.
 */
export default function Reveal({
  children,
  /** Milisegundos de espera. Sirve para escalonar una fila de tarjetas. */
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVisible(true);
        obs.disconnect();
      },
      // Se dispara un poco antes de que la pieza toque el borde: así termina
      // de entrar justo cuando el ojo llega, y no después.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ ["--d" as string]: `${delay}ms` }}
      className={`reveal ${visible ? "es-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
