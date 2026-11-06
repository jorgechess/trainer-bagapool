// Teste de ponta a ponta: sobe o site contra um Supabase local e usa o navegador como um jogador faria.
// Uso: BASE_URL=http://localhost:3000 API_URL=... SERVICE_ROLE_KEY=... node scripts/e2e.mjs
import { mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { copyFileSync, readdirSync } from "node:fs";
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
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
  });
  if (!res.ok) throw new Error(`Falha ao criar usuário: ${res.status} ${await res.text()}`);
  const user = await res.json();
  // Mesmo passo do SETUP.md: o primeiro admin é promovido direto no banco.
  const patch = await fetch(`${API_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: JSON.stringify({ role }),
  });
  if (!patch.ok) throw new Error(`Falha ao definir papel: ${patch.status} ${await patch.text()}`);
  const [profile] = await patch.json();
  if (profile?.role !== role) throw new Error(`Papel não aplicado: ${JSON.stringify(profile)}`);
  return user;
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
  if (!res.ok) throw new Error(`Falha ao ler ${table}: ${res.status} ${await res.text()}`);
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

async function login(page, user, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#login", user);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${BASE_URL}/`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => {
    console.error("Erro na página:", error.message);
    pageErrors.push(`${page.url()}: ${error.message}`);
  });

  try {
    // 1. Sem login, vai para o login
    await page.goto(BASE_URL);
    await page.waitForURL(/\/login/);
    await shot(page, "login");
    log("visitante é mandado para o login");

    // 2. Senha errada
    await page.fill("#login", "ninguem");
    await page.fill("#password", "senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("Nick ou senha incorretos.").waitFor();
    log("senha errada mostra mensagem");

    // 3. Admin entra
    await createUser("admin@e2e.com", "senha-admin-123", "admin", "Jorge Admin");
    await login(page, "admin@e2e.com", "senha-admin-123");
    await page.getByText("Olá, Jorge").waitFor();
    // Pools do Baga vêm cadastradas; o admin pertence ao Baga Low e o selo aparece no topo
    assert.ok((await countRows("pools")) >= 9, "pools do Baga cadastradas pela migração");
    const [low] = await rows("pools", "select=id&name=eq.Baga%20Low");
    const [me] = await rows("profiles", "select=id&email=eq.admin@e2e.com");
    const res = await fetch(`${API_URL}/rest/v1/profiles?id=eq.${me.id}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ pool_id: low.id }),
    });
    assert.ok(res.ok, "admin entra no Baga Low");
    await page.reload();
    await page.locator("header [title='Baga Low']").first().waitFor();
    await shot(page, "inicio-admin");
    log("admin entra e vê o início");

    // 4. Cargas do repositório entram sozinhas no banco; o exemplo (2 estratégias) é inserido direto
    assert.ok((await countRows("strategies")) > 1000, "mais de 1000 estratégias: a leitura precisa de páginas");
    assert.equal(await countRows("strategies", "&id=like.rfi-mlr-*"), 168, "cargas importadas no primeiro acesso");
    assert.ok(await countRows("drills", "&id=eq.defesa-bb-pko-short"), "drills das cargas cadastrados");
    {
      const exemplo = JSON.parse(execSync("npx tsx scripts/e2e-exemplo.ts", { encoding: "utf8" }));
      for (const table of ["strategies", "drills"]) {
        const res = await fetch(`${API_URL}/rest/v1/${table}`, {
          method: "POST",
          headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(exemplo[table]),
        });
        assert.ok(res.ok, `exemplo inserido em ${table}: ${res.status}`);
      }
    }
    log("cargas importadas direto no banco; exemplo com 2 estratégias inserido");

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
    await page.getByRole("button", { name: /Modo avançado/ }).click();
    const select = page.locator("select").filter({ hasText: "Escolha uma estratégia" });
    await select.selectOption({ label: "Pré-flop · RFI BTN max late 2:1" });
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await select.selectOption({ label: "Flop · Cbet BTN vs BB" });
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.getByText("Escopo: Do pré-flop ao flop").waitFor();
    await shot(page, "novo-drill");
    await page.getByRole("button", { name: "Salvar drill" }).click();
    await page.waitForURL(`${BASE_URL}/drills`);
    await page.getByText("RFI até o flop").waitFor();
    await shot(page, "drills");
    assert.equal(await countRows("drills", "&name=eq.RFI%20at%C3%A9%20o%20flop"), 1);
    log("drill novo criado pelo formulário");

    // 7. Treina o drill de duas decisões
    const card = page.locator(".card").filter({ hasText: "RFI até o flop" });
    await card.getByRole("link", { name: "Treinar" }).click();
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    // RFI BTN max late 2:1 → 17 × 2 = 34 jogadores restantes, no canto da mesa
    assert.equal((await page.getByTestId("players-left").innerText()).split("\n")[0].trim(), "34 left");
    await shot(page, "treino-pergunta");
    let decisions = 0;
    let flopShot = false;
    for (let hand = 0; hand < 8; hand++) {
      for (let guard = 0; guard < 3; guard++) {
        const flop = await page.getByTestId("board").isVisible();
        // Sempre escolhe a última opção (All-in no pré-flop, Bet 33% no flop)
        const options = page.locator("[data-testid=actions] button:not([disabled])");
        await options.last().click();
        decisions += 1;
        await page.getByRole("button", { name: "Continuar" }).waitFor();
        const feedback = await page.locator("[data-feedback]").getAttribute("data-feedback");
        assert.ok(["certo", "errado", "meio"].includes(feedback), "exercício fica contornado de verde, vermelho ou amarelo (meio certo)");
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
    await page.getByTestId("drill-report").first().waitFor();
    assert.equal(await page.getByTestId("drill-report").count(), 1, "um bloco por drill treinado");
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

    // 9b. Carga real: RFI 30bb vanilla (7 posições) e drill com variações
    await page.goto(`${BASE_URL}/drills`);
    const rfiCard = page.locator(".card").filter({ hasText: "RFI 30bb vanilla" });
    await rfiCard.getByRole("link", { name: "Treinar" }).waitFor();
    await rfiCard.getByRole("link", { name: "Treinar" }).click();
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    assert.match(await page.getByTestId("hand-counter").innerText(), /1\/50/);
    const positions = new Set();
    for (let hand = 0; hand < 14; hand++) {
      const spot = await page.getByTestId("spot").textContent();
      assert.equal(await page.getByTestId("spot-stack").textContent(), "30bb");
      positions.add(spot.split(" · ")[1]);
      await page.locator("[data-testid=actions] button:not([disabled])").first().click();
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    assert.match(await page.getByTestId("hand-counter").innerText(), /15\/50/, "contador mostra a mão atual da sessão");
    await shot(page, "treino-rfi-variacoes");

    // Olho: com a resposta à mostra, o range aparece antes de responder e a decisão não conta
    await page.waitForTimeout(1500);
    const before = await countRows("attempts");
    await page.getByRole("button", { name: "Mostrar resposta" }).click();
    await page.locator("[data-hand='AA']").first().waitFor();
    await shot(page, "treino-olho-aberto");
    for (let hand = 0; hand < 3; hand++) {
      await page.locator("[data-testid=actions] button:not([disabled])").first().click();
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await page.waitForTimeout(1500);
    assert.equal(await countRows("attempts"), before, "decisões com a resposta à mostra não são salvas");
    await page.getByText(/3 com resposta à mostra/).waitFor();
    await page.getByRole("button", { name: "Resposta à mostra" }).click();
    assert.equal(await page.locator("[data-hand='AA']").count(), 0, "range volta a ficar escondido");
    log("olho mostra a resposta e essas decisões não contam");
    assert.ok(positions.size >= 3, `sorteou várias posições: ${[...positions].join(", ")}`);
    log(`carga RFI 30bb importada; drill sorteou ${[...positions].join(", ")}`);

    // Filtro de posições do jogador: só BTN, sem mudar o drill
    await page.getByRole("button", { name: "BTN", exact: true }).click();
    await page.waitForTimeout(300);
    for (let hand = 0; hand < 6; hand++) {
      await page.getByTestId("spot").filter({ hasText: /^RFI · BTN$/ }).waitFor();
      await page.locator("[data-testid=actions] button:not([disabled])").first().click();
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await shot(page, "treino-filtro-posicao");
    const [rfiDrill] = await rows("drills", "select=data&id=eq.rfi-30bb-vanilla-todas");
    assert.equal(rfiDrill.data.variants.length, 7, "filtro do jogador não altera o drill");
    await page.getByRole("button", { name: "Todas", exact: true }).click();
    log("filtro de posição do jogador funciona e não altera o drill");

    // Várias mesas ao mesmo tempo: 4 mesas, cada uma com a sua mão
    await page.waitForTimeout(1500);
    const beforeMulti = await countRows("attempts");
    await page.getByRole("button", { name: "4 mesas" }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.getByTestId("table-slot").count(), 4);
    for (let table = 0; table < 4; table++) {
      const slot = page.getByTestId("table-slot").nth(table);
      await slot.locator("[data-testid=actions] button").first().click();
      await slot.getByRole("button", { name: "Continuar" }).click();
    }
    await shot(page, "treino-4-mesas");
    await page.waitForTimeout(1500);
    assert.equal(await countRows("attempts"), beforeMulti + 4, "decisões das 4 mesas salvas");
    await page.getByRole("button", { name: "2 mesas" }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.getByTestId("table-slot").count(), 2);
    await page.getByRole("button", { name: "1 mesa", exact: true }).click();
    await page.waitForTimeout(1000);
    const slots = await page.getByTestId("table-slot").count();
    if (slots !== 1) {
      const pressed = await page.locator("[aria-label='Mesas'] button").evaluateAll((els) =>
        els.map((e) => `${e.textContent}:${e.getAttribute("aria-pressed")}`),
      );
      const html = await page.locator("main").innerHTML();
      console.error("DEBUG mesas:", pressed.join(" "), "slots:", slots);
      console.error("DEBUG html:", html.slice(0, 3000));
    }
    assert.equal(slots, 1);
    log("treino com 1, 2 e 4 mesas");

    // Sessão sem limite, encerrada pelo botão; relatório com as cartas em miniatura
    await page.getByRole("button", { name: "Sem limite" }).click();
    await page.getByTestId("hand-counter").getByText("sem limite").waitFor();
    for (let hand = 0; hand < 6; hand++) {
      // Sempre "Raise": erra os folds, garantindo erros no relatório
      await page.locator("[data-testid=actions] button").last().click();
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await page.getByRole("button", { name: "Encerrar sessão" }).click();
    await page.getByText("Sessão concluída").waitFor();
    const mistakeRows = await page.getByTestId("mistake-cards").count();
    if (mistakeRows > 0) {
      assert.ok((await page.getByTestId("mistake-cards").first().locator("[aria-label]").count()) >= 2, "erro mostra as cartas");
    }
    await shot(page, "relatorio-sessao");
    await page.getByRole("button", { name: "Nova sessão" }).click();
    await page.getByTestId("hero-cards").waitFor();
    await page.getByRole("button", { name: /\(padrão\)/ }).click();
    log(`sessão sem limite encerrada pelo botão (${mistakeRows} erros no relatório)`);

    // Atalhos do jogador: F = fold, E = continuar, botão do meio do mouse = raise
    await page.goto(`${BASE_URL}/atalhos`);
    await page.getByTestId("atalho-fold").getByRole("button", { name: "Definir" }).click();
    await page.keyboard.press("KeyF");
    await page.getByTestId("atalho-fold").getByText("F", { exact: true }).waitFor();
    await page.getByTestId("atalho-continuar").getByRole("button", { name: "Definir" }).click();
    await page.keyboard.press("KeyE");
    await page.getByTestId("atalho-continuar").getByText("E", { exact: true }).waitFor();
    await page.getByTestId("atalho-rfi").getByRole("button", { name: "Definir" }).click();
    await page.mouse.click(30, 300, { button: "middle" });
    await page.getByTestId("atalho-rfi").getByText("Botão do meio").waitFor();
    await shot(page, "atalhos");
    await page.goto(`${BASE_URL}/drills/rfi-30bb-vanilla-todas/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    await page.keyboard.press("KeyF");
    await page.locator("[data-feedback]").waitFor();
    await page.getByTestId("table-slot").getByRole("button", { name: /Continuar/ }).getByText("E").waitFor();
    await page.keyboard.press("KeyE");
    await page.locator("[data-feedback]").waitFor({ state: "detached" });
    assert.match(await page.getByTestId("hand-counter").innerText(), /2\/50/);
    await page.evaluate(() => {
      window.__md = [];
      window.addEventListener("mousedown", (e) => window.__md.push(`${e.button}:${e.defaultPrevented}`));
    });
    await page.mouse.click(30, 500, { button: "middle" });
    try {
      await page.locator("[data-feedback]").waitFor({ timeout: 4000 });
    } catch (error) {
      const stored = await page.evaluate(() => localStorage.getItem("trainer:atalhos"));
      console.error("DEBUG mousedown:", await page.evaluate(() => window.__md), "atalhos:", stored);
      throw error;
    }
    const lastChoice = await rows("attempts", "select=data&order=id.desc&limit=1");
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(1500);
    const [newest] = await rows("attempts", "select=data&order=id.desc&limit=1");
    assert.equal(newest.data.chosenActionId, "rfi", "botão do meio escolheu raise");
    void lastChoice;
    // "1" definido pelo teclado de cima também vale no teclado numérico
    await page.goto(`${BASE_URL}/atalhos`);
    await page.getByTestId("atalho-rfi").getByRole("button", { name: "Definir" }).click();
    await page.keyboard.press("Digit1");
    await page.getByTestId("atalho-rfi").getByText("1", { exact: true }).waitFor();
    await page.goto(`${BASE_URL}/drills/rfi-30bb-vanilla-todas/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    {
      // nenhuma tecla aparece em dois botões (o "1" é do raise; o fold não pode mostrar "1")
      const hints = await page.locator("[data-testid=actions] button span").allInnerTexts();
      assert.equal(new Set(hints).size, hints.length, `teclas repetidas: ${hints.join(", ")}`);
      assert.ok(hints.filter((h) => h === "1").length === 1, `"1" aparece uma vez: ${hints.join(", ")}`);
    }
    await page.keyboard.press("Numpad1");
    await page.locator("[data-feedback]").waitFor();
    // Enter do teclado numérico continua quando o "continuar" está no Enter
    await page.goto(`${BASE_URL}/atalhos`);
    await page.getByTestId("atalho-continuar").getByRole("button", { name: "Definir" }).click();
    await page.keyboard.press("Enter");
    await page.getByTestId("atalho-continuar").getByText("Enter", { exact: true }).waitFor();
    await page.goto(`${BASE_URL}/drills/rfi-30bb-vanilla-todas/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    await page.keyboard.press("Numpad1");
    await page.locator("[data-feedback]").waitFor();
    await page.keyboard.press("NumpadEnter");
    await page.locator("[data-feedback]").waitFor({ state: "detached" });
    await page.keyboard.press("Numpad1");
    await page.locator("[data-feedback]").waitFor();
    await page.keyboard.press("NumpadEnter");
    await page.waitForTimeout(1500);
    const [numpad] = await rows("attempts", "select=data&order=id.desc&limit=1");
    assert.equal(numpad.data.chosenActionId, "rfi", "Numpad1 = 1 do teclado de cima");
    log("atalhos de teclado e mouse definidos pelo jogador funcionam (inclusive teclado numérico)");

    // Drill novo escolhendo spot e posições pelos botões
    await page.goto(`${BASE_URL}/drills/novo`);
    await page.locator("input").first().fill("RFI 30bb CO e BTN");
    await page.locator("select").filter({ hasText: "Escolha o spot" }).selectOption({ label: "RFI · 30bb (pré-flop)" });
    for (const pos of ["UTG", "UTG1", "MP", "LJ", "HJ"]) await page.getByRole("button", { name: pos, exact: true }).click();
    await shot(page, "novo-drill-posicoes");
    await page.getByRole("button", { name: "Salvar drill" }).click();
    await page.waitForURL(`${BASE_URL}/drills`);
    const [coBtn] = await rows("drills", "select=data&name=eq.RFI%2030bb%20CO%20e%20BTN");
    assert.deepEqual(coBtn.data.variants, [["rfi-30bb-vanilla-co"], ["rfi-30bb-vanilla-btn"]]);
    log("drill criado escolhendo spot e posições pelos botões");

    // Carga vs 3-bet: mãos só do range de open, mesa mostra o 3-bet
    const rfiRanges = Object.fromEntries(
      (await rows("strategies", "select=id,data&situation=eq.RFI&id=like.rfi-30bb-*")).map((s) => [s.data.heroPosition, s.data.range]),
    );
    await page.goto(`${BASE_URL}/drills/vs3bet-30bb-vanilla-todas/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByText(/^3-bet · \d/).first().waitFor();
    await page.getByText(/^Pote: \d/).waitFor();
    await shot(page, "treino-vs-3bet");
    const before3bet = await countRows("attempts");
    for (let hand = 0; hand < 8; hand++) {
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await page.waitForTimeout(1500);
    const dealt = await rows("attempts", `select=data&order=id.desc&limit=8`);
    assert.equal(dealt.length, 8);
    assert.ok((await countRows("attempts")) >= before3bet + 8);
    for (const a of dealt) {
      assert.equal(rfiRanges[a.data.heroPosition]?.[a.data.hand], "rfi", `${a.data.hand} está no open do ${a.data.heroPosition}`);
    }
    log("drill vs 3-bet sorteia só mãos do range de open");

    // PKO: etiquetas de bounty em todos os lugares e aviso de cobertura
    await page.goto(`${BASE_URL}/drills/rfi-50bb-pko-cobrindo/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    assert.equal(await page.getByTestId("bounty-tag").count(), 9, "bounty em todos os 9 lugares");
    assert.equal(await page.getByTestId("bounty-tag").first().innerText(), "$10.00");
    await page.getByTestId("pko-coverage").getByText("PKO cobrindo").waitFor();
    await page.getByText(/\(você\)/).locator("xpath=..").getByText(/^60bb$/).waitFor();
    await shot(page, "treino-pko");
    log("mesa PKO com bounty e cobertura");

    // vs 3-bet PKO coberto: depende do RFI coberto, acrescenta 4-bet na legenda e aceita mão mista
    const coberto = Object.fromEntries(
      (await rows("strategies", "select=data&id=like.rfi-50bb-pko-coberto-*")).map((s) => [s.data.heroPosition, s.data.range]),
    );
    const [utgVsCo] = await rows("strategies", "select=data&id=eq.vs3bet-50bb-pko-coberto-utg-vs-co");
    assert.deepEqual([utgVsCo.data.range.AA, utgVsCo.data.alsoCorrect.AA].sort(), ["4bet", "call"]);
    await page.goto(`${BASE_URL}/drills/vs3bet-50bb-pko-coberto/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByTestId("pko-coverage").getByText("PKO coberto").waitFor();
    await page.locator("[data-testid=actions]").getByRole("button", { name: "4-bet" }).waitFor();
    assert.equal(await page.getByTestId("hero-chips").innerText(), "2", "open do herói à frente das cartas");
    {
      const chips = await page.getByTestId("hero-chips").boundingBox();
      const cards = await page.getByTestId("hero-cards").boundingBox();
      assert.ok(chips.y + chips.height <= cards.y + 1, "fichas do herói acima das cartas");
    }
    await shot(page, "treino-vs3bet-pko-coberto");
    for (let hand = 0; hand < 6; hand++) {
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await page.waitForTimeout(1500);
    for (const a of await rows("attempts", "select=data&order=id.desc&limit=6"))
      assert.equal(coberto[a.data.heroPosition]?.[a.data.hand], "rfi", `${a.data.hand} está no open coberto do ${a.data.heroPosition}`);
    log("vs 3-bet PKO coberto: mãos do open coberto, botão 4-bet e mãos mistas");
    // vs 3-bet PKO cobrindo (RFI cobrindo já importado acima): você com 60bb
    const [mpVsLj] = await rows("strategies", "select=data&id=eq.vs3bet-50bb-pko-cobrindo-mp-vs-lj");
    assert.deepEqual([mpVsLj.data.range.AA, ...[mpVsLj.data.alsoCorrect.AA].flat()].sort(), ["4bet", "call", "shove"]);
    await page.goto(`${BASE_URL}/drills/vs3bet-50bb-pko-cobrindo/treinar`);
    await page.getByTestId("pko-coverage").getByText("PKO cobrindo").waitFor();
    await page.getByText(/\(você\)/).locator("xpath=..").getByText(/^58bb$/).waitFor();
    await shot(page, "treino-vs3bet-pko-cobrindo");
    log("vs 3-bet PKO cobrindo: herói com 60bb (58 depois do open) e AA misto em três ações");

    // Tela de drills: seções Vanilla e PKO recolhíveis, sem Editar, e escolha de mãos que vale no treino
    await page.goto(`${BASE_URL}/drills`);
    const vanilla = page.getByTestId("secao-vanilla");
    const pko = page.getByTestId("secao-pko");
    await vanilla.getByText("RFI 30bb vanilla").waitFor();
    assert.ok((await pko.getByTestId("drill-card").count()) >= 4, "PKO: RFI e vs 3-bet, coberto e cobrindo, e os outros");
    assert.equal(await page.getByRole("link", { name: "Editar" }).count(), 0, "sem botão Editar");
    assert.equal(await page.getByText("Escopo").count(), 0, "sem escopo no card");
    await shot(page, "drills-secoes");
    await pko.getByRole("button", { name: /PKO/ }).click();
    assert.equal(await pko.getByTestId("drill-card").count(), 0, "seção PKO recolhida");
    await page.reload();
    await page.getByTestId("secao-pko").getByRole("button", { name: /PKO/ }).and(page.locator("[aria-expanded=false]")).waitFor();
    assert.equal(await page.getByTestId("secao-pko").getByTestId("drill-card").count(), 0, "continua recolhida");
    await page.getByTestId("secao-pko").getByRole("button", { name: /PKO/ }).click();
    await page.getByRole("group", { name: "Mãos da sessão" }).getByRole("button", { name: "10", exact: true }).click();
    await vanilla.getByTestId("drill-card").filter({ hasText: "RFI 30bb vanilla" }).getByRole("link", { name: "Treinar" }).click();
    await page.getByTestId("hand-counter").getByText(/\/10/).waitFor();
    // volta ao padrão para não afetar os passos seguintes
    await page.getByRole("group", { name: "Mãos da sessão" }).getByRole("button", { name: /padrão/ }).click();
    log("tela de drills com seções recolhíveis e mãos por sessão");

    // Max Late Reg Vanilla: 168 estratégias; a mesa mostra players left (proporção ou bolha)
    assert.equal(await countRows("strategies", "&id=like.rfi-mlr-*"), 168);
    await page.goto(`${BASE_URL}/drills/rfi-max-late-reg-vanilla/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    assert.equal(await page.getByLabel("Avançar sozinho quando acertar").isChecked(), false, "avançar sozinho vem desligado");
    const leftText = (await page.getByTestId("players-left").innerText()).split("\n")[0].trim();
    assert.match(leftText, /^(51|34|26|18|19|20) left$/i, `players left: ${leftText}`);
    await shot(page, "treino-max-late");
    // Filtros do jogador: proporção 2:1 e stack 4bb → só spots 2:1 com 4bb (34 left; herói com 4bb, vilões variados)
    await page.getByRole("group", { name: "Proporção" }).getByRole("button", { name: "2:1", exact: true }).click();
    await page.getByRole("group", { name: "Stack" }).getByRole("button", { name: "4bb", exact: true }).click();
    for (let hand = 0; hand < 3; hand++) {
      await page.getByTestId("spot-stack").filter({ hasText: /^4bb$/ }).waitFor();
      assert.equal(await page.getByTestId("spot-context").textContent(), "2:1");
      assert.equal((await page.getByTestId("players-left").innerText()).split("\n")[0].trim().toLowerCase(), "34 left");
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    const villainStacks = await page.locator("p.text-zinc-400").filter({ hasText: /bb$/ }).allInnerTexts();
    assert.ok(new Set(villainStacks).size > 2, `vilões com stacks variados: ${villainStacks.join(", ")}`);
    await shot(page, "treino-max-late-filtros");
    log("filtros de proporção e stack no treino; vilões com stacks aleatórios");

    // Vs Resteal Max Late: vilão all-in, herói com 12–15bb (pílula mostra o stack sorteado)
    await page.goto(`${BASE_URL}/drills/vs-resteal-max-late-reg-vanilla/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    assert.match(await page.getByTestId("spot-stack").innerText(), /^1[2-5]bb$/);
    await page.getByText("All-in", { exact: true }).first().waitFor();
    assert.equal(await page.locator("[data-testid=actions] button").count(), 2, "fold e call");
    await shot(page, "treino-vs-resteal");
    const raises = {};
    for (const r of await rows("strategies", "select=data&or=(id.like.rfi-mlr-3p1-15bb-*,id.like.rfi-mlr-2p1-15bb-*)"))
      for (const [hand, action] of Object.entries(r.data.range))
        if (action === "rfi") (raises[r.data.heroPosition] ??= new Set()).add(hand);
    for (let hand = 0; hand < 6; hand++) {
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await page.waitForTimeout(1500);
    for (const a of await rows("attempts", "select=data&order=id.desc&limit=6"))
      assert.ok(raises[a.data.heroPosition]?.has(a.data.hand), `${a.data.hand} é raise de 15bb (3:1 ou 2:1) do ${a.data.heroPosition}`);
    log("vs resteal: vilão all-in e herói com 12–15bb");

    // RFI PKO short coberto: 10/15/20bb, bounty na mesa e todos os vilões cobrindo o herói
    await page.goto(`${BASE_URL}/drills/rfi-pko-short-coberto/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByTestId("pko-coverage").getByText("PKO coberto").waitFor();
    assert.match(await page.getByTestId("spot-stack").innerText(), /^(10|15|20)bb$/);
    assert.equal(await page.getByRole("group", { name: "Stack" }).getByRole("button").count(), 4, "Todas, 10, 15 e 20bb");
    await shot(page, "treino-pko-short");
    log("RFI PKO short coberto importado e treinável");

    // Defesa Vanilla Deep: 20 e 30bb num drill só (filtro de stack); substitui os drills antigos Defesa BB 20/30bb
    await page.goto(`${BASE_URL}/drills/defesa-vanilla-deep/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByTestId("spot").filter({ hasText: /^vs RFI · BB · vs (UTG|UTG1|MP|LJ|HJ|CO|BTN)$/ }).waitFor();
    for (const name of ["3-bet/Call", "3-bet/Fold"])
      await page.locator("[data-testid=actions]").getByRole("button", { name }).waitFor();
    await page.getByText("Pote: 3,5bb").waitFor();
    await page.getByRole("group", { name: "Stack" }).getByRole("button", { name: "30bb", exact: true }).click();
    await page.getByTestId("spot-stack").filter({ hasText: /^30bb$/ }).waitFor();
    await shot(page, "treino-defesa-bb");
    log("Defesa Vanilla Deep: 20/30bb com filtro de stack, open do vilão na mesa");

    // Defesa BB PKO Deep: filtros de stack e cobertura
    await page.goto(`${BASE_URL}/drills/defesa-bb-pko-deep/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByRole("group", { name: "Cobertura" }).getByRole("button", { name: "Coberto", exact: true }).click();
    await page.getByRole("group", { name: "Stack" }).getByRole("button", { name: "50bb", exact: true }).click();
    for (let hand = 0; hand < 3; hand++) {
      await page.getByTestId("pko-coverage").getByText("PKO coberto").waitFor();
      await page.getByTestId("spot-stack").filter({ hasText: /^50bb$/ }).waitFor();
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await shot(page, "treino-defesa-bb-pko");
    log("Defesa BB PKO Deep com filtros de stack e cobertura");

    // Defesa BB Vanilla MLR: open polar = vilão com 10–14bb
    await page.goto(`${BASE_URL}/drills/defesa-bb-vanilla-mlr/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByRole("group", { name: "Open do vilão" }).getByRole("button", { name: /Polar/ }).click();
    // a mão em andamento termina como estava; as próximas já seguem o filtro
    await page.locator("[data-testid=actions] button").first().click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    for (let hand = 0; hand < 3; hand++) {
      await page.getByTestId("spot-villain-stack").filter({ hasText: /^(UTG|UTG1|MP|LJ|HJ|CO|BTN) 1[0-4]bb$/ }).waitFor();
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await page.getByTestId("players-left").waitFor();
    await shot(page, "treino-defesa-bb-mlr");
    log("Defesa BB Vanilla MLR: filtro de open polar e stack do vilão em destaque");

    // Call em Shoves do BB MLR: vilão all-in cobrindo o herói, botões Fold e Call
    await page.goto(`${BASE_URL}/drills/call-shove-bb-mlr/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    assert.equal(await page.locator("[data-testid=actions] button").count(), 2, "fold e call");
    await page.getByText("All-in", { exact: true }).first().waitFor();
    await page.getByTestId("players-left").waitFor();
    await shot(page, "treino-call-shove-bb");
    log("Call em Shoves do BB MLR treinável");

    await page.goto(`${BASE_URL}/drills/defesa-bb-pko-short/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByTestId("pko-coverage").getByText("PKO coberto").waitFor();
    await page.getByTestId("players-left").waitFor();
    log("Defesa BB PKO Short treinável");

    await page.goto(`${BASE_URL}/drills/defesa-bb-vanilla-multiway/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByTestId("spot").filter({ hasText: / \+ / }).waitFor();
    await page.getByText(/^Call · /).first().waitFor();
    await page.locator("[data-testid=actions]").getByRole("button", { name: "Squeeze/Call" }).waitFor();
    await shot(page, "treino-multiway");
    log("Defesa BB multiway: quem pagou aparece na mesa");

    await page.goto(`${BASE_URL}/drills`);
    await page.getByTestId("secao-bw").getByText("Blind War").waitFor();
    await page.goto(`${BASE_URL}/drills/rfi-sb-chip-ev/treinar`);
    await page.getByTestId("hero-cards").waitFor();
    await page.getByTestId("raise-size").filter({ hasText: /Raise = 3(,5)?bb/ }).waitFor();
    await page.locator("[data-testid=actions]").getByRole("button", { name: "Limp" }).waitFor();
    await shot(page, "treino-rfi-sb");
    log("RFI SB Chip EV na seção Blind War");

    // BW SB MLR: abertura do SB e, se limpar, decisão contra o shove/ISO do BB
    await page.goto(`${BASE_URL}/drills/bw-sb-mlr/treinar`);
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    let segundaDecisao = false;
    for (let hand = 0; hand < 40 && !segundaDecisao; hand++) {
      await page.getByTestId("hero-cards").waitFor();
      await page.locator("[data-testid=actions]").getByRole("button", { name: "Limp" }).click();
      await page.getByRole("button", { name: /Continuar/ }).click();
      if (await page.getByText(/decisão 2 de 2/).count()) {
        segundaDecisao = true;
        await page.getByText(/^(All-in|ISO) · |^All-in$/).first().waitFor();
        await shot(page, "treino-bw-sb-segunda-decisao");
        await page.locator("[data-testid=actions] button").first().click();
        await page.getByRole("button", { name: /Continuar/ }).click();
      }
    }
    assert.ok(segundaDecisao, "alguma mão chega à decisão contra o shove/ISO");
    log("BW SB MLR: limp e decisão seguinte contra o BB");

    // BW BB: filtro de situação e vs limp com check / ISO / all-in
    await page.goto(`${BASE_URL}/drills/bw-bb/treinar`);
    await page.getByRole("group", { name: "Situação" }).getByRole("button", { name: "vs limp", exact: true }).click();
    // a mão em andamento pode seguir para o ISO vs 3-bet; responde até cair numa mão nova de vs limp
    for (let i = 0; i < 4; i++) {
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
      await page.getByTestId("hero-cards").waitFor();
      if ((await page.getByTestId("spot").innerText()).startsWith("vs limp")) break;
    }
    await page.getByTestId("spot").filter({ hasText: /^vs limp · BB · vs SB$/ }).waitFor();
    await page.locator("[data-testid=actions]").getByRole("button", { name: "ISO" }).waitFor();
    await page.getByText(/^Limp · /).waitFor();
    await shot(page, "treino-bw-bb");
    log("BW BB: vs limp com ISO e filtro de situação");

    // Cbet flop IP (Posflop Attack): flop na mesa, check/bet 25/bet 40 e leitura do board depois da resposta
    await page.goto(`${BASE_URL}/drills`);
    await page.getByTestId("secao-posflop-attack").getByText("Cbet flop IP").waitFor();
    await page.goto(`${BASE_URL}/drills/cbet-flop-ip/treinar`);
    await page.getByTestId("board").waitFor();
    assert.equal(await page.getByTestId("board").locator("> *").count(), 3, "flop com 3 cartas");
    await page.getByText("Pote: 4,5bb").waitFor();
    for (const name of ["Check", "Bet 25%", "Bet 40%"]) await page.locator("[data-testid=actions]").getByRole("button", { name }).waitFor();
    await page.locator("[data-testid=actions] button").first().click();
    await page.getByTestId("cbet-leitura").getByText(/^(Range bet |Split X_)B(25|40)$/i).waitFor();
    await shot(page, "treino-cbet-flop-ip");
    log("Cbet flop IP: flop, pote simples e leitura MES");

    // BW SB pós (Blind War): SB age primeiro no flop depois de raise/call (B25/B67) ou limp/check (stab 1bb)
    await page.goto(`${BASE_URL}/drills`);
    await page.getByTestId("secao-bw").getByText("BW SB pós").waitFor();
    await page.goto(`${BASE_URL}/drills/bw-sb-pos/treinar`);
    await page.getByTestId("board").waitFor();
    assert.equal(await page.getByTestId("board").locator("> *").count(), 3, "flop com 3 cartas");
    await page.getByText(/Pote: (7,5|3,5)bb/).waitFor();
    await page.getByTestId("spot-pot-type").getByText(/^(Limped|Raised) pot$/i).waitFor();
    await page.locator("[data-testid=actions]").getByRole("button", { name: "Check" }).waitFor();
    await page.locator("[data-testid=actions] button").first().click();
    await page
      .getByTestId("cbet-leitura")
      .getByText(/^(Range bet B25|Split X_B(25|67)|Stab range 1bb|Split X_Stab 1bb)$/i)
      .waitFor();
    await shot(page, "treino-bw-sb-pos");
    log("BW SB pós: flop do SB com leitura do guide");

    // BB Leads (Posflop Defense): lead no flop, turn ou river; lead certo + turn errado = meio certo (amarelo)
    await page.goto(`${BASE_URL}/drills`);
    await page.getByTestId("secao-posflop-defense").getByText("BB Leads").waitFor();
    await page.goto(`${BASE_URL}/drills/bb-leads/treinar`);
    await page.getByTestId("board").waitFor();
    let meioCerto = false;
    for (let i = 0; i < 40 && !meioCerto; i++) {
      await page.getByTestId("board").waitFor();
      const cards = await page.getByTestId("board").locator("> *").count();
      if (cards === 3) {
        // flop: Bet 25% é o certo nos boards de lead
        await page.locator("[data-testid=actions]").getByRole("button", { name: "Bet 25%" }).click();
        const feedback = await page.getByTestId("table-slot").getAttribute("data-feedback");
        const flopBoard = await page.getByTestId("board").textContent();
        await page.getByRole("button", { name: /Continuar/ }).click();
        if (feedback !== "certo") {
          // errou o flop: a mão acaba, sem turn (próximo board é outro flop)
          await page.waitForFunction((b) => document.querySelector("[data-testid=board]")?.textContent !== b, flopBoard);
          assert.notEqual(await page.getByTestId("board").locator("> *").count(), 4, "flop errado não vai pro turn");
        }
        if (feedback === "certo") {
          // turn depois do lead/call: erra de propósito com o que não for a resposta
          await page.getByTestId("board").locator("> *").nth(3).waitFor();
          const buttons = page.locator("[data-testid=actions] button");
          await buttons.first().click();
          const fb = await page.getByTestId("table-slot").getAttribute("data-feedback");
          if (fb === "meio") {
            meioCerto = true;
            await shot(page, "treino-bb-leads-meio-certo");
          }
          await page.getByRole("button", { name: /Continuar/ }).click();
        }
      } else {
        await page.locator("[data-testid=actions] button").first().click();
        await page.getByRole("button", { name: /Continuar/ }).click();
      }
    }
    assert.ok(meioCerto, "lead certo no flop e turn errado mostra meio certo");
    log("BB Leads: lead no flop, turn depois do call e meio certo em amarelo");

    // BB Probes (Posflop Defense): primeira decisão no turn, depois do flop check/check
    await page.goto(`${BASE_URL}/drills`);
    await page.getByTestId("secao-posflop-defense").getByText("BB Probes").waitFor();
    await page.goto(`${BASE_URL}/drills/bb-probes/treinar`);
    await page.getByTestId("board").waitFor();
    assert.equal(await page.getByTestId("board").locator("> *").count(), 4, "probe começa no turn");
    await page.locator("[data-testid=actions]").getByRole("button", { name: "Bet 115%" }).waitFor();
    await page.locator("[data-testid=actions] button").first().click();
    await page.getByTestId("cbet-leitura").waitFor();
    await shot(page, "treino-bb-probes");
    log("BB Probes: turn depois do flop check/check com leitura da guideline");

    // Warmup: botão no início, contagem 3-2-1-Go e treino de 15 minutos; decisões contam no drill de origem
    await page.goto(`${BASE_URL}/`);
    await page.getByTestId("warmup-button").click();
    await page.getByTestId("warmup-drills").waitFor();
    assert.deepEqual(await page.getByTestId("warmup-drills").locator("li").allInnerTexts(), ["RFI max late 2:1"], "warmup usa os drills do plano");
    await page.getByRole("button", { name: "Começar" }).click();
    await page.getByTestId("warmup-countdown").getByText("3").waitFor();
    await shot(page, "warmup-contagem");
    await page.getByTestId("warmup-timer").waitFor({ timeout: 10000 });
    assert.match(await page.getByTestId("warmup-timer").innerText(), /^1[45]:\d\d$/);
    const beforeWarmup = await countRows("attempts");
    for (let hand = 0; hand < 3; hand++) {
      await page.locator("[data-testid=actions] button").first().click();
      await page.getByRole("button", { name: /Continuar/ }).click();
    }
    await page.getByTestId("warmup-timer").filter({ hasText: /^14:\d\d$/ }).waitFor({ timeout: 5000 });
    await shot(page, "warmup-treino");
    for (let i = 0; i < 20 && (await countRows("attempts")) < beforeWarmup + 3; i++) await page.waitForTimeout(250);
    const warm = await rows("attempts", "select=drill_id&order=id.desc&limit=3");
    assert.ok(warm.length === 3 && warm.every((a) => a.drill_id !== "aquecimento"), "decisões do warmup contam nos drills de verdade");
    await page.getByRole("button", { name: "Encerrar sessão" }).click();
    await page.getByTestId("warmup-by-spot").getByText(/\d+%/).first().waitFor();
    log("warmup com contagem regressiva e 15 minutos");

    // Admin acrescenta e tira drills do plano do mês; o warmup acompanha
    await page.goto(`${BASE_URL}/plano`);
    const addForm = page.getByTestId("acrescentar-drill-plano");
    await addForm.locator("select").selectOption({ label: "RFI 30bb vanilla" });
    await addForm.locator("input").fill("150");
    await addForm.getByRole("button", { name: "Acrescentar" }).click();
    await page.getByText("Acrescentados pelo admin").waitFor();
    await page.getByTestId("drill-do-plano").filter({ hasText: "RFI 30bb vanilla" }).getByText(/\/150 decisões/).waitFor();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("drill-do-plano").filter({ hasText: "RFI max late 2:1" }).getByTestId("remover-drill-plano").click();
    await page.getByText("Drills deste stat tirados do plano.").waitFor();
    await shot(page, "plano-editado");
    await page.goto(`${BASE_URL}/aquecimento`);
    assert.deepEqual(await page.getByTestId("warmup-drills").locator("li").allInnerTexts(), ["RFI 30bb vanilla"], "warmup segue o plano editado");
    log("admin acrescenta e tira drills do plano do mês");
    log(`Max Late Reg Vanilla importado; mesa mostra ${leftText}`);

    // 10. Cadastra pool e jogador
    await page.goto(`${BASE_URL}/admin/jogadores`);
    await page.getByPlaceholder("Nome da nova pool").fill("Pool A");
    await page.getByRole("button", { name: "Criar pool" }).click();
    for (let i = 0; i < 20 && (await countRows("pools", "&name=eq.Pool%20A")) === 0; i++) await page.waitForTimeout(250);
    assert.equal(await countRows("pools", "&name=eq.Pool%20A"), 1);
    const form = page.locator("form").filter({ hasText: "Novo jogador" });
    const cadastrar = async (name, nick, role, pool) => {
      await form.locator("input").nth(0).fill(name);
      await form.locator("input").nth(1).fill(nick);
      const pw = await form.locator("input").nth(2).inputValue();
      if (role) await form.locator("select").nth(0).selectOption({ label: role });
      if (pool) await form.locator("select").nth(1).selectOption({ label: pool });
      await form.getByRole("button", { name: "Cadastrar" }).click();
      await page.getByText(new RegExp(`${name} cadastrado`)).waitFor();
      return pw;
    };
    const anaPassword = await cadastrar("Ana Jogadora", "ana_jogadora", null, "Pool A");
    await shot(page, "jogadores");
    const [ana] = await rows("profiles", "select=role,pool_id,email,must_change_password&nick=eq.ana_jogadora");
    assert.equal(ana.role, "jogador");
    assert.ok(ana.pool_id, "jogadora ficou na pool escolhida");
    assert.ok(ana.email.endsWith("@jogadores.bagapool.com.br"), "conta sem e-mail de verdade");
    assert.equal(ana.must_change_password, true);
    await cadastrar("Caio Coach", "caio_coach", "Coach", null);
    const [caio] = await rows("profiles", "select=role&nick=eq.caio_coach");
    assert.equal(caio.role, "coach", "papel escolhido no cadastro é aplicado");
    const maraPassword = await cadastrar("Mara Mentora", "Mara.Mentora", "Mentor", "Pool A");
    log("admin cadastra pool, jogadora e mentora pelo nick");

    // 11. Mentora: troca a senha provisória, vê só a própria pool, cadastra e gera senha provisória
    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL(/\/login/);
    await page.goto(`${BASE_URL}/login`);
    await page.fill("#login", "mara.mentora");
    await page.fill("#password", "senha-errada1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("Nick ou senha incorretos.").waitFor();
    await page.fill("#password", maraPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/trocar-senha/);
    await shot(page, "trocar-senha");
    await page.goto(`${BASE_URL}/drills`);
    await page.waitForURL(/\/trocar-senha/, { timeout: 10000 });
    await page.fill("#nova-senha", "curta");
    await page.fill("#confirmar-senha", "curta");
    await page.getByRole("button", { name: "Salvar e entrar" }).click();
    await page.getByText("A senha precisa ter pelo menos 8 caracteres.").waitFor();
    await page.fill("#nova-senha", "MentoraBaga2026");
    await page.fill("#confirmar-senha", "MentoraBaga2026");
    await page.getByRole("button", { name: "Salvar e entrar" }).click();
    await page.waitForURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/admin/jogadores`);
    await page.getByRole("heading", { name: /Jogadores · Pool A/ }).waitFor();
    assert.equal(await page.getByPlaceholder("Nome da nova pool").count(), 0, "mentora não gerencia pools");
    assert.equal(await page.locator("input[value='caio_coach']").count(), 0, "mentora não vê quem é de fora da pool");
    await page.locator("input[value='ana_jogadora']").waitFor();
    await form.locator("input").nth(0).fill("Beto Low");
    await form.locator("input").nth(1).fill("beto_low");
    assert.equal(await form.locator("select").count(), 0, "mentora não escolhe papel nem pool");
    await form.getByRole("button", { name: "Cadastrar" }).click();
    await page.getByText(/Beto Low cadastrado/).waitFor();
    const [beto] = await rows("profiles", "select=role,pool_id&nick=eq.beto_low");
    assert.deepEqual([beto.role, beto.pool_id], ["jogador", ana.pool_id], "mentora cadastra jogador na própria pool");
    const anaRow = page.locator(".card").filter({ has: page.locator("input[value='ana_jogadora']") });
    page.once("dialog", (d) => d.accept());
    await anaRow.getByRole("button", { name: "Gerar senha provisória" }).click();
    const msg = await anaRow.getByText(/Senha provisória: /).innerText();
    const resetPassword = msg.match(/Senha provisória: (\S+)/)[1];
    assert.notEqual(resetPassword, anaPassword);
    log("mentora troca a senha provisória e gerencia só os jogadores da própria pool");

    // Desempenho: a mentora escolhe as pools que mentora e vê a pool e cada jogador
    await page.goto(`${BASE_URL}/desempenho?visao=pools`);
    await page.getByTestId("minhas-pools").waitFor();
    await page.getByTestId("pool-opcao").filter({ hasText: "Pool A" }).click();
    await page.getByRole("button", { name: "Salvar pools" }).click();
    await page.getByTestId("pool-desempenho").first().waitFor();
    await page.getByTestId("pool-jogador").filter({ hasText: "Ana" }).first().waitFor();
    await shot(page, "desempenho-pools");
    await page.goto(`${BASE_URL}/desempenho`);
    await page.getByTestId("pool-desempenho").first().waitFor({ timeout: 10000 });
    await page.getByTestId("pool-jogador").getByRole("link", { name: /Ana/ }).first().click();
    await page.waitForURL(/visao=jogador&jogador=/);
    await page.getByText("Nenhum treino neste período.").or(page.getByTestId("drill-report").first()).first().waitFor();
    log("mentora escolhe as pools que mentora e abre um jogador pelo desempenho da pool");
    await page.goto(`${BASE_URL}/plano`);
    await page.getByTestId("acrescentar-drill-plano").waitFor();
    log("mentora pode mexer nos drills do próprio plano (warmup)");

    // 12. Jogadora entra pelo nick com a senha provisória, troca, e não acessa telas de gestão
    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL(/\/login/);
    await page.goto(`${BASE_URL}/login`);
    await page.fill("#login", "ANA_JOGADORA");
    await page.fill("#password", anaPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("Nick ou senha incorretos.").waitFor();
    await page.fill("#password", resetPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/trocar-senha/);
    await page.fill("#nova-senha", "AnaBaga2026");
    await page.fill("#confirmar-senha", "AnaBaga2026");
    await page.getByRole("button", { name: "Salvar e entrar" }).click();
    await page.waitForURL(`${BASE_URL}/`);
    await page.getByText("Olá, Ana").waitFor();
    const [anaDepois] = await rows("profiles", "select=must_change_password&nick=eq.ana_jogadora");
    assert.equal(anaDepois.must_change_password, false);
    assert.equal(await page.getByRole("link", { name: "Estratégias" }).count(), 0);
    await page.goto(`${BASE_URL}/estrategias`);
    await page.waitForURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/admin/jogadores`);
    await page.waitForURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/desempenho`);
    assert.equal(await page.getByText("Jorge Admin").count(), 0, "jogadora não vê o admin no seletor");
    await page.goto(`${BASE_URL}/plano`);
    await page.getByRole("heading", { name: /Plano/i }).first().waitFor();
    assert.equal(await page.getByTestId("acrescentar-drill-plano").count(), 0, "jogadora não mexe nos drills do plano");
    await page.goto(`${BASE_URL}/aquecimento`);
    await page.getByTestId("warmup-sem-plano").waitFor();
    log("jogadora entra pelo nick, troca a senha provisória e não acessa a gestão");

    // 12. Celular
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.context().addCookies(await page.context().cookies());
    await mobile.goto(`${BASE_URL}/drills`);
    await mobile.locator(".card").filter({ hasText: "RFI até o flop" }).getByRole("link", { name: "Treinar" }).click();
    await mobile.getByTestId("hero-cards").waitFor();
    await mobile.screenshot({ path: `${OUT}/90-celular-treino.png`, fullPage: true });
    await mobile.goto(`${BASE_URL}/drills/vs3bet-50bb-pko-coberto/treinar`);
    await mobile.getByTestId("hero-chips").waitFor();
    await mobile.screenshot({ path: `${OUT}/90-celular-vs3bet.png`, fullPage: true });
    await mobile.getByRole("button", { name: "Menu" }).click();
    await mobile.screenshot({ path: `${OUT}/91-celular-menu.png` });
    log("treino e menu funcionam no celular");

    // Telas grandes e verticais: a mesa e o range preenchem a tela sem sair da área visível
    for (const [name, width, height] of [
      ["92-wide-2560", 2560, 1300],
      ["93-tablet-vertical", 820, 1180],
      ["94-notebook", 1366, 768],
    ]) {
      const view = await browser.newPage({ viewport: { width, height } });
      await view.context().addCookies(await page.context().cookies());
      await view.goto(`${BASE_URL}/drills`);
      await view.locator(".card").filter({ hasText: "RFI 30bb vanilla" }).getByRole("link", { name: "Treinar" }).click();
      await view.getByTestId("hero-cards").waitFor();
      await view.locator("[data-testid=actions] button").first().click();
      await view.locator("[data-hand='AA']").first().waitFor();
      const box = await view.getByTestId("hero-cards").boundingBox();
      assert.ok(box && box.y + box.height <= height, `${name}: mão do herói visível sem rolar`);
      await view.screenshot({ path: `${OUT}/${name}.png` });
      await view.close();
    }
    log("mesa se adapta a tela wide, notebook e tablet vertical");

    {
      const view = await browser.newPage({ viewport: { width: 2560, height: 1300 } });
      await view.context().addCookies(await page.context().cookies());
      await view.goto(`${BASE_URL}/drills`);
      await view.locator(".card").filter({ hasText: "RFI 30bb vanilla" }).getByRole("link", { name: "Treinar" }).click();
      await view.getByRole("button", { name: "4 mesas" }).click();
      await view.getByTestId("table-slot").nth(3).locator("[data-testid=hero-cards]").waitFor();
      const last = await view.getByTestId("table-slot").nth(3).getByTestId("hero-cards").boundingBox();
      assert.ok(last && last.y + last.height <= 1300, "4 mesas cabem na tela wide");
      await view.screenshot({ path: `${OUT}/95-wide-4-mesas.png` });
      await view.getByRole("button", { name: "2 mesas" }).click();
      await view.getByTestId("table-slot").nth(1).locator("[data-testid=hero-cards]").waitFor();
      await view.screenshot({ path: `${OUT}/96-wide-2-mesas.png` });
      await view.getByRole("button", { name: "1 mesa", exact: true }).click();
      await view.close();
    }

    await capturasComercial(browser).catch((error) => console.error("capturas do comercial falharam:", error.message));

    assert.deepEqual(pageErrors, [], "nenhum erro de JavaScript nas páginas");
    console.log("\nE2E: todos os passos passaram");
  } catch (error) {
    await page.screenshot({ path: `${OUT}/99-erro.png`, fullPage: true }).catch(() => {});
    console.error(`\nURL no erro: ${page.url()}`);
    throw error;
  } finally {
    await browser.close();
  }
}

/** Telas em 1920x1080 para o comercial (não fazem parte do teste: falhas só aparecem no log). */
async function capturasComercial(browser) {
  const dir = `${OUT}/comercial`;
  await mkdir(dir, { recursive: true });
  await mkdir(`${OUT}/fontes`, { recursive: true });
  for (const f of readdirSync(".next/static/media")) if (f.endsWith(".woff2")) copyFileSync(`.next/static/media/${f}`, `${OUT}/fontes/${f}`);
  // Histórico do admin com cara de jogador treinado (~85% de acerto) para as telas de desempenho
  const [admin] = await rows("profiles", "select=id&email=eq.admin@e2e.com");
  const trained = async () => {
    const mine = await rows("attempts", `select=id,data&user_id=eq.${admin.id}&correct=eq.false`);
    await Promise.all(
      mine
        .filter((a) => a.id % 7 !== 0)
        .map((a) =>
          fetch(`${API_URL}/rest/v1/attempts?id=eq.${a.id}`, {
            method: "PATCH",
            headers: adminHeaders,
            body: JSON.stringify({ correct: true, data: { ...a.data, correct: true, chosenActionId: a.data.correctActionId } }),
          }),
        ),
    );
  };
  await trained();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const v = await ctx.newPage();
  const snap = async (name) => {
    await v.evaluate(() => window.scrollTo(0, 0));
    await v.screenshot({ path: `${dir}/${name}.jpg`, type: "jpeg", quality: 92 });
  };
  // Descobre a resposta certa espiando o range (sem contar a decisão) e devolve o índice do botão
  const rightIndex = async () => {
    await v.getByRole("button", { name: "Mostrar resposta" }).click();
    const title = await v.locator("[data-hand].ring-2").first().getAttribute("title");
    await v.getByRole("button", { name: /Resposta à mostra/ }).click();
    const label = title.split(": ")[1].split(" ou ")[0];
    return v.evaluate(
      (l) => [...document.querySelectorAll("[data-testid=actions] button")].findIndex((b) => b.lastChild.textContent.trim() === l),
      label,
    );
  };
  await v.goto(`${BASE_URL}/login`);
  await v.fill("#login", "admin@e2e.com");
  await v.fill("#password", "senha-admin-123");
  await v.getByRole("button", { name: "Entrar" }).click();
  await v.waitForURL(`${BASE_URL}/`);
  await v.waitForTimeout(800);
  await snap("c00-inicio");
  await v.goto(`${BASE_URL}/drills`);
  await v.getByTestId("secao-vanilla").waitFor();
  await snap("c01-drills");
  // Mesa PKO: pergunta, acerto (verde) e erro (vermelho)
  await v.goto(`${BASE_URL}/drills/vs3bet-50bb-pko-coberto/treinar`);
  await v.getByTestId("hero-cards").waitFor();
  await v.waitForTimeout(500);
  await snap("c02-mesa-pergunta");
  for (const [name, right] of [["c03-mesa-certo", true], ["c04-mesa-errado", false]]) {
    await v.getByTestId("hero-cards").waitFor();
    const idx = await rightIndex();
    await v.locator("[data-testid=actions] button").nth(right ? idx : idx === 0 ? 1 : 0).click();
    await v.waitForTimeout(400);
    await snap(name);
    await v.getByRole("button", { name: /Continuar/ }).click();
  }
  await v.goto(`${BASE_URL}/drills/defesa-bb-vanilla-mlr/treinar`);
  await v.getByTestId("hero-cards").waitFor();
  await v.waitForTimeout(400);
  await snap("c05-mesa-mlr");
  await v.goto(`${BASE_URL}/drills/defesa-bb-vanilla-multiway/treinar`);
  await v.getByTestId("hero-cards").waitFor();
  await v.waitForTimeout(400);
  await snap("c06-mesa-multiway");
  await v.goto(`${BASE_URL}/drills/rfi-30bb-vanilla-todas/treinar`);
  await v.getByRole("button", { name: "4 mesas" }).click();
  await v.getByTestId("table-slot").nth(3).locator("[data-testid=hero-cards]").waitFor();
  await v.waitForTimeout(400);
  await snap("c07-4-mesas");
  await v.getByRole("button", { name: "1 mesa", exact: true }).click();
  // Warmup
  await v.goto(`${BASE_URL}/aquecimento`);
  await v.getByRole("button", { name: "Começar" }).waitFor();
  await snap("c08-warmup-inicio");
  await v.getByRole("button", { name: "Começar" }).click();
  await v.waitForTimeout(950);
  await snap("c09-warmup-3");
  await v.getByText("Go!").waitFor();
  await v.waitForTimeout(300);
  await snap("c10-warmup-go");
  await v.getByTestId("warmup-timer").waitFor();
  for (let i = 0; i < 12; i++) {
    await v.getByTestId("hero-cards").waitFor();
    const idx = await rightIndex();
    await v.locator("[data-testid=actions] button").nth(i === 4 ? (idx === 0 ? 1 : 0) : idx).click();
    await v.getByRole("button", { name: /Continuar/ }).click();
  }
  await v.waitForTimeout(400);
  await snap("c11-warmup-treino");
  await v.getByRole("button", { name: "Encerrar sessão" }).click();
  await v.getByTestId("warmup-by-spot").waitFor();
  await v.waitForTimeout(400);
  await snap("c12-warmup-relatorio");
  await trained();
  await v.goto(`${BASE_URL}/desempenho`);
  await v.waitForTimeout(1200);
  await snap("c13-desempenho");
  await v.goto(`${BASE_URL}/plano`);
  await v.waitForTimeout(1200);
  await snap("c14-plano");
  await ctx.close();
  log("capturas do comercial");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
