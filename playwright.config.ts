import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.STUDIO_URL || "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 980 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: process.env.CI ? {} : { channel: "chrome",args:['--disable-gpu'] },
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  webServer: process.env.STUDIO_URL
    ? undefined
    : {
        command: process.env.TEST_PRODUCTION
          ? "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173"
          : "node node_modules/vite/bin/vite.js --host 127.0.0.1",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
      },
  reporter: "list",
});
