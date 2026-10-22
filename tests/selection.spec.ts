import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("multi-selection appearance and locks persist as document properties", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Select all layers" }).click();
  await page.getByLabel("Layer color", { exact: true }).fill("#112233");
  await page.getByLabel("Layer opacity", { exact: true }).fill("50");
  await page
    .getByRole("button", { name: "Lock selection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Export design", exact: true })
    .click();
  await page.getByLabel("File type").selectOption("json");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project" }).click();
  const bytes = await readFile((await (await downloaded).path())!);
  const doc = JSON.parse(bytes.toString());
  const objects = doc.pages[0].scene.objects;
  for (const object of objects)
    expect(object).toMatchObject({
      opacity: 0.5,
      fill: "#112233",
      lockMovementX: true,
    });
  await page
    .locator('input[accept=".json"]')
    .setInputFiles({
      name: "locked.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await expect(page.getByRole("status")).toContainText("Project opened");
  await expect(
    page.getByRole("button", { name: "Unlock layer 1", exact: true }),
  ).toBeVisible();
});
