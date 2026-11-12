"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { createDrillRequest } from "@/app/(app)/drills/novo/actions";

const MAX_IMAGES = 6;
const MAX_SIDE = 2200;
const MAX_BYTES = 1_600_000;

interface Shot {
  mime: "image/png" | "image/jpeg" | "image/webp";
  data: string;
  url: string;
}

/** Lê a imagem e, se for enorme, reduz o lado maior para 2200px (PNG, sem perder as cores dos ranges). */
async function readImage(file: File): Promise<Shot | string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return `${file.name}: use PNG, JPG ou WebP.`;
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  let out = url;
  let mime = file.type as Shot["mime"];
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  if (scale < 1 || file.size > MAX_BYTES) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    out = canvas.toDataURL("image/png");
    mime = "image/png";
    // Ainda grande (foto, por exemplo): JPEG de boa qualidade
    if (out.length * 0.75 > MAX_BYTES) {
      out = canvas.toDataURL("image/jpeg", 0.9);
      mime = "image/jpeg";
    }
  }
  const data = out.slice(out.indexOf(",") + 1);
  if (data.length * 0.75 > MAX_BYTES) return `${file.name}: imagem grande demais (máx. ~1,6 MB).`;
  return { mime, data, url: out };
}

export function DrillRequestForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(files: File[]) {
    const room = MAX_IMAGES - shots.length;
    if (room <= 0) {
      setMessage({ ok: false, text: `Até ${MAX_IMAGES} prints por pedido.` });
      return;
    }
    const read = await Promise.all(files.slice(0, room).map(readImage));
    const errors = read.filter((r): r is string => typeof r === "string");
    setShots((current) => [...current, ...read.filter((r): r is Shot => typeof r !== "string")].slice(0, MAX_IMAGES));
    setMessage(errors.length ? { ok: false, text: errors.join(" ") } : null);
  }

  // Ctrl+V de um print cola direto no pedido
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createDrillRequest({
        title,
        description,
        images: shots.map(({ mime, data }) => ({ mime, data })),
      });
      if (result.ok) {
        setTitle("");
        setDescription("");
        setShots([]);
        setMessage({ ok: true, text: "Pedido enviado! Os pedidos são analisados toda semana." });
      } else setMessage({ ok: false, text: result.error });
    });
  }

  return (
    <form className="card space-y-4" onSubmit={submit} data-testid="pedido-drill">
      <label className="block space-y-1">
        <span className="label">Nome do drill</span>
        <input
          className="input w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Squeeze do BTN vs open e call"
          maxLength={120}
          required
        />
      </label>
      <label className="block space-y-1">
        <span className="label">Apresente o drill</span>
        <textarea
          className="input min-h-36 w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qual spot, posições, stacks, o que você quer treinar e de onde vem a estratégia (aula, HRC, GTO Wizard...)."
          maxLength={4000}
          required
        />
      </label>
      <div className="space-y-2">
        <span className="label">Prints da estratégia (opcional)</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()} disabled={shots.length >= MAX_IMAGES}>
            Adicionar prints
          </button>
          <span className="text-xs text-zinc-500">ou cole com Ctrl+V · até {MAX_IMAGES} · PNG de preferência, sem passar pelo WhatsApp</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            data-testid="pedido-arquivos"
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </div>
        {shots.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="pedido-prints">
            {shots.map((s, i) => (
              <li key={i} className="relative overflow-hidden rounded-md border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={`Print ${i + 1}`} className="h-32 w-full object-contain bg-black" />
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded bg-black/80 px-2 py-0.5 text-xs text-zinc-200 hover:bg-red-900"
                  onClick={() => setShots((current) => current.filter((_, j) => j !== i))}
                  aria-label={`Remover print ${i + 1}`}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {message && (
        <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`} role="status">
          {message.text}
        </p>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}
