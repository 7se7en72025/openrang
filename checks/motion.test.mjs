import { test } from "node:test";
import assert from "node:assert/strict";
import { motionFrame, motionPlan } from "../src/motion.ts";
import { validateDocument, packDocument } from "../src/project.ts";
const doc = validateDocument({
  schemaVersion: 1,
  title: "Video",
  width: 1080,
  height: 1920,
  background: "#ffffff",
  scene: { objects: [] },
});
test("page motion survives project validation and rejects unsafe settings", () => {
  doc.pages[0].motion = { duration: 2.5, effect: "slide" };
  assert.deepEqual(
    validateDocument(packDocument(doc)).pages[0].motion,
    doc.pages[0].motion,
  );
  for (const motion of [
    { duration: 0, effect: "fade" },
    { duration: 16, effect: "fade" },
    { duration: 2, effect: "eval" },
  ])
    assert.throws(
      () => validateDocument({ ...doc, pages: [{ ...doc.pages[0], motion }] }),
      /animation/,
    );
});
test("video duration and resolution remain bounded and effects converge", () => {
  const plan = motionPlan(doc, true);
  assert.equal(plan.duration, 2.5);
  assert.ok(plan.width * plan.height <= 2073600);
  assert.throws(
    () =>
      motionPlan(
        {
          ...doc,
          pages: Array(5).fill({
            ...doc.pages[0],
            motion: { duration: 15, effect: "fade" },
          }),
        },
        true,
      ),
    /60 seconds/,
  );
  for (const effect of ["none", "fade", "slide", "zoom"])
    assert.deepEqual(motionFrame(effect, 1), { alpha: 1, y: 0, scale: 1 });
  assert.equal(motionFrame("fade", 0).alpha, 0);
  assert.ok(motionFrame("slide", 0).y > 0);
  assert.ok(motionFrame("zoom", 0).scale > 1);
});
