import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    base: env.VITE_BASE ?? "/",
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"]
    }
  };
});
