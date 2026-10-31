import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTINUE_COMMAND,
  DEFAULT_BINDINGS,
  assignBinding,
  clearBinding,
  commandFor,
  inputLabel,
  isReservedInput,
  keyInput,
  mouseInput,
  parseBindings,
} from "../../shortcuts";

test("entradas de teclado e mouse e seus nomes", () => {
  assert.equal(keyInput({ code: "KeyE" }), "key:KeyE");
  assert.equal(mouseInput({ button: 3 }), "mouse:3");
  assert.equal(inputLabel("key:KeyE"), "E");
  assert.equal(inputLabel("key:Digit2"), "2");
  assert.equal(inputLabel("key:Space"), "Espaço");
  assert.equal(inputLabel("mouse:3"), "Mouse lateral (voltar)");
  assert.equal(inputLabel("mouse:4"), "Mouse lateral (avançar)");
  assert.equal(inputLabel("mouse:7"), "Botão 7 do mouse");
  assert.equal(inputLabel(undefined), "—");
  assert.ok(isReservedInput("mouse:0"));
  assert.ok(!isReservedInput("mouse:3"));
});

test("uma entrada fica só com um comando", () => {
  let b = assignBinding({}, "fold", "mouse:3");
  b = assignBinding(b, CONTINUE_COMMAND, "key:KeyE");
  assert.equal(commandFor(b, "mouse:3"), "fold");
  assert.equal(commandFor(b, "key:KeyE"), CONTINUE_COMMAND);
  b = assignBinding(b, "rfi", "mouse:3");
  assert.equal(commandFor(b, "mouse:3"), "rfi");
  assert.equal(b.fold, undefined, "fold perdeu o atalho que foi para o raise");
  b = assignBinding(b, "rfi", "key:KeyR");
  assert.equal(commandFor(b, "mouse:3"), undefined, "comando troca de atalho");
  assert.deepEqual(clearBinding(b, "rfi"), { [CONTINUE_COMMAND]: "key:KeyE" });
  assert.equal(commandFor(b, "key:KeyZ"), undefined);
});

test("leitura do que foi salvo tolera dados inválidos", () => {
  assert.deepEqual(parseBindings(null), DEFAULT_BINDINGS);
  assert.deepEqual(parseBindings("lixo"), DEFAULT_BINDINGS);
  assert.deepEqual(parseBindings("[1,2]"), DEFAULT_BINDINGS);
  assert.deepEqual(
    parseBindings(JSON.stringify({ fold: "mouse:3", rfi: 5, x: "teclado", y: "mouse:0" })),
    { fold: "mouse:3" },
  );
});
