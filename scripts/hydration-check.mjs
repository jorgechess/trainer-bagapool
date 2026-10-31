// Diagnóstico: abre páginas no servidor de desenvolvimento e mostra avisos de divergência de HTML.
import { chromium } from "playwright";
const BASE = process.env.DEV_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage();
const messages = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") messages.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => messages.push(`[pageerror] ${e.message}`));
await page.goto(`${BASE}/login`);
await page.fill("#email", "admin@e2e.com");
await page.fill("#password", "senha-admin-123");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(`${BASE}/`, { timeout: 60000 });
for (const path of ["/admin/jogadores", "/drills", "/desempenho", "/plano", "/estrategias", "/admin/standards"]) {
  messages.push(`--- ${path}`);
  await page.goto(`${BASE}${path}`, { timeout: 90000 });
  await page.waitForTimeout(3000);
}
console.log(messages.join("\n").slice(0, 6000));
await browser.close();
