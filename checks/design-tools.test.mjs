import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  validateDocument,
  packDocument,
  validateBrand,
} from "../src/project.ts";
import { validateFonts } from "../src/font-data.ts";
import { History } from "../src/history.ts";
import { templates, layoutProject } from "../src/templates.ts";
import { graphics, makeGraphic } from "../src/graphics.ts";
const bytes = readFileSync(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
);
const font = {
  name: "Demo",
  family: "OpenRangFont_" + createHash("sha256").update(bytes).digest("hex"),
  src: "data:font/woff2;base64," + bytes.toString("base64"),
};
const legacy = {
  schemaVersion: 1,
  title: "Design",
  width: 1080,
  height: 1080,
  background: "#ffffff",
  scene: { objects: [] },
};
test("custom fonts are pooled once, preserve typography and travel in brand backups", () => {
  const doc = validateDocument(legacy);
  doc.fonts = [font];
  doc.pages[0].scene.objects = [
    {
      type: "Textbox",
      fontFamily: font.family,
      text: "Hello",
      fontSize: 50,
      charSpacing: 120,
      lineHeight: 1.8,
      underline: true,
      stroke: "#112233",
      strokeWidth: 4,
      shadow: { color: "#112233", blur: 12, offsetX: 4, offsetY: 6 },
    },
  ];
  const restored = validateDocument(packDocument(doc));
  assert.deepEqual(restored.fonts, [font]);
  assert.equal(restored.pages[0].scene.objects[0].fontFamily, font.family);
  assert.equal(restored.pages[0].scene.objects[0].shadow.blur, 12);
  const history = new History();
  for (let i = 0; i < 40; i++) history.push({ ...doc, title: "State " + i });
  assert.ok(history.bytes < font.src.length * 3);
  assert.deepEqual(history.read(0).fonts, [font]);
  assert.deepEqual(
    validateBrand({
      name: "Studio",
      colors: ["#112233"],
      font: font.family,
      fonts: [font],
    }).fonts,
    [font],
  );
});
test("font URLs, duplicate fonts, oversized files and invalid shadows are rejected", () => {
  assert.throws(
    () => validateFonts([{ ...font, src: "https://example.com/font.woff2" }]),
    /embedded font/,
  );
  assert.throws(() => validateFonts([font, font]), /unique/);
  assert.throws(
    () =>
      validateFonts([
        { ...font, src: "data:font/ttf;base64," + bytes.toString("base64") },
      ]),
    /header/,
  );
  const doc = validateDocument(legacy);
  doc.pages[0].scene.objects = [
    {
      type: "Rect",
      shadow: {
        color: "url(https://example.com)",
        blur: 10,
        offsetX: 2,
        offsetY: 2,
      },
    },
  ];
  assert.throws(() => validateDocument(doc), /shadow/);
});
test("every authored layout and graphic passes the portable project validator", () => {
  const layouts = templates.filter((t) => t.layout);
  assert.equal(layouts.length, 12);
  for (const t of layouts) {
    const p = layoutProject(t),
      doc = validateDocument(p);
    assert.equal(doc.pages[0].width, t.width);
    assert.ok(doc.pages[0].scene.objects.length > 3);
  }
  for (const graphic of graphics) {
    const p = {
      ...legacy,
      scene: { objects: [makeGraphic(graphic.id, "#3155e7").toObject()] },
    };
    assert.equal(validateDocument(p).pages[0].scene.objects.length, 1);
  }
});
