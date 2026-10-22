import {
  readdirSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  statSync,
} from "node:fs";
import { build } from "vite";
import path from "node:path";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const assets = {};
function collect(directory) {
  for (const name of readdirSync(directory)) {
    if ([".openai", "server"].includes(name)) continue;
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) collect(file);
    else
      assets["/" + path.relative("dist", file).replaceAll("\\", "/")] = {
        data: readFileSync(file).toString("base64"),
        type: types[path.extname(file)] || "application/octet-stream",
      };
  }
}
collect("dist");
// Worker ESM starter: embed assets so Sites needs no extra asset binding or runtime package.
await build({
  configFile: false,
  define: { __SITE_ASSETS__: JSON.stringify(assets) },
  build: {
    ssr: "cloud/worker.ts",
    outDir: "dist/server",
    emptyOutDir: false,
    minify: true,
    rollupOptions: { output: { entryFileNames: "index.js" } },
  },
});
mkdirSync("dist/.openai", { recursive: true });
copyFileSync(".openai/hosting.json", "dist/.openai/hosting.json");
