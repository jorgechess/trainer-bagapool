import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWarmupDrill } from "../../warmup";
import { preflopDrill } from "./fixtures";

test("aquecimento mistura drills com peso parecido e lembra o drill de origem", () => {
  const big = { ...preflopDrill, id: "big", variants: Array.from({ length: 120 }, (_, i) => [`b${i}`]), steps: ["b0"] };
  const small = { ...preflopDrill, id: "small", variants: [["s1"], ["s2"]], steps: ["s1"] };
  const { drill, sourceDrillOf } = buildWarmupDrill([big, small]);
  const fromSmall = drill.variants!.filter((v) => v[0].startsWith("s")).length;
  assert.equal(fromSmall, 60, "drill pequeno repetido até 60 variações");
  assert.equal(drill.variants!.length, 180);
  assert.equal(sourceDrillOf.s2, "small");
  assert.equal(sourceDrillOf.b7, "big");
});
