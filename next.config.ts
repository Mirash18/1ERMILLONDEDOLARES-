import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js genera AGENTS.md/CLAUDE.md automáticamente en cada `next dev`;
  // los desactivamos para no ensuciar el repo con archivos no pedidos.
  agentRules: false,
};

export default nextConfig;
