import { test, expect } from "@playwright/test";

test("real on-device model removes background and undo preserves original", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.TEST_AI,
    "Run separately with TEST_AI=1; downloads the real AI model.",
  );
  test.setTimeout(240000);
  const photo = await request.get(
    "https://img.ly/static/ubq_samples/sample_4.jpg",
  );
  expect(photo.ok()).toBeTruthy();
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page
    .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
    .first()
    .setInputFiles({
      name: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: await photo.body(),
    });
  await page.getByRole("button", { name: "Remove background" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Background removed" }),
  ).toBeVisible({ timeout: 210000 });
  await page
    .getByRole("button", { name: "Export design", exact: true })
    .click();
  await page.getByLabel("File type").selectOption("json");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project" }).click();
  const fs = await import("node:fs/promises");
  const p = JSON.parse(
    await fs.readFile((await (await download).path())!, "utf8"),
  );
  const src = p.scene.objects.find(
    (o: { type: string }) => o.type === "Image",
  ).src;
  const alpha = await page.evaluate(async (s) => {
    const img = new Image();
    img.src = s;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let transparent = 0,
      solid = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 10) transparent++;
      if (pixels[i] > 240) solid++;
    }
    return { transparent, solid };
  }, src);
  expect(alpha.transparent).toBeGreaterThan(100);
  expect(alpha.solid).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(
    page.locator(".layer").filter({ hasText: "Uploaded image" }),
  ).toHaveCount(1);
});
