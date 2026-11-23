import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockUrl = "file://" + path.join(__dirname, "fixtures/pagination-mock.html");
test("Pagination.NextPage and page input", async ({ page }) => {
  await page.goto(mockUrl);
  await expect(page.locator('[data-testid="row"]').first()).toContainText("Page 1");
  await page.evaluate(() => {
    const input = document.querySelector('[data-ui-name="Pagination.PageInput"] input');
    input.value = "2";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await expect(page.locator('[data-testid="row"]').first()).toContainText("Page 2");
  await page.locator('button[data-ui-name="Pagination.NextPage"]').click();
  await expect(page.locator('[data-testid="row"]').first()).toContainText("Page 3");
});
