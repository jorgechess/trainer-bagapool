import { test } from "node:test";
import assert from "node:assert/strict";
import { type SendResult, type Submission, createDecisionQueue } from "../../decision-queue";

const decision = (n: number) => ({ strategyId: `s${n}`, heroCards: ["As", "Kd"], board: [], chosenActionId: "rfi" });
const hand = (n: number, drillId = "d1"): Submission => ({ drillId, decisions: [decision(n)] });

function setup(opts: { batchSize?: number; tab?: string; shared?: { value: string | null } } = {}) {
  const shared = opts.shared ?? { value: null };
  const sent: Submission[][] = [];
  let fail = false;
  let clock = 1_000;
  let gate: Promise<void> | null = null;
  const statuses: (string | null)[] = [];
  const queue = createDecisionQueue({
    storage: { get: () => shared.value, set: (v) => (shared.value = v) },
    tabId: opts.tab ?? "aba1",
    batchSize: opts.batchSize ?? 5,
    now: () => clock,
    onStatus: (s) => statuses.push(s),
    send: async (subs): Promise<SendResult> => {
      if (gate) await gate;
      if (fail) return { ok: false, error: "Sem conexão." };
      sent.push(subs);
      return { ok: true };
    },
  });
  return {
    queue,
    shared,
    sent,
    statuses,
    setFail: (f: boolean) => (fail = f),
    tick: (ms: number) => (clock += ms),
    hold: () => {
      let release!: () => void;
      gate = new Promise((r) => (release = r));
      return () => {
        gate = null;
        release();
      };
    },
  };
}

test("fila de decisões: junta até o lote e envia numa requisição só", async () => {
  const t = setup();
  for (let i = 0; i < 4; i++) t.queue.add(hand(i));
  assert.equal(t.sent.length, 0);
  assert.equal(t.queue.pendingDecisions(), 4);
  t.queue.add(hand(4));
  await t.queue.flush();
  assert.equal(t.sent.length, 1, "5 mãos = 1 requisição");
  assert.equal(t.sent[0].length, 5);
  assert.equal(t.queue.pendingDecisions(), 0);
  assert.equal(t.shared.value, "[]");
});

test("fila de decisões: sem conexão, guarda e manda depois", async () => {
  const t = setup({ batchSize: 1 });
  t.setFail(true);
  t.queue.add(hand(1));
  await t.queue.flush();
  assert.equal(t.queue.pendingDecisions(), 1);
  assert.match(t.statuses.at(-1) ?? "", /Vamos tentar de novo/);
  t.setFail(false);
  await t.queue.flush();
  assert.equal(t.sent.length, 1);
  assert.equal(t.queue.pendingDecisions(), 0);
  assert.equal(t.statuses.at(-1), null);
});

test("fila de decisões: não reenvia o que está a caminho e pega o que chegou durante o envio", async () => {
  const t = setup({ batchSize: 100 });
  t.queue.add(hand(1));
  const release = t.hold();
  const first = t.queue.flush();
  t.queue.add(hand(2));
  const second = t.queue.flush();
  assert.equal(first, second, "um envio por vez");
  release();
  await first;
  assert.deepEqual(
    t.sent.map((b) => b.map((s) => s.decisions[0].strategyId)),
    [["s1"], ["s2"]],
  );
});

test("fila de decisões: outra aba só adota itens velhos (aba fechada)", async () => {
  const shared = { value: null as string | null };
  const a = setup({ tab: "a", batchSize: 100, shared });
  a.queue.add(hand(1));
  const b = setup({ tab: "b", batchSize: 100, shared });
  await b.queue.flush();
  assert.equal(b.sent.length, 0, "item recente da outra aba fica com ela");
  b.tick(31_000);
  await b.queue.flush();
  assert.equal(b.sent.length, 1, "depois de 30s a aba b envia a sobra");
  assert.equal(shared.value, "[]");
});

test("fila de decisões: storage corrompido não trava o treino", async () => {
  const t = setup({ shared: { value: "{quebrado" }, batchSize: 1 });
  t.queue.add(hand(1));
  await t.queue.flush();
  assert.equal(t.sent.length, 1);
});
