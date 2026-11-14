import { test, expect, type Page } from "@playwright/test";
import { SKILLS, type Snapshot } from "@idler/contracts";
const password = "local-test-passphrase";
async function createPlayer(page: Page, suffix: string) {
  const username = `test_${suffix}_${Date.now().toString(36)}`;
  await page.goto("/");
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account & enter", exact: true })
    .click();
  await expect(
    page.getByLabel("Character name", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Character name", { exact: true }).fill("Willow");
  await page
    .getByRole("button", { name: "Enter the Hearthwild", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Hearthwild", exact: true }),
  ).toBeVisible();
  return username;
}
async function snapshot(page: Page): Promise<Snapshot> {
  const response = await page.request.get("/api/state");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("playable account → four skills → persistent inventory → 1v1 combat → login", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const username = await createPlayer(page, "full");
  await expect(page.locator("canvas")).toHaveCount(0);
  for (const [skill, resource] of SKILLS.map(
    (s, i) => [s, ["Timber", "Ore", "Fish", "Herbs"][i]] as const,
  )) {
    await page
      .getByRole("button", { name: `Gather ${resource}`, exact: true })
      .click();
    await expect
      .poll(async () => (await snapshot(page)).character?.skills[skill].actions)
      .toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  const before = (await snapshot(page)).character!;
  expect(
    before.inventory.filter((stack) => stack.quantity > 0).length,
  ).toBeGreaterThanOrEqual(4);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The Hearthwild", exact: true }),
  ).toBeVisible();
  const restored = (await snapshot(page)).character!;
  expect(restored.inventory).toEqual(before.inventory);
  await page
    .getByRole("button", { name: "Fight Bramble rat", exact: true })
    .click();
  await expect
    .poll(async () => (await snapshot(page)).character?.combat.wins, {
      timeout: 16_000,
    })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  const after = (await snapshot(page)).character!;
  expect(after.combat.enemyMaxHp).toBe(18);
  expect(after.hp).toBeLessThanOrEqual(after.maxHp);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("tab", { name: "Log in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Log in", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "The Hearthwild", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).character?.combat.wins).toBe(after.combat.wins);
  expect(browserErrors).toEqual([]);
});

test("idle ticks continue with no page, viewer toggles safely, desktop and mobile fit", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await createPlayer(page, "viewer");
  await page
    .getByRole("button", { name: "Gather Timber", exact: true })
    .click();
  const before = (await snapshot(page)).character!.skills.woodcutting.actions;
  await page.goto("about:blank");
  await expect
    .poll(
      async () => (await snapshot(page)).character!.skills.woodcutting.actions,
    )
    .toBeGreaterThan(before);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The Hearthwild", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open 3D viewer", exact: true })
    .click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("state-viewer")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) => canvas.width),
    )
    .toBeGreaterThan(0);
  await page
    .getByTestId("state-viewer")
    .screenshot({ path: testInfo.outputPath("viewer.png") });
  await page
    .getByRole("button", { name: "Close 3D viewer", exact: true })
    .click();
  await expect(page.locator("canvas")).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(
      page.getByRole("button", { name: "Gather Herbs", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (width === 390)
      await page.screenshot({
        path: testInfo.outputPath("mobile.png"),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: testInfo.outputPath("desktop.png"),
    fullPage: true,
  });
  expect(context.pages()).toHaveLength(1);
});

test("WebGL unavailable keeps the game playable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (/webgl/.test(kind)) return null;
      return (original as (...args: unknown[]) => unknown).call(
        this,
        kind,
        ...args,
      );
    } as typeof original;
  });
  await createPlayer(page, "fallback");
  await page
    .getByRole("button", { name: "Open 3D viewer", exact: true })
    .click();
  await expect(
    page.getByText(/WebGL|3D.*unavailable|viewer.*unavailable/i).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gather Ore", exact: true }).click();
  await expect
    .poll(async () => (await snapshot(page)).character?.skills.mining.actions)
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Close 3D viewer", exact: true })
    .click();
});
