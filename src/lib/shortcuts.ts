/**
 * Atalhos do treino, definidos por cada jogador: uma tecla ou um botão do mouse para cada comando.
 * Entradas: "key:KeyE", "key:Space", "mouse:3" (botão lateral voltar), "mouse:4" (lateral avançar)...
 */

export const CONTINUE_COMMAND = "continuar";
export const PEEK_COMMAND = "mostrar-resposta";

/** Comando → entrada. Comandos são ids de ações da legenda ou os comandos acima. */
export type Bindings = Record<string, string>;

export const SHORTCUTS_KEY = "trainer:atalhos";

export const DEFAULT_BINDINGS: Bindings = { [CONTINUE_COMMAND]: "key:Enter" };

export function keyInput(event: { code: string }): string {
  return `key:${event.code}`;
}

export function mouseInput(event: { button: number }): string {
  return `mouse:${event.button}`;
}

/** Botões que não podem virar atalho (clique normal). */
export function isReservedInput(input: string): boolean {
  return input === "mouse:0" || input === "key:Escape" || input === "key:Tab";
}

const MOUSE_LABELS: Record<string, string> = {
  "0": "Clique esquerdo",
  "1": "Botão do meio",
  "2": "Clique direito",
  "3": "Mouse lateral (voltar)",
  "4": "Mouse lateral (avançar)",
};

/** Nome legível da entrada: "E", "Espaço", "Mouse lateral (voltar)". */
export function inputLabel(input: string | undefined): string {
  if (!input) return "—";
  const [type, value] = [input.slice(0, input.indexOf(":")), input.slice(input.indexOf(":") + 1)];
  if (type === "mouse") return MOUSE_LABELS[value] ?? `Botão ${value} do mouse`;
  if (type !== "key") return input;
  if (value.startsWith("Key")) return value.slice(3);
  if (value.startsWith("Digit")) return value.slice(5);
  if (value.startsWith("Numpad")) return `Num ${value.slice(6)}`;
  const names: Record<string, string> = {
    Space: "Espaço",
    Enter: "Enter",
    Backspace: "Backspace",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "Shift esq.",
    ShiftRight: "Shift dir.",
    ControlLeft: "Ctrl esq.",
    ControlRight: "Ctrl dir.",
    Semicolon: ";",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Quote: "'",
    Backquote: "`",
  };
  return names[value] ?? value;
}

/** Atribui a entrada ao comando, tirando-a de qualquer outro comando (uma entrada = um comando). */
export function assignBinding(bindings: Bindings, command: string, input: string): Bindings {
  const next: Bindings = {};
  for (const [cmd, value] of Object.entries(bindings)) if (value !== input && cmd !== command) next[cmd] = value;
  next[command] = input;
  return next;
}

export function clearBinding(bindings: Bindings, command: string): Bindings {
  const next = { ...bindings };
  delete next[command];
  return next;
}

/** Comando ligado a uma entrada, ou undefined. */
export function commandFor(bindings: Bindings, input: string): string | undefined {
  return Object.entries(bindings).find(([, value]) => value === input)?.[0];
}

export function parseBindings(raw: string | null): Bindings {
  if (!raw) return { ...DEFAULT_BINDINGS };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ...DEFAULT_BINDINGS };
    const result: Bindings = {};
    for (const [command, input] of Object.entries(parsed)) {
      if (typeof input === "string" && /^(key|mouse):.+$/.test(input) && !isReservedInput(input)) result[command] = input;
    }
    return result;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

const MOUSE_SHORT: Record<string, string> = { "1": "Meio", "2": "Dir.", "3": "Lat.1", "4": "Lat.2" };

/** Nome curto para mostrar dentro dos botões do treino. */
export function inputShortLabel(input: string | undefined): string {
  if (!input) return "";
  if (input.startsWith("mouse:")) return MOUSE_SHORT[input.slice(6)] ?? `M${input.slice(6)}`;
  return inputLabel(input);
}

/** Campos onde o jogador digita: teclas ali não disparam atalhos. */
export function isTypingTarget(target: { tagName?: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (target.tagName !== "INPUT") return false;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes((target.type ?? "text").toLowerCase());
}
