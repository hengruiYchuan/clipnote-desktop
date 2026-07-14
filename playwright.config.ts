import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    colorScheme: "light",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 648, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm exec vite preview --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
