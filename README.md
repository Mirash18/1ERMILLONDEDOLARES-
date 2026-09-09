# 1er Millón de Dólares

Dominio: **1ermillondedolares.com** (ya comprado).

Plataforma de análisis, señales y educación en trading: gráficos en
vivo, herramientas de estudio (calculadora de velas, indicadores) y
clases con el profesor Miguel Cortés.

Este README es para quien vaya a correr o tocar el proyecto. La
documentación de **cómo funciona por dentro y por qué** vive en
[`/docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) y
[`/docs/SEGURIDAD.md`](./docs/SEGURIDAD.md) — se actualiza en cada fase.

## Estado

Fase 1 de 6 (estructura base y marca). Ver `/docs/ARQUITECTURA.md` para
la tabla completa de fases.

## Correr el proyecto localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Variables de entorno

Copia `.env.example` a `.env.local` y llena los valores reales a medida
que se vayan creando las cuentas correspondientes (Stripe, proveedor de
datos, Vimeo). `.env.local` nunca se sube al repositorio.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Fraunces / IBM Plex Sans / IBM Plex Mono
