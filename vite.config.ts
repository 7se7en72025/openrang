import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  server: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
  optimizeDeps: { exclude: ["@imgly/background-removal"] },
});
