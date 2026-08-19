import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
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
