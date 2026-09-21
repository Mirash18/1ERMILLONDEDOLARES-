import Link from "next/link";

/**
 * Botón flotante de WhatsApp que siempre está visible en la pantalla.
 * Posicionado en la esquina inferior derecha, se mantiene por encima de
 * todo contenido pero debajo de los modales (z-index 50 vs 60 del visor
 * de testimonios).
 *
 * Responsive: en móvil se reduce el tamaño ligeramente para no ocupar
 * demasiado espacio, pero se mantiene visible y fácil de tocar.
 */
export function FloatingWhatsApp() {
  return (
    <Link
      href="https://whatsapp.com/channel/0029Vb7GYKk6rsR1N5uH5Y1Z"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir canal de WhatsApp"
      className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:h-16 sm:w-16"
    >
      {/* Icono SVG de WhatsApp */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 sm:h-8 sm:w-8"
      >
        {/* Teléfono + burbuja de chat estilizado */}
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>

      {/* Pulso de animación sutil para llamar atención */}
      <span className="absolute inset-0 animate-pulse rounded-full bg-[#25D366] opacity-20" />
    </Link>
  );
}
