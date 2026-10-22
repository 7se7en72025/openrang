import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateDocument,
  packDocument,
  validateBrand,
} from "../src/project.ts";
const legacy = {
  schemaVersion: 1,
  title: "Legacy canvas",
  width: 1080,
  height: 1920,
  background: "#ffffff",
  scene: {
    objects: [
      {
        type: "Textbox",
        text: "My original design",
        left: 70,
        top: 100,
        fontSize: 60,
        fill: "#112233",
      },
    ],
  },
};
test("legacy documents migrate without losing content or dimensions", () => {
  const doc = validateDocument(legacy);
  assert.equal(doc.schemaVersion, 2);
  assert.equal(doc.pages.length, 1);
  assert.equal(doc.pages[0].height, 1920);
  assert.equal(doc.pages[0].scene.objects[0].text, "My original design");
});
test("shared images pack once and hydrate on every page", () => {
  const doc = validateDocument(legacy),
    src = "data:image/png;base64,YQ==";
  doc.pages[0].scene.objects.push({ type: "Image", src });
  doc.pages.push({
    ...structuredClone(doc.pages[0]),
    id: "another-page",
    name: "Page 2",
  });
  const packed = packDocument(doc);
  assert.equal(Object.keys(packed.assets).length, 1);
  const restored = validateDocument(packed);
  assert.equal(restored.pages[1].scene.objects[1].src, src);
});
test("remote images, unknown filters and incomplete brand kits are rejected", () => {
  assert.throws(
    () =>
      validateDocument({
        ...legacy,
        scene: {
          objects: [{ type: "Image", src: "https://example.com/a.png" }],
        },
      }),
    /embedded/,
  );
  assert.throws(
    () =>
      validateDocument({
        ...legacy,
        scene: {
          objects: [
            {
              type: "Image",
              src: "data:image/png;base64,YQ==",
              filters: [{ type: "Untrusted" }],
            },
          ],
        },
      }),
    /adjustment/,
  );
  assert.throws(
    () => validateBrand({ name: "Missing palette" }),
    /Invalid brand kit/,
  );
});
