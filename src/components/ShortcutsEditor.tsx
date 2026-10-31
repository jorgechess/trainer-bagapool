"use client";

import { useEffect, useState } from "react";
import { type Legend, textColorFor } from "@/lib/poker/legend";
import {
  type Bindings,
  CONTINUE_COMMAND,
  PEEK_COMMAND,
  SHORTCUTS_KEY,
  assignBinding,
  clearBinding,
  inputLabel,
  isReservedInput,
  keyInput,
  mouseInput,
  parseBindings,
} from "@/lib/shortcuts";

function save(bindings: Bindings) {
  try {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(bindings));
  } catch {
    // armazenamento indisponível
  }
}

export function ShortcutsEditor({ legend }: { legend: Legend }) {
  const [bindings, setBindings] = useState<Bindings>({});
  const [capturing, setCapturing] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SHORTCUTS_KEY);
    } catch {
      // segue com o padrão
    }
    setBindings(parseBindings(raw));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const command = capturing;
    function finish(input: string) {
      if (isReservedInput(input)) {
        setCapturing(null);
        return;
      }
      setBindings((current) => {
        const next = assignBinding(current, command, input);
        save(next);
        return next;
      });
      setCapturing(null);
    }
    function onKey(event: KeyboardEvent) {
      event.preventDefault();
      finish(keyInput(event));
    }
    function onMouse(event: MouseEvent) {
      if (event.button === 0) return; // clique esquerdo usa a tela normalmente
      event.preventDefault();
      finish(mouseInput(event));
    }
    // Impede que os botões laterais do mouse voltem/avancem a página enquanto captura
    function block(event: MouseEvent) {
      if (event.button === 3 || event.button === 4) event.preventDefault();
    }
    const noMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("mouseup", block, true);
    window.addEventListener("contextmenu", noMenu, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("mouseup", block, true);
      window.removeEventListener("contextmenu", noMenu, true);
    };
  }, [capturing]);

  const rows: { command: string; label: string; color?: string }[] = [
    ...legend.map((a) => ({ command: a.id, label: a.label, color: a.color })),
    { command: CONTINUE_COMMAND, label: "Continuar (próxima decisão ou mão)" },
    { command: PEEK_COMMAND, label: "Mostrar / esconder resposta" },
  ];

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-zinc-800 p-0">
        {rows.map((row) => (
          <div key={row.command} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`atalho-${row.command}`}>
            <span className="flex-1 text-sm">
              {row.color ? (
                <span
                  className="rounded-md px-2 py-1 text-xs font-semibold"
                  style={{ backgroundColor: row.color, color: textColorFor(row.color) }}
                >
                  {row.label}
                </span>
              ) : (
                row.label
              )}
            </span>
            <span className="min-w-40 rounded-md border border-zinc-700 bg-black/50 px-3 py-1.5 text-center font-mono text-sm">
              {capturing === row.command ? (
                <span className="text-baga-red">Pressione a tecla ou o botão…</span>
              ) : loaded ? (
                inputLabel(bindings[row.command])
              ) : (
                "…"
              )}
            </span>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5"
              onClick={() => setCapturing(capturing === row.command ? null : row.command)}
            >
              {capturing === row.command ? "Cancelar" : "Definir"}
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5"
              disabled={!bindings[row.command]}
              onClick={() =>
                setBindings((current) => {
                  const next = clearBinding(current, row.command);
                  save(next);
                  return next;
                })
              }
            >
              Limpar
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Sem atalho definido, os números 1, 2, 3… escolhem as ações na ordem dos botões. Esc cancela a captura. Um
        atalho só pode ter um comando: se você reusar uma tecla, ela sai do comando antigo.
      </p>
    </div>
  );
}
