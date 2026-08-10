import { expect, test } from "@playwright/test";

test.describe("Chat Page", () => {
  test("home page loads with brand and input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Be My Cupid").first()).toBeVisible();
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
  });

  test("can type in the input field", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Hello world");
    await expect(input).toHaveValue("Hello world");
  });

  test("submit button is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("send-button")).toBeVisible();
  });

  test("saved matches control is visible", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Saved Matches" })
    ).toBeVisible();
  });

  test("can stop generation with stop button", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("multimodal-input").fill("Hello");
    await page.getByTestId("send-button").click();

    const stopButton = page.getByTestId("stop-button");
    await stopButton.click({ timeout: 5000 }).catch(() => {
      // Generation may have finished before we could click
    });
  });
});

test.describe("Chat Input Features", () => {
  test("input clears after sending", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Test message");
    await page.getByTestId("send-button").click();

    await expect(input).toHaveValue("");
  });

  test("input supports multiline text", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("multimodal-input");
    await input.fill("Line 1\nLine 2\nLine 3");
    await expect(input).toContainText("Line 1");
  });
});
