import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../", "");
  const port = env.PORT || 3000;

  return {
    plugins: [react(), tailwindcss()],
    envDir: "../",
    server: {
      // In dev, proxy API and WS requests to the backend
      proxy: {
        "/api": {
          target: `http://localhost:${port}`,
          changeOrigin: true,
        },
        "/ws": {
          target: `ws://localhost:${port}`,
          ws: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
    },
  };
});
