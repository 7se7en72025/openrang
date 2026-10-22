import { test } from "node:test";
import assert from "node:assert/strict";
import { History } from "../src/history.ts";

test("a large embedded image is stored once across 50 undo states", () => {
  const history = new History(),
    src = "data:image/png;base64," + "a".repeat(1000000);
  for (let n = 0; n < 50; n++)
    history.push({
      pages: [
        {
          scene: {
            objects: [
              { type: "Image", src },
              { type: "Textbox", text: String(n) },
            ],
          },
        },
      ],
    });
  assert.equal(history.count, 50);
  assert.ok(history.bytes < 2100000);
  assert.equal(history.read(0).pages[0].scene.objects[0].src, src);
  for (let n = 0; n < 55; n++) history.push({ text: String(n) });
  assert.ok(
    history.bytes < 10000,
    "unreferenced images should be released with old snapshots",
  );
});
test("typing coalesces, undo branches discard redo, and clear releases assets", () => {
  const h = new History();
  h.push({ text: "a" });
  h.push({ text: "ab" }, "text");
  h.push({ text: "abc" }, "text");
  assert.equal(h.count, 2);
  assert.equal(h.read(0).text, "a");
  assert.equal(h.read(1).text, "abc");
  h.move(0);
  h.push({ text: "new branch" }, "text");
  assert.equal(h.count, 2);
  assert.equal(h.read(1).text, "new branch");
  h.clear();
  assert.equal(h.bytes, 0);
  assert.equal(h.index, -1);
});
