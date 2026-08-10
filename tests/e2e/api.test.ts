import { expect, test } from "@playwright/test";

const CHAT_URL_REGEX = /\/chat\/[\w-]+/;
const ERROR_TEXT_REGEX = /error|failed|trouble/i;

test.describe("Chat API Integration", () => {
  test("sends message and receives AI response", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Hello");
    await page.getByTestId("send-button").click();

    const assistantMessage = page.locator("[data-role='assistant']").first();
    await expect(assistantMessage).toBeVisible({ timeout: 30_000 });

    const content = await assistantMessage.textContent();
    expect(content?.length).toBeGreaterThan(0);
  });

  test("redirects to /chat/:id after sending message", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Test redirect");
    await page.getByTestId("send-button").click();

    await expect(page).toHaveURL(CHAT_URL_REGEX, { timeout: 10_000 });
  });

  test("clears input after sending", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Test message");
    await page.getByTestId("send-button").click();

    await expect(input).toHaveValue("");
  });

  test("shows stop button during generation", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Test");
    await page.getByTestId("send-button").click();

    const stopButton = page.getByTestId("stop-button");
    await expect(stopButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Chat Error Handling", () => {
  test("handles API error gracefully", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Test error");
    await page.getByTestId("send-button").click();

    await expect(page.getByText(ERROR_TEXT_REGEX).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
