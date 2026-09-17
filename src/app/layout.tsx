import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { accountsConfigured } from "@/lib/subscription";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://1ermillondedolares.com"),
  title: "1er Millón de Dólares",
  description:
    "Plataforma de análisis, señales y educación en trading — gráficos en vivo, herramientas de estudio y clases con el profesor Miguel Cortés.",
};

// Tokens de marca (ver docs/ARQUITECTURA.md) para que los componentes de
// Clerk (modal de login, /sign-in, /sign-up, "Manage account") no se vean
// fuera de lugar.
//
// `baseTheme: dark` es la pieza que faltaba (17 sept. 2026): sin ella,
// Clerk parte de sus valores por defecto pensados para fondo blanco —
// nuestras `variables` solo pisaban un puñado de colores, y el resto (como
// los títulos del modal "Manage account") se quedaban con texto casi negro
// sobre nuestro fondo oscuro, prácticamente invisible. Con el tema oscuro
// de base, esos valores por defecto también quedan pensados para fondo
// oscuro, y nuestras variables de marca se aplican encima sin problema.
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#D4AF37",
    colorBackground: "#131722",
    colorInputBackground: "#0B0E14",
    colorText: "#E0E0E0",
    colorTextSecondary: "#9AA1AE",
    colorInputText: "#E0E0E0",
    borderRadius: "0.5rem",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const body = (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );

  // Mismo criterio que en todo el proyecto: sin llaves, no se envuelve con
  // Clerk — el sitio sigue sirviendo la parte gratuita sin caerse.
  return accountsConfigured() ? (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      {body}
    </ClerkProvider>
  ) : (
    body
  );
}
