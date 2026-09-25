import Link from "next/link";

type LogoProps = {
  /** Muestra la línea fina y el tagline debajo del nombre. */
  tagline?: boolean;
  /** Tamaño del nombre. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Si true, envuelve el logo en un link a la home. */
  asLink?: boolean;
  /**
   * Entra letra por letra al cargar la página. Solo para el hero: en la barra
   * de navegación, que está en todas las pantallas, el logo tiene que estar
   * quieto y ya escrito.
   */
  animado?: boolean;
  className?: string;
};

const sizes = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
  xl: "text-6xl sm:text-7xl md:text-8xl",
};

const LETRAS = ["S", "A", "I", "N", "T"];

/**
 * Logo de SAINT: la palabra en serif con mucho espaciado entre letras,
 * una línea fina debajo y el tagline en itálica.
 *
 * Animado, las letras llegan de a una y desenfocadas: el nombre se escribe
 * solo, como se borda —punto por punto— y no como se imprime.
 */
export default function Logo({
  tagline = false,
  size = "md",
  asLink = false,
  animado = false,
  className = "",
}: LogoProps) {
  const contenido = (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <span className={`brand leading-none ${sizes[size]}`} aria-label="SAINT">
        {animado ? (
          LETRAS.map((letra, i) => (
            <span
              key={letra}
              aria-hidden
              className="anim-letra"
              // 140 ms entre letras: alcanza para leerlas de a una sin que la
              // palabra tarde en estar entera.
              style={{ ["--d" as string]: `${i * 140}ms` }}
            >
              {letra}
            </span>
          ))
        ) : (
          <>SAINT</>
        )}
      </span>

      {tagline && (
        <>
          <span
            className={`hairline my-3 max-w-[8rem] ${animado ? "anim-linea" : ""}`}
            style={animado ? { ["--d" as string]: "820ms" } : undefined}
          />
          <span
            className={`font-serif text-sm italic tracking-wide text-saint-gray ${
              animado ? "anim-aparece" : ""
            }`}
            style={animado ? { ["--d" as string]: "1000ms" } : undefined}
          >
            lo sagrado en lo cotidiano
          </span>
        </>
      )}
    </span>
  );

  if (asLink) {
    return (
      <Link href="/" aria-label="SAINT — inicio">
        {contenido}
      </Link>
    );
  }
  return contenido;
}
