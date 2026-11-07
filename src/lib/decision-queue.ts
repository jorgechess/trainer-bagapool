/**
 * Fila de decisões do treino: o navegador junta as mãos e grava no banco em lote, em vez de uma escrita
 * por clique. Envia quando junta `batchSize` decisões, no timer do Trainer, ao terminar a sessão e ao sair
 * da página. A fila fica no localStorage: se a internet cair ou a aba fechar, as decisões vão depois.
 * Itens de outra aba só são adotados quando ficam velhos (a outra aba provavelmente fechou).
 */
export interface QueuedDecision {
  strategyId: string;
  heroCards: string[];
  board: string[];
  chosenActionId: string;
}

export interface Submission {
  drillId: string;
  decisions: QueuedDecision[];
}

export interface QueuedSubmission extends Submission {
  id: string;
  tab: string;
  at: number;
}

export interface QueueStorage {
  get(): string | null;
  set(value: string): void;
}

export type SendResult = { ok: true } | { ok: false; error: string };

export interface DecisionQueueOptions {
  storage: QueueStorage;
  send: (submissions: Submission[], options: { keepalive: boolean }) => Promise<SendResult>;
  tabId: string;
  batchSize?: number;
  /** Itens de outra aba mais velhos que isso são adotados por esta. */
  orphanMs?: number;
  /** Máximo de envios por requisição. */
  maxPerRequest?: number;
  now?: () => number;
  onStatus?: (error: string | null) => void;
}

export const QUEUE_STORAGE_KEY = "trainer:fila-decisoes";

export function createDecisionQueue(options: DecisionQueueOptions) {
  const now = options.now ?? Date.now;
  const batchSize = Math.max(1, options.batchSize ?? 5);
  const orphanMs = options.orphanMs ?? 30_000;
  const maxPerRequest = options.maxPerRequest ?? 40;
  let seq = 0;
  let inFlight: Promise<void> | null = null;
  /** Ids sendo enviados por esta aba agora (não reenviar em paralelo). */
  const sending = new Set<string>();

  function read(): QueuedSubmission[] {
    try {
      const parsed = JSON.parse(options.storage.get() ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function write(items: QueuedSubmission[]) {
    try {
      options.storage.set(JSON.stringify(items));
    } catch {
      // Storage cheio ou bloqueado: segue só com o envio
    }
  }

  function mine(items: QueuedSubmission[]): QueuedSubmission[] {
    return items.filter((s) => !sending.has(s.id) && (s.tab === options.tabId || now() - s.at > orphanMs));
  }

  function pendingDecisions(): number {
    return mine(read()).reduce((n, s) => n + s.decisions.length, 0);
  }

  async function sendOnce(keepalive: boolean) {
    const batch = mine(read()).slice(0, maxPerRequest);
    if (!batch.length) return;
    for (const s of batch) sending.add(s.id);
    let result: SendResult;
    try {
      result = await options.send(
        batch.map(({ drillId, decisions }) => ({ drillId, decisions })),
        { keepalive },
      );
    } catch {
      result = { ok: false, error: "Sem conexão." };
    }
    for (const s of batch) sending.delete(s.id);
    if (result.ok) {
      const sent = new Set(batch.map((s) => s.id));
      write(read().filter((s) => !sent.has(s.id)));
      options.onStatus?.(null);
    } else {
      options.onStatus?.(`Não foi possível salvar algumas decisões (${result.error}). Vamos tentar de novo.`);
      throw new Error(result.error);
    }
  }

  /** Envia tudo o que é desta aba (em lotes de até maxPerRequest). */
  function flush({ keepalive = false }: { keepalive?: boolean } = {}): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        while (mine(read()).length) await sendOnce(keepalive);
      } catch {
        // Fica na fila para a próxima tentativa
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function add(submission: Submission) {
    if (!submission.decisions.length) return;
    const item: QueuedSubmission = { ...submission, id: `${options.tabId}-${now()}-${seq++}`, tab: options.tabId, at: now() };
    write([...read(), item]);
    if (pendingDecisions() >= batchSize) void flush();
  }

  return { add, flush, pendingDecisions };
}

export type DecisionQueue = ReturnType<typeof createDecisionQueue>;
