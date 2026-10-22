import { test, expect } from "@playwright/test";

test("production editor reloads and edits offline after its core assets are cached", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.STUDIO_URL && !process.env.TEST_PRODUCTION,
    "Offline service worker is enabled only in production builds.",
  );
  await page.goto("/");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.getByLabel("Design title").fill("Offline studio");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Design title")).toHaveValue("Offline studio");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page
    .getByLabel("Text content", { exact: true })
    .fill("Created offline");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(
    page.locator(".layer-select").filter({ hasText: "Created offline" }),
  ).toBeVisible();
});
