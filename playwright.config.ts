import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3001/api/health",
    env: {
      DB_PATH: resolve("work/browser-test.sqlite"),
      HOST: "127.0.0.1",
      PORT: "3001",
    },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
