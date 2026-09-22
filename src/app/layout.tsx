import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { accountsConfigured } from "@/lib/subscription";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
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
// `baseTheme: dark` (17 sept. 2026) para que todo lo que no se pisa abajo
// (colorDanger, colorSuccess, colorNeutral...) ya parta pensado para fondo
// oscuro. Pero el problema real de fondo era otro: Clerk Core 3 renombró
// las variables de texto (`colorText` → `colorForeground`,
// `colorTextSecondary` → `colorMutedForeground`, `colorInputText` →
// `colorInputForeground`, `colorInputBackground` → `colorInput`) — la
// documentación dice que los nombres viejos siguen funcionando como alias,
// pero en la práctica no se estaban aplicando: el título del modal
// "Manage account" se pintaba en `rgb(33,33,38)` (el valor por defecto
// para fondo BLANCO) porque `--clerk-color-foreground` nunca se llenaba.
// Con los nombres nuevos sí se aplica.
// `elements` (además de `variables`): Alejo reportó que en el menú del
// usuario (UserButton) los textos "Manage account" y "Sign out" salían
// casi invisibles — gris oscuro sobre fondo oscuro. Las variables por sí
// solas no los estaban aclarando, así que se fuerzan esos elementos
// puntuales a texto claro e íconos en dorado de marca.
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#D4AF37",
    colorPrimaryForeground: "#0B0E14",
    colorBackground: "#131722",
    colorInput: "#0B0E14",
    colorForeground: "#E0E0E0",
    colorMutedForeground: "#9AA1AE",
    colorInputForeground: "#E0E0E0",
    borderRadius: "0.5rem",
  },
  elements: {
    userButtonPopoverActionButton: { color: "#E0E0E0" },
    userButtonPopoverActionButtonText: { color: "#E0E0E0" },
    userButtonPopoverActionButtonIcon: { color: "#D4AF37" },
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
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <FloatingWhatsApp />
      </body>
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
