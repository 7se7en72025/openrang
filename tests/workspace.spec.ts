import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
}
async function exported(page: Page, type: string) {
  await page
    .getByRole("button", { name: "Export design", exact: true })
    .click();
  await page.getByLabel("File type").selectOption(type);
  const promise = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: type === "json" ? "Download project" : "Download design",
      exact: true,
    })
    .click();
  return readFile((await (await promise).path())!);
}
async function image(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f85c3a";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#3155e7";
    ctx.fillRect(64, 0, 64, 64);
    return c.toDataURL().split(",")[1];
  });
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp"]')
    .first()
    .setInputFiles({
      name: "colors.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
}

test("pages preserve content, reorder, undo deletion, export multi-page PDF and reload", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Duplicate page", exact: true })
    .click();
  await expect(page.locator(".page-tab")).toHaveCount(2);
  await page.getByLabel("Page name", { exact: true }).fill("Second page");
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(page.locator(".page-tab")).toHaveCount(3);
  await page.getByLabel("Page name", { exact: true }).fill("Third page");
  await page.getByRole("button", { name: "Move page earlier" }).click();
  await expect(page.locator(".page-tab").nth(1)).toContainText("Third page");
  await page.getByRole("button", { name: "Delete page", exact: true }).click();
  await expect(page.locator(".page-tab")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".page-tab")).toHaveCount(3);
  const pdf = (await exported(page, "pdf")).toString("latin1");
  expect(pdf.match(/\/Type \/Page\b/g)?.length).toBe(3);
  const doc = JSON.parse((await exported(page, "json")).toString());
  expect(doc.schemaVersion).toBe(2);
  expect(doc.pages).toHaveLength(3);
  expect(
    doc.pages[0].scene.objects.some((o: { text?: string }) =>
      o.text?.includes("GOOD"),
    ),
  ).toBeTruthy();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".page-tab")).toHaveCount(3);
});

test("project library opens, duplicates and restores recoverable trash", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Design title").fill("First design");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open design First design", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New design", exact: true }).click();
  await page.getByLabel("Design title").fill("Second design");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move First design to trash", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open design First design", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore First design", exact: true })
    .click();
  await page.getByRole("button", { name: "Your designs", exact: true }).click();
  await page
    .getByRole("button", { name: "Open design First design", exact: true })
    .click();
  await expect(page.getByLabel("Design title")).toHaveValue("First design");
  await page
    .getByRole("button", { name: "Duplicate design First design", exact: true })
    .click();
  await expect(page.getByLabel("Design title")).toHaveValue(
    "First design copy",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Design title")).toHaveValue(
    "First design copy",
  );
});

test("crop, adjustments, flip and shared image assets survive file import", async ({
  page,
}) => {
  await open(page);
  await image(page);
  await page.getByLabel("Crop preset").selectOption("1");
  await page.getByLabel("Brightness", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Flip X", exact: true }).click();
  await page
    .getByRole("button", { name: "Duplicate page", exact: true })
    .click();
  const bytes = await exported(page, "json"),
    doc = JSON.parse(bytes.toString());
  expect(Object.keys(doc.assets)).toHaveLength(1);
  const first = doc.pages[0].scene.objects.find(
    (o: { type: string }) => o.type === "Image",
  );
  expect(first.width).toBe(64);
  expect(first.height).toBe(64);
  expect(first.cropX).toBe(32);
  expect(first.flipX).toBe(true);
  expect(first.filters).toEqual([{ type: "Brightness", brightness: 0.25 }]);
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "edited.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.getByRole("status")).toContainText("Project opened");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page
    .locator(".layer-select")
    .filter({ hasText: "Uploaded image" })
    .click();
  await expect(page.getByLabel("Brightness", { exact: true })).toHaveValue(
    "25",
  );
  const jpeg = await exported(page, "jpeg");
  expect(jpeg[0]).toBe(0xff);
  expect(jpeg[1]).toBe(0xd8);
});

test("multi-selection groups retain geometry through export, lock and ungroup", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const original = JSON.parse((await exported(page, "json")).toString())
    .pages[0].scene.objects;
  await page
    .getByRole("button", { name: "Select all layers", exact: true })
    .click();
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await expect(page.locator(".layer-select")).toHaveCount(1);
  const packed = await exported(page, "json"),
    doc = JSON.parse(packed.toString());
  expect(doc.pages[0].scene.objects[0].type).toBe("Group");
  expect(doc.pages[0].scene.objects[0].objects).toHaveLength(original.length);
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "group.json",
    mimeType: "application/json",
    buffer: packed,
  });
  await expect(page.getByRole("status")).toContainText("Project opened");
  await page.locator(".layer-select").click();
  await page
    .getByRole("button", { name: "Lock selection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unlock selection", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unlock selection", exact: true })
    .click();
  await page.getByRole("button", { name: "Ungroup", exact: true }).click();
  await expect(page.locator(".layer-select")).toHaveCount(original.length);
  const after = JSON.parse((await exported(page, "json")).toString()).pages[0]
    .scene.objects;
  for (let i = 0; i < after.length; i++) {
    expect(after[i].left).toBeCloseTo(original[i].left, 2);
    expect(after[i].top).toBeCloseTo(original[i].top, 2);
  }
});

test("brand kit restore and manual zoom work without changing document pixels", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Brand kit", exact: true }).click();
  const kit = {
    name: "Restored Studio",
    colors: ["#112233", "#abcdef"],
    font: "Georgia",
  };
  await page.getByLabel("Import brand kit file").setInputFiles({
    name: "kit.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(kit)),
  });
  await expect(page.getByLabel("Kit name")).toHaveValue("Restored Studio");
  const before = await page.locator(".zoom-button").textContent();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect(await page.locator(".zoom-button").textContent()).not.toBe(before);
  await expect(page.locator(".size-label")).toHaveText("1080 × 1080 px");
  await page.getByRole("button", { name: "Fit canvas" }).click();
  await expect(page.locator(".zoom-button")).toHaveText(before!);
});

test("AI can be cancelled immediately without losing the original image", async ({
  page,
}) => {
  await open(page);
  await image(page);
  await page.getByRole("button", { name: "Remove background" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "cancelled" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export design", exact: true }),
  ).toBeEnabled();
  const doc = JSON.parse((await exported(page, "json")).toString());
  expect(Object.values(doc.assets)[0]).toContain("data:image/png");
});
