// Teste de ponta a ponta: sobe o site contra um Supabase local e usa o navegador como um jogador faria.
// Uso: BASE_URL=http://localhost:3000 API_URL=... SERVICE_ROLE_KEY=... node scripts/e2e.mjs
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const OUT = "e2e/screenshots";
assert.ok(API_URL && SERVICE_ROLE_KEY, "Defina API_URL e SERVICE_ROLE_KEY");

const adminHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function createUser(email, password, role, name) {
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role }, user_metadata: { name } }),
  });
  assert.ok(res.ok, `Falha ao criar usuário: ${res.status} ${await res.text()}`);
  return res.json();
}

async function countRows(table, filter = "") {
  const res = await fetch(`${API_URL}/rest/v1/${table}?select=*${filter}`, {
    headers: { ...adminHeaders, Prefer: "count=exact", Range: "0-0" },
  });
  const range = res.headers.get("content-range") ?? "*/0";
  return Number(range.split("/")[1]);
}

async function rows(table, query) {
  const res = await fetch(`${API_URL}/rest/v1/${table}?${query}`, { headers: adminHeaders });
  assert.ok(res.ok, `Falha ao ler ${table}: ${res.status}`);
  return res.json();
}

let step = 0;
async function shot(page, name) {
  step += 1;
  await page.screenshot({ path: `${OUT}/${String(step).padStart(2, "0")}-${name}.png`, fullPage: true });
}

function log(message) {
  console.log(`✔ ${message}`);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${BASE_URL}/`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (error) => console.error("Erro na página:", error.message));

  try {
    // 1. Sem login, vai para o login
    await page.goto(BASE_URL);
    await page.waitForURL(/\/login/);
    await shot(page, "login");
    log("visitante é mandado para o login");

    // 2. Senha errada
    await page.fill("#email", "ninguem@e2e.com");
    await page.fill("#password", "senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("E-mail ou senha incorretos.").waitFor();
    log("senha errada mostra mensagem");

    // 3. Admin entra
    await createUser("admin@e2e.com", "senha-admin-123", "admin", "Jorge Admin");
    await login(page, "admin@e2e.com", "senha-admin-123");
    await page.getByText("Olá, Jorge").waitFor();
    await shot(page, "inicio-admin");
    log("admin entra e vê o início");

    // 4. Importa o exemplo
    await page.goto(`${BASE_URL}/admin/importar`);
    await page.getByRole("button", { name: "Carregar exemplo" }).click();
    await page.getByText("Tudo certo para importar.").waitFor();
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await page.getByText(/Importado:/).waitFor();
    await shot(page, "importar");
    assert.equal(await countRows("strategies"), 2);
    assert.equal(await countRows("drills"), 1);
    log("importação cria 2 estratégias e 1 drill");

    // 5. Estratégias e editor de range
    await page.goto(`${BASE_URL}/estrategias`);
    await page.getByText("RFI BTN max late 2:1").waitFor();
    await shot(page, "estrategias");
    await page.getByRole("link", { name: "RFI BTN max late 2:1" }).click();
    await page.locator("[data-hand='AA']").first().waitFor();
    await shot(page, "editor-range");
    await page.goto(`${BASE_URL}/estrategias/cbet-btn-vs-bb`);
    await page.getByText("Ranges por textura").waitFor();
    await shot(page, "editor-pos-flop");
    log("editor de estratégias abre pré-flop e pós-flop");

    // 6. Cria um drill pelo formulário (pré-flop até o flop)
    await page.goto(`${BASE_URL}/drills/novo`);
    await page.locator("input").first().fill("RFI até o flop");
    const select = page.locator("select").filter({ hasText: "Escolha uma estratégia" });
    await select.selectOption({ label: "Pré-flop · RFI BTN max late 2:1" });
    await page.getByRole("button", { name: "Adicionar" }).click();
    await select.selectOption({ label: "Flop · Cbet BTN vs BB" });
    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByText("Escopo: Do pré-flop ao flop").waitFor();
    await shot(page, "novo-drill");
    await page.getByRole("button", { name: "Salvar drill" }).click();
    await page.waitForURL(`${BASE_URL}/drills`);
    await page.getByText("RFI até o flop").waitFor();
    await shot(page, "drills");
    assert.equal(await countRows("drills"), 2);
    log("drill novo criado pelo formulário");

    // 7. Treina o drill de duas decisões
    const card = page.locator(".card").filter({ hasText: "RFI até o flop" });
    await card.getByRole("link", { name: "Treinar" }).click();
    await page.getByText("Sua mão").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    await shot(page, "treino-pergunta");
    let decisions = 0;
    let flopShot = false;
    for (let hand = 0; hand < 8; hand++) {
      for (let guard = 0; guard < 3; guard++) {
        const flop = await page.getByText("Board", { exact: true }).isVisible();
        // Sempre escolhe a última opção (Open shove no pré-flop, Bet 33% no flop)
        const options = page.locator("div.grid button:not([disabled])");
        await options.last().click();
        decisions += 1;
        await page.getByRole("button", { name: "Continuar" }).waitFor();
        if (hand === 0 && guard === 0) await shot(page, "treino-resposta");
        if (flop && !flopShot) {
          flopShot = true;
          await shot(page, "treino-flop");
        }
        await page.getByRole("button", { name: "Continuar" }).click();
        // Se ainda estamos na mesma mão (próxima decisão), continua o laço
        await page.waitForTimeout(150);
        const sameHand = await page.getByText(/decisão 2 de 2/).isVisible();
        if (!sameHand) break;
      }
    }
    await page.waitForTimeout(1500);
    const saved = await countRows("attempts");
    assert.equal(saved, decisions, `decisões salvas (${saved}) = decisões feitas (${decisions})`);
    log(`${decisions} decisões salvas no banco`);

    // A correção do servidor bate com a regra: shove no pré-flop só é certo para 22-44 e A2o-A6o
    const attempts = await rows("attempts", "select=correct,data");
    for (const a of attempts) {
      assert.equal(a.correct, a.data.chosenActionId === a.data.correctActionId);
    }
    log("correção do servidor confere com as ações gravadas");

    // 8. Desempenho
    await page.goto(`${BASE_URL}/desempenho`);
    await page.getByText("Leak finder").waitFor();
    await page.getByText(String(decisions), { exact: true }).first().waitFor();
    await shot(page, "desempenho");
    log("desempenho mostra as decisões");

    // 9. Standards e plano do mês
    await page.goto(`${BASE_URL}/admin/standards`);
    await page.getByRole("button", { name: "Adicionar stat" }).click();
    const inputs = page.locator(".card").first().locator("input");
    await inputs.nth(0).fill("RFI BTN");
    await inputs.nth(1).fill("rfi_btn");
    await inputs.nth(2).fill("40");
    await inputs.nth(3).fill("50");
    await inputs.nth(4).fill("5");
    await inputs.nth(5).fill("1");
    await page.locator(".card").first().getByLabel("RFI max late 2:1").check();
    await page.getByRole("button", { name: "Salvar standards" }).click();
    await page.getByText("Standards salvos.").waitFor();
    await shot(page, "standards");
    await page.goto(`${BASE_URL}/plano`);
    await page.locator("input[inputmode='decimal']").first().fill("30");
    await page.getByRole("button", { name: "Gerar plano" }).click();
    await page.getByText("Plano salvo.").waitFor();
    await page.reload();
    await page.getByText(/Muito fora · abaixo/).waitFor();
    await shot(page, "plano");
    log("plano do mês gerado a partir dos standards");

    // 10. Cadastra pool e jogador
    await page.goto(`${BASE_URL}/admin/jogadores`);
    await page.getByPlaceholder("Nome da nova pool").fill("Pool A");
    await page.getByRole("button", { name: "Criar pool" }).click();
    await page.getByText("Pool A").first().waitFor();
    const form = page.locator("form").filter({ hasText: "Novo jogador" });
    await form.locator("input").nth(0).fill("Ana Jogadora");
    await form.locator("input").nth(1).fill("ana@e2e.com");
    const password = await form.locator("input").nth(2).inputValue();
    await form.locator("select").nth(1).selectOption({ label: "Pool A" });
    await form.getByRole("button", { name: "Cadastrar" }).click();
    await page.getByText(/Ana Jogadora cadastrado/).waitFor();
    await shot(page, "jogadores");
    log("admin cadastra pool e jogadora");

    // 11. Jogadora entra e não acessa telas de gestão
    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL(/\/login/);
    await login(page, "ana@e2e.com", password);
    await page.getByText("Olá, Ana").waitFor();
    assert.equal(await page.getByRole("link", { name: "Estratégias" }).count(), 0);
    await page.goto(`${BASE_URL}/estrategias`);
    await page.waitForURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/admin/jogadores`);
    await page.waitForURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/desempenho`);
    assert.equal(await page.getByText("Jorge Admin").count(), 0, "jogadora não vê o admin no seletor");
    log("jogadora não acessa gestão nem o desempenho do admin");

    // 12. Celular
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.context().addCookies(await page.context().cookies());
    await mobile.goto(`${BASE_URL}/drills`);
    await mobile.locator(".card").filter({ hasText: "RFI até o flop" }).getByRole("link", { name: "Treinar" }).click();
    await mobile.getByText("Sua mão").waitFor();
    await mobile.screenshot({ path: `${OUT}/90-celular-treino.png`, fullPage: true });
    await mobile.getByRole("button", { name: "Menu" }).click();
    await mobile.screenshot({ path: `${OUT}/91-celular-menu.png` });
    log("treino e menu funcionam no celular");

    console.log("\nE2E: todos os passos passaram");
  } catch (error) {
    await page.screenshot({ path: `${OUT}/99-erro.png`, fullPage: true }).catch(() => {});
    console.error(`\nURL no erro: ${page.url()}`);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
