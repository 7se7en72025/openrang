import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
}
async function exportDesign(page: Page, type: string) {
  await page
    .getByRole("button", { name: "Export design", exact: true })
    .click();
  await page.getByLabel("File type").selectOption(type);
  const done = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: type === "json" ? "Download project" : "Download design",
      exact: true,
    })
    .click();
  const download = await done;
  return { download, bytes: await readFile((await download.path())!) };
}

test("edit, undo, resize, export and restore an editable project", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page
    .getByLabel("Text content", { exact: true })
    .fill("Made with OpenRang");
  await page.getByLabel("Font size", { exact: true }).fill("80");
  await page
    .getByRole("button", { name: "Duplicate layer", exact: true })
    .click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(
    page.locator(".layer-select").filter({ hasText: "Made with OpenRang" }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.locator(".layer-select").filter({ hasText: "Made with OpenRang" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Resize", exact: true }).click();
  await page.getByRole("button", { name: "Story", exact: false }).click();
  await page
    .getByRole("button", { name: "Resize canvas", exact: true })
    .click();
  await expect(page.locator(".size-label")).toHaveText("1080 × 1920 px");
  const { bytes: png } = await exportDesign(page, "png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  const { bytes: json } = await exportDesign(page, "json");
  const project = JSON.parse(json.toString());
  const active = project.pages.find(
    (p: { id: string }) => p.id === project.activePageId,
  );
  expect(active.width).toBe(1080);
  expect(active.height).toBe(1920);
  expect(
    active.scene.objects.some(
      (o: { text?: string }) => o.text === "Made with OpenRang",
    ),
  ).toBeTruthy();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".size-label")).toHaveText("1080 × 1920 px");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(
    page.locator(".layer-select").filter({ hasText: "Made with OpenRang" }),
  ).toHaveCount(1);
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText("Invalid project");
  await expect(page.locator(".size-label")).toHaveText("1080 × 1920 px");
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "design.json",
    mimeType: "application/json",
    buffer: json,
  });
  await expect(page.getByRole("status")).toContainText("Project opened");
  expect(errors).toEqual([]);
});

test("transparent high resolution PNG, SVG and PDF downloads contain actual design", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Export design", exact: true })
    .click();
  await page.getByLabel("Export resolution").selectOption("2");
  await page.getByRole("checkbox", { name: "Transparent background" }).check();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download design", exact: true })
    .click();
  const png = await readFile((await (await downloadPromise).path())!);
  expect(png.readUInt32BE(16)).toBe(2160);
  const alpha = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  }, png.toString("base64"));
  expect(alpha).toBe(0);
  const svg = await exportDesign(page, "svg");
  expect(svg.bytes.toString()).toContain("<svg");
  const svgText = await page.evaluate(
    (s) =>
      new DOMParser().parseFromString(s, "image/svg+xml").documentElement
        .textContent,
    svg.bytes.toString(),
  );
  expect(svgText).toContain("MAKEGOODTHINGS.");
  const pdf = await exportDesign(page, "pdf");
  expect(pdf.bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.bytes.length).toBeGreaterThan(10000);
});

test("embedded image survives project roundtrip and brand palette persists", async ({
  page,
}) => {
  await open(page);
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .first()
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: pixel });
  await expect(
    page.getByRole("button", { name: "Remove background" }),
  ).toBeVisible();
  const { bytes } = await exportDesign(page, "json");
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "with-image.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.getByRole("status")).toContainText("Project opened");
  await page.getByRole("button", { name: "Brand kit", exact: true }).click();
  await page.getByLabel("Kit name").fill("Test Studio");
  await expect
    .poll(
      async () =>
        await page.evaluate(
          async () =>
            new Promise((resolve) => {
              const req = indexedDB.open("openrang");
              req.onsuccess = () => {
                const tx = req.result.transaction("studio");
                const get = tx.objectStore("studio").get("brand");
                get.onsuccess = () => resolve(get.result?.name);
              };
            }),
        ),
    )
    .toBe("Test Studio");
  await page.reload();
  await page.getByRole("button", { name: "Brand kit", exact: true }).click();
  await expect(page.getByLabel("Kit name")).toHaveValue("Test Studio");
});

test("templates work and mobile stays inside viewport", async ({ page }) => {
  await open(page);
  await page
    .getByRole("button", { name: "Use In full bloom template" })
    .click();
  await expect(page.getByLabel("Design title")).toHaveValue("In full bloom");
  await page.screenshot({ path: "docs/screenshots/editor-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Export design" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use Good things template" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use Good things template" }).click();
  await expect(page.locator(".library")).not.toBeVisible();
  await page.screenshot({ path: "docs/screenshots/editor-mobile.png" });
});
