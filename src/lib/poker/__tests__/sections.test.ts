import { test } from "node:test";
import assert from "node:assert/strict";
import { drillSection } from "../sections";
import { cbetFlop, preflopDrill, rfiBtn } from "./fixtures";

test("seções da tela de drills: pós-flop, BW, PKO, vanilla e outros", () => {
  const map = (...list: (typeof rfiBtn)[]) => new Map(list.map((s) => [s.id, s]));
  const drill = { ...preflopDrill, steps: [rfiBtn.id], variants: undefined, tags: [] as string[] };
  assert.equal(drillSection({ ...drill, tags: ["vanilla"] }, map(rfiBtn)), "vanilla");
  assert.equal(drillSection({ ...drill, tags: ["pko"] }, map(rfiBtn)), "pko");
  assert.equal(drillSection(drill, map({ ...rfiBtn, pko: { coverage: "coberto" } })), "pko");
  // BW vale tanto para PKO quanto para vanilla
  assert.equal(drillSection({ ...drill, tags: ["pko", "bw"] }, map(rfiBtn)), "bw");
  assert.equal(drillSection({ ...drill, tags: ["vanilla", "BW"] }, map(rfiBtn)), "bw");
  // qualquer decisão depois do pré-flop leva para Pós-flop
  assert.equal(drillSection({ ...drill, steps: [rfiBtn.id, cbetFlop.id], tags: ["pko"] }, map(rfiBtn, cbetFlop)), "pos-flop");
  assert.equal(drillSection(drill, map(rfiBtn)), "outros");
});
