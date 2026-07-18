/**
 * Sección editorial que explica el concepto del bordado personalizado.
 * Mucho aire, tipografía serif, tono sobrio.
 */
export default function ConceptSection() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-28 text-center">
      <p className="mb-6 text-[11px] uppercase tracking-wide2 text-saint-gray">
        El detalle que lo cambia todo
      </p>

      <h2 className="font-serif text-3xl font-light leading-snug sm:text-4xl md:text-5xl">
        Un básico se vuelve sagrado
        <br className="hidden sm:block" /> cuando lleva algo tuyo.
      </h2>

      <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-saint-gray">
        Cada prenda de SAINT nace simple y de calidad. La volvés única a través
        del <span className="text-saint-white">bordado personalizado</span>: tu
        personaje favorito, tu mascota, un símbolo que solo vos entendés. No es
        una estampa más — es artesanía urbana pensada para durar y para
        significar.
      </p>

      <div className="mt-16 grid gap-10 sm:grid-cols-3">
        {[
          {
            titulo: "Exclusividad real",
            texto:
              "Cada bordado es distinto. No hacemos dos piezas iguales: lo tuyo es solo tuyo.",
          },
          {
            titulo: "Elegancia simple",
            texto:
              "Prendas sobrias, sin género, que combinan con todo y no pasan de moda.",
          },
          {
            titulo: "Identidad propia",
            texto:
              "Vos elegís qué llevar bordado. Lo cotidiano se vuelve sagrado.",
          },
        ].map((item) => (
          <div key={item.titulo} className="space-y-3">
            <span className="hairline mx-auto max-w-[3rem]" />
            <h3 className="font-serif text-xl">{item.titulo}</h3>
            <p className="text-sm leading-relaxed text-saint-gray">
              {item.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
