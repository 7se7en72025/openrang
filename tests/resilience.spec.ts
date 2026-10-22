import { test, expect } from "@playwright/test";

test("rejected embedded class and remote image leave the document intact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  const base = {
    schemaVersion: 1,
    title: "Untrusted import",
    width: 1000,
    height: 1000,
    background: "#ffffff",
  };
  let unexpectedRequest = false;
  page.on("request", (r) => {
    if (r.url().includes("do-not-fetch.example")) unexpectedRequest = true;
  });
  for (const object of [
    { type: "Image", src: "https://do-not-fetch.example/image.png" },
    { type: "UnrecognizedClass", text: "untrusted" },
  ]) {
    await page
      .locator('input[accept=".json"]')
      .setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({ ...base, scene: { objects: [object] } }),
        ),
      });
    await expect(page.getByRole("status")).toContainText(
      /Only embedded|unsupported/,
    );
    await expect(page.getByLabel("Design title")).toHaveValue("Good things");
  }
  expect(unexpectedRequest).toBe(false);
});

test("failed storage reports failure and the editable document can still be downloaded", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage is full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await expect(page.locator(".save-status")).toContainText("Save failed");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Add a text box" }).click();
  await page
    .getByLabel("Text content", { exact: true })
    .fill("Still my design");
  await page
    .getByRole("button", { name: "Export design", exact: true })
    .click();
  await page.getByLabel("File type").selectOption("json");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project" }).click();
  expect((await download).suggestedFilename()).toContain(".openrang.json");
});
