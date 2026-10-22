import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("page animation persists and produces a playable, nonempty video", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: "video.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        title: "Tiny video",
        width: 320,
        height: 320,
        background: "#f85c3a",
        scene: {
          objects: [
            {
              type: "Textbox",
              text: "Hello video",
              left: 40,
              top: 100,
              fontSize: 32,
              fill: "#ffffff",
            },
          ],
        },
      }),
    ),
  });
  await expect(page.getByLabel("Design title")).toHaveValue("Tiny video");
  await page
    .getByRole("button", { name: "Animate and video", exact: true })
    .click();
  await page.getByLabel("Current page animation").selectOption("slide");
  await page.getByLabel("Page duration (seconds)").fill("1");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Duplicate page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Animate and video", exact: true })
    .click();
  await page.getByLabel("Current page animation").selectOption("zoom");
  await page.getByRole("button", { name: "Create video preview" }).click();
  const preview = page.getByLabel("Animation preview");
  await expect(preview).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() => preview.evaluate((node: HTMLVideoElement) => node.readyState))
    .toBeGreaterThanOrEqual(2);
  expect(
    await preview.evaluate((node: HTMLVideoElement) => [
      node.videoWidth,
      node.videoHeight,
    ]),
  ).toEqual([320, 320]);
  const changed = await preview.evaluate(async (node: HTMLVideoElement) => {
    const sample = async (at: number) => {
      node.currentTime = at;
      await new Promise<void>((resolve) =>
        node.addEventListener("seeked", () => resolve(), { once: true }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 320;
      canvas.getContext("2d")!.drawImage(node, 0, 0);
      return canvas.toDataURL();
    };
    return (await sample(0.05)) !== (await sample(0.75));
  });
  expect(changed).toBe(true);
  expect(
    await preview.evaluate(async (node: HTMLVideoElement) => {
      node.currentTime = 1.6;
      await new Promise<void>((resolve) =>
        node.addEventListener("seeked", () => resolve(), { once: true }),
      );
      return node.currentTime;
    }),
  ).toBeGreaterThan(1.5);
  const ready = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download video", exact: true })
    .click();
  const download = await ready,
    bytes = await readFile((await download.path())!);
  expect(bytes.length).toBeGreaterThan(1000);
  expect(download.suggestedFilename()).toMatch(/\.(webm|mp4)$/);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Animate and video", exact: true })
    .click();
  await expect(page.getByLabel("Current page animation")).toHaveValue("zoom");
  await expect(page.getByLabel("Page duration (seconds)")).toHaveValue("1");
});
test("video cancellation returns the studio to an editable state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Animate and video", exact: true })
    .click();
  await page.getByRole("button", { name: "Create video preview" }).click();
  await page.getByRole("button", { name: "Cancel recording" }).click();
  await expect(
    page.getByRole("button", { name: "Create video preview" }),
  ).toBeVisible();
  await expect(page.getByLabel("Animation preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByLabel("Design title").fill("Still editable");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
});
