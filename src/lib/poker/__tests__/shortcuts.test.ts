import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTINUE_COMMAND,
  DEFAULT_BINDINGS,
  effectiveInputs,
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
  assert.equal(keyInput({ code: "Numpad1" }), "key:Digit1", "1 do teclado numérico = 1 de cima");
  assert.equal(keyInput({ code: "NumpadEnter" }), "key:Enter", "Enter do teclado numérico = Enter");
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
  assert.deepEqual(parseBindings(JSON.stringify({ rfi: "key:Numpad1", continuar: "key:NumpadEnter" })), {
    rfi: "key:Digit1",
    continuar: "key:Enter",
  });
});

test("nomes curtos e campos de digitação", async () => {
  const { inputShortLabel, isTypingTarget } = await import("../../shortcuts");
  assert.equal(inputShortLabel("mouse:3"), "Lat.1");
  assert.equal(inputShortLabel("mouse:1"), "Meio");
  assert.equal(inputShortLabel("key:KeyF"), "F");
  assert.equal(inputShortLabel(undefined), "");
  assert.ok(isTypingTarget({ tagName: "INPUT", type: "text" }));
  assert.ok(isTypingTarget({ tagName: "INPUT" }));
  assert.ok(isTypingTarget({ tagName: "TEXTAREA" }));
  assert.ok(!isTypingTarget({ tagName: "INPUT", type: "checkbox" }));
  assert.ok(!isTypingTarget({ tagName: "BUTTON" }));
  assert.ok(!isTypingTarget(null));
});

test("uma tecla nunca vale para dois botões: números padrão pulam teclas que já são atalho", () => {
  const options = ["fold", "call", "4bet", "shove"];
  // Caso do print: fold no X e all-in no 2; call não pode mostrar o 2
  const keys = effectiveInputs(options, { fold: "key:KeyX", shove: "key:Digit2" });
  assert.deepEqual(keys, { fold: "key:KeyX", shove: "key:Digit2", call: "key:Digit1", "4bet": "key:Digit3" });
  const values = Object.values(keys);
  assert.equal(new Set(values).size, values.length);
  // Sem atalhos: ordem dos botões
  assert.deepEqual(effectiveInputs(options, {}), { fold: "key:Digit1", call: "key:Digit2", "4bet": "key:Digit3", shove: "key:Digit4" });
  // Número que é atalho de uma ação ausente no spot também fica reservado
  assert.equal(effectiveInputs(["fold", "rfi"], { shove: "key:Digit1" }).fold, "key:Digit2");
});
