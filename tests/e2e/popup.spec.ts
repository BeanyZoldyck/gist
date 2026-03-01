import { test, expect } from "./fixtures";

test("popup loads and shows main actions", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await expect(page.getByText("Link Hints")).toBeVisible();
  await expect(page.getByText("Resources")).toBeVisible();
  await expect(page.getByText("Settings")).toBeVisible();
  await page.close();
});
