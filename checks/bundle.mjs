import { readdirSync, statSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
const files = readdirSync("dist/assets");
const entry = files.find((name) => /^index-[\w-]+\.js$/.test(name));
assert.ok(entry, "A production entry bundle must exist.");
const initial = gzipSync(readFileSync("dist/assets/" + entry)).length;
const total = files.reduce(
  (n, name) => n + statSync("dist/assets/" + name).size,
  0,
);
assert.ok(
  initial < 200000,
  `Initial JS exceeds the 200 kB gzip budget: ${initial}.`,
);
assert.ok(
  total < 3000000,
  `Assets exceed the 3 MB deployment budget: ${total}.`,
);
assert.ok(
  !files.some((name) => name.endsWith(".wasm")),
  "Unused runtime WASM should not be bundled with the CPU-only editor.",
);
const precache = JSON.parse(readFileSync("dist/precache.json", "utf8"));
assert.ok(
  !precache.some((name) => /worker|jspdf|html2canvas|ort[.]/.test(name)),
  "Heavy optional tools must not be precached on first load.",
);
console.log(
  JSON.stringify(
    {
      initialJavaScriptGzipBytes: initial,
      deployedAssetBytes: total,
      precacheAssets: precache.length,
    },
    null,
    2,
  ),
);
