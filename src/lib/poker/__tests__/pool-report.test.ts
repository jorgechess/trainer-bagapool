import { test } from "node:test";
import assert from "node:assert/strict";
import { poolSummary } from "../pool-report";
import type { Attempt } from "../drill";

const at = (drillId: string, correct: boolean, createdAt = "2026-11-01T10:00:00Z") =>
  ({ drillId, correct, createdAt }) as Attempt;

test("pool: soma decisões, acerto por drill e ranking dos jogadores", () => {
  const players = [
    { id: "ana", name: "Ana", poolId: "a" },
    { id: "beto", name: "Beto", poolId: "a" },
    { id: "caio", name: "Caio", poolId: "a" },
    { id: "zeca", name: "Zeca", poolId: "b" },
  ];
  const attempts = new Map<string, Attempt[]>([
    ["ana", [at("rfi", true), at("rfi", true), at("bw", false, "2026-11-03T10:00:00Z")]],
    ["beto", [at("rfi", false)]],
    ["zeca", [at("rfi", true)]],
  ]);
  const s = poolSummary("a", players, attempts);
  assert.equal(s.players, 3);
  assert.equal(s.active, 2);
  assert.equal(s.total, 4);
  assert.equal(s.accuracy, 0.5);
  assert.deepEqual(
    s.drills.map((d) => [d.drillId, d.total, d.accuracy, d.players]),
    [
      ["bw", 1, 0, 1],
      ["rfi", 3, 2 / 3, 2],
    ],
  );
  assert.deepEqual(s.ranking.map((r) => r.id), ["ana", "beto", "caio"]);
  assert.equal(s.ranking[0].lastAt, "2026-11-03T10:00:00Z");
  assert.equal(s.ranking[2].lastAt, null);
});
