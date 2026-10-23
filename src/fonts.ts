import { cache, config } from "fabric";
import { type EmbeddedFont, validateFonts } from "./font-data";
const loaded = new Map<string, FontFace>();
async function hash(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
const bytesFrom = (src: string) =>
  Uint8Array.from(atob(src.split(",")[1]), (c) => c.charCodeAt(0));
export async function readFont(file: File): Promise<EmbeddedFont> {
  if (file.size > 2 * 1024 * 1024)
    throw Error("Choose a font smaller than 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    header = String.fromCharCode(...bytes.slice(0, 4));
  const format = (
    {
      wOF2: "woff2",
      wOFF: "woff",
      "\u0000\u0001\u0000\u0000": "ttf",
      OTTO: "otf",
    } as Record<string, string>
  )[header];
  if (!format) throw Error("Choose a valid WOFF2, WOFF, TTF or OTF font.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return validateFonts([
    {
      family: "OpenRangFont_" + (await hash(bytes)),
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Custom font",
      src: `data:font/${format};base64,${btoa(binary)}`,
    },
  ])[0];
}
export async function loadFonts(fonts: EmbeddedFont[]) {
  const staged: { font: EmbeddedFont; face: FontFace }[] = [];
  for (const font of fonts) {
    if (loaded.has(font.family) && config.fontPaths[font.family] === font.src)
      continue;
    const bytes = bytesFrom(font.src);
    if (font.family !== "OpenRangFont_" + (await hash(bytes)))
      throw Error(
        "An embedded font has changed. Upload the original font again.",
      );
    try {
      const face = await new FontFace(font.family, bytes).load();
      staged.push({ font, face });
    } catch {
      throw Error(
        `Could not decode the font “${font.name}”. Your current design is preserved.`,
      );
    }
  }
  for (const { font, face } of staged) {
    document.fonts.add(face);
    loaded.set(font.family, face);
    config.fontPaths[font.family] = font.src;
    cache.clearFontCache(font.family);
  }
}
export function retainFonts(fonts: EmbeddedFont[]) {
  const keep = new Set(fonts.map((f) => f.family));
  for (const [family, face] of loaded)
    if (!keep.has(family)) {
      document.fonts.delete(face);
      delete config.fontPaths[family];
      cache.clearFontCache(family);
      loaded.delete(family);
    }
}
