import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/", "**/*.test.ts", "**/*.config.ts", "dist/"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/core": path.resolve(__dirname, "./src/core"),
      "@/infrastructure": path.resolve(__dirname, "./src/infrastructure"),
      "@/application": path.resolve(__dirname, "./src/application"),
      "@/api": path.resolve(__dirname, "./src/api"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
