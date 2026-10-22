import { test, expect } from "@playwright/test";
test.skip(
  !process.env.TEST_CLOUD,
  "Requires the explicit loopback cloud QA server",
);
test("two accounts share, sync, preserve conflicting edits and revoke access", async ({
  browser,
  baseURL,
}) => {
  const alice = await browser.newContext(),
    bob = await browser.newContext();
  await alice.addCookies([
    { name: "openrang-test-user", value: "alice", url: baseURL! },
  ]);
  await bob.addCookies([
    { name: "openrang-test-user", value: "bob", url: baseURL! },
  ]);
  const a = await alice.newPage(),
    b = await bob.newPage();
  try {
    await a.goto("/");
    await expect(
      a.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await a.getByLabel("Design title").fill("Team canvas " + Date.now());
    await a
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await expect(
      a.getByRole("button", { name: "Save this design to cloud", exact: true }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Save this design to cloud", exact: true })
      .click();
    await expect(
      a.getByRole("button", { name: "Create editor invite" }),
    ).toBeEnabled();
    await a.getByRole("button", { name: "Create editor invite" }).click();
    const invite = a.getByLabel("Editor invite link");
    await expect(invite).toBeVisible();
    await b.goto(await invite.inputValue());
    await expect(
      b.getByRole("button", { name: "Sync now", exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Sync now", exact: true }).click();
    await a.getByRole("button", { name: "Close dialog", exact: true }).click();
    await b.getByRole("button", { name: "Close dialog", exact: true }).click();
    const beforeAutomatic = await a.getByLabel("Design title").inputValue();
    await a.getByLabel("Design title").fill("Automatic team update");
    await expect(b.getByLabel("Design title")).toHaveValue(
      "Automatic team update",
      { timeout: 18000 },
    );
    await a.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(b.getByLabel("Design title")).toHaveValue(beforeAutomatic, {
      timeout: 18000,
    });
    await a
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await b
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await b.getByLabel("Automatically sync this design").uncheck();
    await a.getByLabel("Automatically sync this design").uncheck();
    await a.getByRole("button", { name: "Close dialog", exact: true }).click();
    await a.getByLabel("Design title").fill("Alice team update");
    await a
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await a.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect(
      a.getByText("Cloud changes saved", { exact: true }),
    ).toBeVisible();
    await b.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect(
      b.getByText("Received the latest team changes", { exact: true }),
    ).toBeVisible();
    await b.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect(b.getByLabel("Design title")).toHaveValue("Alice team update");
    await b.getByLabel("Design title").fill("Bob conflicting edit");
    await a.getByRole("button", { name: "Close dialog", exact: true }).click();
    await a.getByLabel("Design title").fill("Alice winning edit");
    await a
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await a.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect(
      a.getByText("Cloud changes saved", { exact: true }),
    ).toBeVisible();
    await b
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await b.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect(b.getByRole("alert")).toContainText(
      "Your local edits and the cloud version both exist",
    );
    await b
      .getByRole("button", { name: "Back up my edits, then use cloud version" })
      .click();
    await expect(b.getByRole("alert")).toHaveCount(0);
    await b.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect(b.getByLabel("Design title")).toHaveValue(
      "Alice winning edit",
    );
    await b.getByRole("button", { name: "Projects", exact: true }).click();
    await expect(
      b.getByRole("button", {
        name: "Open design Bob conflicting edit (conflict backup)",
        exact: true,
      }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Revoke team access", exact: true })
      .click();
    await expect(
      a.getByText("All collaborators and invite links revoked", {
        exact: true,
      }),
    ).toBeVisible();
    await b
      .getByRole("button", { name: "Cloud and team", exact: true })
      .click();
    await b.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect(
      b.getByText("This cloud design is unavailable to this account.", {
        exact: true,
      }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Refresh library", exact: true })
      .click();
    await expect(
      a.getByRole("button", { name: "Refresh library", exact: true }),
    ).toBeEnabled();
    await a
      .getByRole("button", { name: "Move cloud design to Trash", exact: true })
      .first()
      .click();
    await expect(
      a.getByText("Moved to cloud Trash. Your local copy is kept.", {
        exact: true,
      }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Restore cloud design", exact: true })
      .first()
      .click();
    await expect(
      a.getByText(
        "Cloud design restored. Previous team access remains revoked.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await alice.close();
    await bob.close();
  }
});
