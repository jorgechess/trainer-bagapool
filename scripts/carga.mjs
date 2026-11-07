// Teste de carga: N jogadores simultâneos treinando contra o site + Supabase local do CI.
// Cada jogador entra, abre o treino, manda decisões em lote (5 por envio, como o Trainer), volta para a
// lista de drills e de vez em quando abre o Início e o Desempenho. O tempo entre ações é comprimido
// (~0,3–0,9s), então 100 jogadores aqui equivalem a bem mais jogadores reais.
// Uso: BASE_URL=http://localhost:3001 API_URL=... SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/carga.mjs
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const API_URL = process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const USERS = Number(process.env.CARGA_USUARIOS ?? 100);
const DURATION_S = Number(process.env.CARGA_SEGUNDOS ?? 60);
const RAMP_S = 10;
const DRILL_ID = "rfi-30bb-vanilla-todas";
const PASSWORD = "senha-carga-123";
assert.ok(API_URL && SERVICE_ROLE_KEY && ANON_KEY, "Defina API_URL, SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_ANON_KEY");

const adminHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(300 + Math.random() * 600);

async function rest(path, init = {}) {
  const res = await fetch(`${API_URL}/rest/v1/${path}`, { ...init, headers: { ...adminHeaders, ...init.headers } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function createPlayer(i) {
  const email = `carga${i}@e2e.com`;
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { name: `Carga ${i}` } }),
  });
  if (!res.ok && res.status !== 422) throw new Error(`usuário ${email}: ${res.status} ${await res.text()}`);
  return email;
}

/** Entra pelo mesmo cliente que o site usa e devolve os cookies de sessão. */
async function sessionCookie(email) {
  const jar = new Map();
  const supabase = createServerClient(API_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

const RANKS = "23456789TJQKA";
const SUITS = "shdc";
function randomCards() {
  const deck = [...RANKS].flatMap((r) => [...SUITS].map((s) => r + s));
  const a = deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
  const b = deck[Math.floor(Math.random() * deck.length)];
  return [a, b];
}

const samples = new Map(); // endpoint -> ms[]
let errors = 0;
let requests = 0;
let decisionsSaved = 0;
const errorSamples = [];

async function timed(name, cookie, path, init = {}) {
  const start = performance.now();
  requests++;
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, redirect: "manual", headers: { ...init.headers, cookie } });
    await res.arrayBuffer();
    const ms = performance.now() - start;
    if (!samples.has(name)) samples.set(name, []);
    samples.get(name).push(ms);
    if (res.status >= 300) {
      errors++;
      if (errorSamples.length < 5) errorSamples.push(`${name} → HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    errors++;
    if (errorSamples.length < 5) errorSamples.push(`${name} → ${error.message}`);
    return false;
  }
}

async function player(cookie, strategies, deadline) {
  let round = 0;
  while (Date.now() < deadline) {
    round++;
    await timed("Abrir treino (página)", cookie, `/drills/${DRILL_ID}/treinar`);
    for (let batch = 0; batch < 3 && Date.now() < deadline; batch++) {
      await think();
      const decisions = Array.from({ length: 5 }, () => {
        const s = strategies[Math.floor(Math.random() * strategies.length)];
        return {
          strategyId: s.id,
          heroCards: randomCards(),
          board: [],
          chosenActionId: s.actionIds[Math.floor(Math.random() * s.actionIds.length)],
        };
      });
      const ok = await timed("Gravar lote de 5 decisões (API)", cookie, "/api/decisoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: [{ drillId: DRILL_ID, decisions }] }),
      });
      if (ok) decisionsSaved += decisions.length;
    }
    await think();
    await timed("Lista de drills (página)", cookie, "/drills");
    if (round % 3 === 0) {
      await think();
      await timed("Início (página)", cookie, "/");
      await think();
      await timed("Desempenho (página)", cookie, "/desempenho");
    }
  }
}

function pct(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  // Drill e estratégias reais (as cargas já estão no banco depois do e2e)
  const [drillRow] = await rest(`drills?select=data&id=eq.${DRILL_ID}`);
  assert.ok(drillRow, `drill ${DRILL_ID} no banco`);
  const ids = [...new Set((drillRow.data.variants ?? [drillRow.data.steps]).flat())];
  const strategyRows = await rest(`strategies?select=id,data&id=in.(${ids.join(",")})`);
  const strategies = strategyRows.map((r) => ({ id: r.id, actionIds: r.data.actionIds }));
  assert.ok(strategies.length > 0);

  console.log(`Criando ${USERS} jogadores...`);
  const emails = [];
  for (let i = 0; i < USERS; i += 10) emails.push(...(await Promise.all(Array.from({ length: Math.min(10, USERS - i) }, (_, k) => createPlayer(i + k)))));
  const cookies = [];
  for (let i = 0; i < emails.length; i += 10) cookies.push(...(await Promise.all(emails.slice(i, i + 10).map(sessionCookie))));
  const userIds = (await rest(`profiles?select=id&email=like.carga*%40e2e.com`)).map((p) => p.id);
  const before = await countAttempts(userIds);

  // Aquece o servidor (primeira compilação das rotas, cache do conteúdo)
  await timed("aquecimento", cookies[0], `/drills/${DRILL_ID}/treinar`);
  samples.clear();
  requests = 0;
  errors = 0;

  console.log(`Rodando ${USERS} jogadores por ${DURATION_S}s...`);
  const started = Date.now();
  const deadline = started + DURATION_S * 1000;
  await Promise.all(
    cookies.map(async (cookie, i) => {
      await sleep((i / USERS) * RAMP_S * 1000);
      await player(cookie, strategies, deadline);
    }),
  );
  const elapsed = (Date.now() - started) / 1000;

  await sleep(500);
  const after = await countAttempts(userIds);
  const stored = after - before;

  const lines = [
    `## Teste de carga: ${USERS} jogadores simultâneos por ${DURATION_S}s`,
    "",
    `Requisições: **${requests}** (${(requests / elapsed).toFixed(1)}/s) · erros: **${errors}** (${((errors / Math.max(requests, 1)) * 100).toFixed(2)}%)`,
    `Decisões gravadas: **${stored}** (${(stored / elapsed).toFixed(1)}/s) · confirmadas pela API: ${decisionsSaved}`,
    "",
    "| Rota | Chamadas | p50 | p95 | p99 | máx |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  const summary = {};
  for (const [name, list] of samples) {
    const sorted = [...list].sort((a, b) => a - b);
    const f = (x) => `${Math.round(x)} ms`;
    lines.push(`| ${name} | ${sorted.length} | ${f(pct(sorted, 50))} | ${f(pct(sorted, 95))} | ${f(pct(sorted, 99))} | ${f(sorted.at(-1))} |`);
    summary[name] = { calls: sorted.length, p50: pct(sorted, 50), p95: pct(sorted, 95) };
  }
  if (errorSamples.length) lines.push("", "Exemplos de erro: " + errorSamples.join("; "));
  lines.push("", "_CI: servidor Next único (`next start`) e Supabase em Docker no mesmo runner de 2 vCPUs; na Vercel cada função escala sozinha._");
  const report = lines.join("\n");
  console.log(report);
  mkdirSync("e2e/screenshots", { recursive: true });
  writeFileSync("e2e/screenshots/carga.md", report + "\n");
  writeFileSync("e2e/screenshots/carga.json", JSON.stringify({ users: USERS, seconds: DURATION_S, requests, errors, stored, summary }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");

  assert.ok(errors / Math.max(requests, 1) < 0.01, `erros acima de 1% (${errors}/${requests})`);
  assert.equal(stored, decisionsSaved, "toda decisão confirmada pela API está no banco");
  const apiP95 = summary["Gravar lote de 5 decisões (API)"]?.p95 ?? 0;
  assert.ok(apiP95 < 10_000, `p95 da gravação acima de 10s (${Math.round(apiP95)} ms)`);
}

async function countAttempts(userIds) {
  const res = await fetch(`${API_URL}/rest/v1/attempts?select=id&user_id=in.(${userIds.join(",")})`, {
    headers: { ...adminHeaders, Prefer: "count=exact", Range: "0-0" },
  });
  return Number((res.headers.get("content-range") ?? "*/0").split("/")[1]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
