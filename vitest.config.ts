import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" (vite.config.ts's @vitejs/plugin-react
  // handles the actual transform for the app build). Vitest bundles its own,
  // newer Vite internally, which defaults its own transform (oxc) to
  // jsx: "preserve" too and ignores esbuild-level jsx options entirely — so a
  // .spec.ts that transitively imports a .tsx file (as confetti-colors.spec.ts
  // does) fails to parse without this explicit override.
  oxc: {
    jsx: "automatic",
  },
  test: {
    include: ["client/src/**/*.spec.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
