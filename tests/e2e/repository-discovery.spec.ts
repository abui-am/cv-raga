import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`discovers general repository evidence with an optional focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const searches: { query?: string }[] = [];
    let evidenceReads = 0;
    let sourceReads = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/profile") return route.fulfill({ json: null });
      if (path === "/api/repositories/repo1/search") {
        searches.push(route.request().postDataJSON());
        return route.fulfill({
          json: {
            created: searches.length === 1 ? 2 : 0,
            skipped: 0,
            scanned: 12,
            matches: 4,
          },
        });
      }
      if (path === "/api/settings")
        return route.fulfill({
          json: {
            aiConfigured: true,
            model: "test-model",
            database: "connected",
          },
        });
      if (path === "/api/repositories")
        return route.fulfill({
          json: [
            {
              id: "repo1",
              name: "Dispatch Board",
              path: "/projects/dispatch-board",
              createdAt: "2026-10-26T00:00:00.000Z",
            },
          ],
        });
      if (path === "/api/evidence") evidenceReads++;
      if (path === "/api/sources") sourceReads++;
      if (["/api/evidence", "/api/sources", "/api/cvs"].includes(path))
        return route.fulfill({ json: [] });
      throw new Error(`Unexpected API request: ${path}`);
    });

    await page.goto("/knowledge");
    const panel = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Evidence from your code" }),
    });
    const focus = panel.getByLabel("Focus on (optional)", { exact: true });
    const discover = panel.getByRole("button", {
      name: "Find evidence with AI",
      exact: true,
    });
    await expect(discover).toBeEnabled();
    await expect(focus).not.toBeVisible();
    await discover.click();
    await expect(panel.getByRole("status")).toContainText("2 drafts created");
    expect(searches).toEqual([{ query: "" }]);
    await expect(
      panel.getByRole("link", { name: "Review evidence" }),
    ).toBeVisible();
    await expect.poll(() => evidenceReads).toBeGreaterThanOrEqual(2);
    await expect.poll(() => sourceReads).toBeGreaterThanOrEqual(2);
    await panel.screenshot({
      path: `.data/screenshots/repository-overview-${width}.png`,
    });

    const optional = panel.getByText("Add a focus (optional)", { exact: true });
    await optional.focus();
    await page.keyboard.press("Enter");
    await expect(focus).toBeVisible();
    await focus.fill("  parcel tracking  ");
    await discover.click();
    await expect(panel.getByRole("status")).toContainText(
      "No evidence drafts found",
    );
    expect(searches[1]).toEqual({ query: "parcel tracking" });
    await expect(focus).toHaveValue("  parcel tracking  ");
    await expect(
      panel.getByRole("link", { name: "Review evidence" }),
    ).not.toBeVisible();

    await focus.fill("   ");
    await discover.click();
    await expect.poll(() => searches.length).toBe(3);
    expect(searches[2]).toEqual({ query: "" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
