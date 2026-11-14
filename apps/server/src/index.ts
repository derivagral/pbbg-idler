import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const app = await buildApp({
  dbPath: process.env.DB_PATH ? resolve(root, process.env.DB_PATH) : undefined,
});
const port = Number(process.env.PORT ?? 3001);
try {
  await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
  console.log(`Hearthwild idle RPG ready at http://localhost:${port}`);
} catch (error) {
  console.error(error);
  await app.close();
  process.exitCode = 1;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(() => {
      process.exitCode = 0;
    });
  });
}
