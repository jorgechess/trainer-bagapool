// Teste de ponta a ponta: sobe o site contra um Supabase local e usa o navegador como um jogador faria.
// Uso: BASE_URL=http://localhost:3000 API_URL=... SERVICE_ROLE_KEY=... node scripts/e2e.mjs
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
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
    assert.equal(await countRows("drills"), 2);
    log("drill novo criado pelo formulário");

    // 7. Treina o drill de duas decisões
    const card = page.locator(".card").filter({ hasText: "RFI até o flop" });
    await card.getByRole("link", { name: "Treinar" }).click();
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    await shot(page, "treino-pergunta");
    let decisions = 0;
    let flopShot = false;
    for (let hand = 0; hand < 8; hand++) {
      for (let guard = 0; guard < 3; guard++) {
        const flop = await page.getByTestId("board").isVisible();
        // Sempre escolhe a última opção (Open shove no pré-flop, Bet 33% no flop)
        const options = page.locator("[data-testid=actions] button:not([disabled])");
        await options.last().click();
        decisions += 1;
        await page.getByRole("button", { name: "Continuar" }).waitFor();
        const feedback = await page.locator("[data-feedback]").getAttribute("data-feedback");
        assert.ok(feedback === "certo" || feedback === "errado", "exercício fica contornado de verde ou vermelho");
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

    // 9b. Carga real: RFI 30bb vanilla (7 posições) e drill com variações
    await page.goto(`${BASE_URL}/admin/importar`);
    await page.locator("textarea").fill(readFileSync("cargas/rfi-30bb-vanilla.json", "utf8"));
    await page.getByText("Tudo certo para importar.").waitFor();
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await page.getByText(/Importado:/).waitFor();
    assert.equal(await countRows("strategies"), 9);
    assert.equal(await countRows("drills"), 3);
    await page.goto(`${BASE_URL}/drills`);
    const rfiCard = page.locator(".card").filter({ hasText: "RFI 30bb vanilla" });
    await rfiCard.getByText("(sorteado)").waitFor();
    await rfiCard.getByRole("link", { name: "Treinar" }).click();
    await page.getByTestId("hero-cards").waitFor();
    await page.getByLabel("Avançar sozinho quando acertar").uncheck();
    const positions = new Set();
    for (let hand = 0; hand < 14; hand++) {
      const spot = await page.getByText(/^RFI · \w+ · 30bb$/).textContent();
      positions.add(spot.split(" · ")[1]);
      await page.locator("[data-testid=actions] button:not([disabled])").first().click();
      await page.getByRole("button", { name: "Continuar" }).click();
    }
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
      await page.getByText("RFI · BTN · 30bb", { exact: true }).waitFor();
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
    await page.waitForTimeout(300);
    assert.equal(await page.getByTestId("table-slot").count(), 1);
    log("treino com 1, 2 e 4 mesas");

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

    // 10. Cadastra pool e jogador
    await page.goto(`${BASE_URL}/admin/jogadores`);
    await page.getByPlaceholder("Nome da nova pool").fill("Pool A");
    await page.getByRole("button", { name: "Criar pool" }).click();
    for (let i = 0; i < 20 && (await countRows("pools", "&name=eq.Pool%20A")) === 0; i++) await page.waitForTimeout(250);
    assert.equal(await countRows("pools", "&name=eq.Pool%20A"), 1);
    const form = page.locator("form").filter({ hasText: "Novo jogador" });
    await form.locator("input").nth(0).fill("Ana Jogadora");
    await form.locator("input").nth(1).fill("ana@e2e.com");
    const password = await form.locator("input").nth(2).inputValue();
    await form.locator("select").nth(1).selectOption({ label: "Pool A" });
    await form.getByRole("button", { name: "Cadastrar" }).click();
    await page.getByText(/Ana Jogadora cadastrado/).waitFor();
    await shot(page, "jogadores");
    const [ana] = await rows("profiles", "select=role,pool_id&email=eq.ana@e2e.com");
    assert.equal(ana.role, "jogador");
    assert.ok(ana.pool_id, "jogadora ficou na pool escolhida");
    await form.locator("input").nth(0).fill("Caio Coach");
    await form.locator("input").nth(1).fill("caio@e2e.com");
    await form.locator("select").nth(0).selectOption({ label: "Coach" });
    await form.getByRole("button", { name: "Cadastrar" }).click();
    await page.getByText(/Caio Coach cadastrado/).waitFor();
    const [caio] = await rows("profiles", "select=role&email=eq.caio@e2e.com");
    assert.equal(caio.role, "coach", "papel escolhido no cadastro é aplicado");
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
    await mobile.getByTestId("hero-cards").waitFor();
    await mobile.screenshot({ path: `${OUT}/90-celular-treino.png`, fullPage: true });
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
