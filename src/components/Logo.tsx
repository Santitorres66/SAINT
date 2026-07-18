import Link from "next/link";

type LogoProps = {
  /** Muestra la línea fina y el tagline debajo del nombre. */
  tagline?: boolean;
  /** Tamaño del nombre. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Si true, envuelve el logo en un link a la home. */
  asLink?: boolean;
  className?: string;
};

const sizes = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
  xl: "text-6xl sm:text-7xl md:text-8xl",
};

/**
 * Logo de SAINT: la palabra en serif con mucho espaciado entre letras,
 * una línea fina debajo y el tagline en itálica.
 */
export default function Logo({
  tagline = false,
  size = "md",
  asLink = false,
  className = "",
}: LogoProps) {
  const contenido = (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <span className={`brand leading-none ${sizes[size]}`}>SAINT</span>
      {tagline && (
        <>
          <span className="hairline my-3 max-w-[8rem]" />
          <span className="font-serif text-sm italic tracking-wide text-saint-gray">
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
