import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "openrang-offline",
      generateBundle(_options, bundle) {
        // IMG.LY sets CPU wasmPaths explicitly. Its unused GPU fallback binary must not enter the static deployment.
        for (const name of Object.keys(bundle))
          if (/ort-wasm-simd-threaded\.jsep.*\.wasm$/.test(name))
            delete bundle[name];
        const assets = Object.values(bundle)
          .filter((file) =>
            file.type === "chunk"
              ? file.isEntry
              : /\.(css|woff2)$/.test(file.fileName),
          )
          .map((file) => "/" + file.fileName);
        const entry = Object.values(bundle).find(
          (file) => file.type === "chunk" && file.isEntry,
        )!;
        this.emitFile({
          type: "asset",
          fileName: "precache.json",
          source: JSON.stringify(assets),
        });
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: readFileSync(
            new URL("./src/service-worker.template.js", import.meta.url),
            "utf8",
          ).replace("__BUILD_ID__", entry.fileName.replace(/[^\w-]/g, "")),
        });
      },
    },
  ],
  worker: { format: "es" },
  // CPU inference is the supported path; both optional imports can share its runtime.
  resolve: {
    alias: [
      { find: /^onnxruntime-web\/webgpu$/, replacement: "onnxruntime-web" },
    ],
  },
  css: { postcss: { plugins: [] } },
  server: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
  optimizeDeps: { exclude: ["@imgly/background-removal"] },
});
