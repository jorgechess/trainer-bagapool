import { test } from "node:test";
import assert from "node:assert/strict";
import { knownPot, tableSeats } from "../table";
import { cbetFlop, rfiBtn } from "./fixtures";

test("RFI do BTN: quem age antes foldou, blinds esperam com as fichas", () => {
  const seats = tableSeats(rfiBtn);
  const by = Object.fromEntries(seats.map((s) => [s.position, s]));
  for (const p of ["UTG", "UTG1", "MP", "LJ", "HJ", "CO"]) assert.equal(by[p].status, "folded", p);
  assert.equal(by.BTN.status, "hero");
  assert.equal(by.BTN.isButton, true);
  assert.equal(by.BTN.offset, 0);
  assert.equal(by.SB.status, "waiting");
  assert.equal(by.SB.posted, 0.5);
  assert.equal(by.BB.posted, 1);
  assert.equal(by.SB.offset, 1);
  assert.equal(by.UTG.offset, 3);
  assert.equal(knownPot(rfiBtn), 1.5);
});

test("RFI do UTG: ninguém foldou ainda", () => {
  const seats = tableSeats({ ...rfiBtn, heroPosition: "UTG" });
  assert.ok(seats.filter((s) => s.status !== "hero").every((s) => s.status === "waiting"));
});

test("vilão que aumentou aparece como raise; pós-flop só herói e vilão", () => {
  const vsRfi = tableSeats({ ...rfiBtn, heroPosition: "BB", villainPosition: "CO" });
  assert.equal(vsRfi.find((s) => s.position === "CO")!.status, "raised");
  assert.equal(vsRfi.find((s) => s.position === "BTN")!.status, "folded");
  assert.equal(knownPot({ ...rfiBtn, villainPosition: "CO" }), null);
  const post = tableSeats(cbetFlop);
  assert.deepEqual(
    post.filter((s) => s.status !== "folded").map((s) => [s.position, s.status]),
    [
      ["BTN", "hero"],
      ["BB", "active"],
    ],
  );
  assert.ok(post.every((s) => s.posted === 0));
  assert.equal(knownPot(cbetFlop), null);
});
