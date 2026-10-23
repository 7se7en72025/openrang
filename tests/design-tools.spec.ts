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
  const done = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: type === "json" ? "Download project" : "Download design",
      exact: true,
    })
    .click();
  return readFile((await (await done).path())!);
}
async function photo(page: Page) {
  return Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d")!;
      x.fillStyle = "#f85c3a";
      x.fillRect(0, 0, 64, 64);
      return c.toDataURL().split(",")[1];
    }),
    "base64",
  );
}
test("custom fonts and effects survive reload, editable import, SVG and brand-kit reuse", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page.getByLabel("Text content", { exact: true }).fill("My custom type");
  const font = await readFile(
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  );
  await page.getByLabel("Upload custom font", { exact: true }).setInputFiles({
    name: "Demo.woff2",
    mimeType: "font/woff2",
    buffer: font,
  });
  await expect(page.getByLabel("Font family", { exact: true })).toHaveValue(
    /^OpenRangFont_/,
  );
  const family = await page
    .getByLabel("Font family", { exact: true })
    .inputValue();
  await expect
    .poll(() =>
      page.evaluate(
        (f) =>
          [...document.fonts].some(
            (face) => face.family === f && face.status === "loaded",
          ),
        family,
      ),
    )
    .toBe(true);
  await page.getByLabel("Letter spacing", { exact: true }).fill("120");
  await page.getByLabel("Line height", { exact: true }).fill("1.8");
  await page.getByRole("button", { name: "Underline", exact: true }).click();
  await page.getByLabel("Outline width", { exact: true }).press("Home");
  await page.getByLabel("Outline width", { exact: true }).press("ArrowRight");
  await page.getByLabel("Outline color", { exact: true }).fill("#112233");
  await page.getByLabel("Drop shadow", { exact: true }).check();
  await page.getByLabel("Shadow color", { exact: true }).fill("#223344");
  await page
    .getByRole("button", { name: "Save in brand kit", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Custom font saved");
  const bytes = await exported(page, "json"),
    doc = JSON.parse(bytes.toString()),
    text = doc.pages[0].scene.objects.find(
      (o: { text?: string }) => o.text === "My custom type",
    );
  expect(text).toMatchObject({
    fontFamily: family,
    charSpacing: 120,
    lineHeight: 1.8,
    underline: true,
    stroke: "#112233",
    shadow: { color: "#223344" },
  });
  expect(doc.fonts[0].src).toMatch(/^asset:/);
  expect(
    Object.values(doc.assets).filter((v) => String(v).startsWith("data:font/")),
  ).toHaveLength(1);
  const svg = (await exported(page, "svg")).toString();
  expect(svg).toContain("@font-face");
  expect(svg).toContain("data:font/woff2;base64,");
  await page
    .getByRole("button", { name: "Remove Demo from project", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Switch text using this font",
  );
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "with-font.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.getByRole("status")).toContainText("Project opened");
  await page.reload();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (f) =>
        [...document.fonts].some(
          (face) => face.family === f && face.status === "loaded",
        ),
      family,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Upload custom font", { exact: true }).setInputFiles({
    name: "bad.woff2",
    mimeType: "font/woff2",
    buffer: Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(40)]),
  });
  await expect(page.getByRole("status")).toContainText("Could not decode");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New design", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page.getByRole("button", { name: "Brand kit", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply font to selected text", exact: true })
    .click();
  await expect(page.getByLabel("Font family", { exact: true })).toHaveValue(
    family,
  );
  await page.getByLabel("Font family", { exact: true }).selectOption("Georgia");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove Demo from project", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove Demo from project", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Demo from project", exact: true }),
  ).toBeVisible();
  const asset = Object.keys(doc.assets).find((id) =>
      String(doc.assets[id]).startsWith("data:font/"),
    )!,
    tampered = Buffer.from(font);
  tampered[44] ^= 1;
  doc.assets[asset] = "data:font/woff2;base64," + tampered.toString("base64");
  const before = await page
    .getByLabel("Design title", { exact: true })
    .inputValue();
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "tampered.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.getByRole("status")).toContainText(
    "embedded font has changed",
  );
  await expect(page.getByLabel("Design title", { exact: true })).toHaveValue(
    before,
  );
});
test("asset photos and graphics remain editable after library removal and across designs", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  const buffer = await photo(page);
  await page
    .getByLabel("Upload library photo", { exact: true })
    .setInputFiles({ name: "colors.png", mimeType: "image/png", buffer });
  await expect(
    page.getByRole("button", { name: "Add colors.png to design", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New design", exact: true }).click();
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page
    .getByRole("button", { name: "Add colors.png to design", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Flower graphic", exact: true })
    .click();
  await expect(page.getByLabel("Layer color", { exact: true })).toHaveValue(
    "#3155e7",
  );
  await page
    .getByRole("button", { name: "Add Heart graphic", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Remove colors.png from library",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Add colors.png to design", exact: true }),
  ).toHaveCount(0);
  const bytes = await exported(page, "json"),
    doc = JSON.parse(bytes.toString());
  expect(
    doc.pages[0].scene.objects.map((o: { type: string }) => o.type),
  ).toEqual(["Image", "Group", "Polygon"]);
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "assets.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.getByRole("status")).toContainText("Project opened");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  const restored = JSON.parse((await exported(page, "json")).toString());
  expect(restored.pages[0].scene.objects).toHaveLength(3);
});
test("all new template formats have real dimensions and editable content", async ({
  page,
}) => {
  await open(page);
  const layouts: [string, string][] = [
    ["Product story", "1080 × 1920 px"],
    ["Event reminder", "1080 × 1920 px"],
    ["Tutorial thumbnail", "1280 × 720 px"],
    ["Product launch", "1280 × 720 px"],
    ["Pitch deck cover", "1920 × 1080 px"],
    ["Webinar slide", "1920 × 1080 px"],
    ["Studio business card", "1050 × 600 px"],
    ["Booking card", "1050 × 600 px"],
    ["Cafe menu", "794 × 1123 px"],
    ["Workshop flyer", "794 × 1123 px"],
    ["Modern resume", "794 × 1123 px"],
    ["Clean letterhead", "794 × 1123 px"],
  ];
  for (const [name, size] of layouts) {
    await page
      .getByRole("button", { name: `Use ${name} template`, exact: true })
      .click();
    await expect(page.locator(".size-label")).toHaveText(size);
    await expect(page.getByLabel("Design title", { exact: true })).toHaveValue(
      name,
    );
  }
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a text box", exact: true })
    .click();
  await page.getByLabel("Text content", { exact: true }).fill("Edited by me");
  const doc = JSON.parse((await exported(page, "json")).toString());
  expect(
    doc.pages[0].scene.objects.some(
      (o: { text?: string }) => o.text === "Edited by me",
    ),
  ).toBe(true);
});
test("simultaneous library uploads in two tabs preserve both assets", async ({
  page,
  context,
}) => {
  await open(page);
  const other = await context.newPage();
  try {
    await open(other);
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await other.getByRole("button", { name: "Assets", exact: true }).click();
    const buffer = await photo(page);
    await Promise.all([
      page
        .getByLabel("Upload library photo", { exact: true })
        .setInputFiles({ name: "first.png", mimeType: "image/png", buffer }),
      other
        .getByLabel("Upload library photo", { exact: true })
        .setInputFiles({ name: "second.png", mimeType: "image/png", buffer }),
    ]);
    await expect(
      page.getByRole("button", {
        name: "Add first.png to design",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", {
        name: "Add second.png to design",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByRole("button", { name: "Assets", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Add first.png to design",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Add second.png to design",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});
test("a failed asset-index save rolls back the full image write", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (key === "asset-library")
        throw new DOMException(
          "Library quota test failure",
          "QuotaExceededError",
        );
      return original.call(this, value, key);
    };
  });
  await open(page);
  await page.getByRole("button", { name: "Assets", exact: true }).click();
  await page.getByLabel("Upload library photo", { exact: true }).setInputFiles({
    name: "failed.png",
    mimeType: "image/png",
    buffer: await photo(page),
  });
  await expect(page.getByRole("status")).toContainText(
    "Library quota test failure",
  );
  const keys = await page.evaluate(
    () =>
      new Promise<IDBValidKey[]>((resolve, reject) => {
        const db = indexedDB.open("openrang", 1);
        db.onsuccess = () => {
          const request = db.result
            .transaction("studio")
            .objectStore("studio")
            .getAllKeys();
          request.onsuccess = () => {
            resolve(request.result);
            db.result.close();
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
  expect(keys.filter((key) => String(key).startsWith("asset:"))).toHaveLength(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Add failed.png to design", exact: true }),
  ).toHaveCount(0);
});
