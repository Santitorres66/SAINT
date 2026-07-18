/** @type {import('next').NextConfig} */

// Derivamos el host de Supabase desde la variable de entorno para poder mostrar
// las imágenes del Storage con <Image> de Next. Si no está definida, usamos un
// fallback para que el build no rompa.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return "pydaguoekpctkyymsyjd.supabase.co";
  }
})();

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
