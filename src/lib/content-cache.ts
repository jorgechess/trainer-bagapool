/**
 * Cache em memória do conteúdo do time (estratégias, drills e legenda), por instância do servidor.
 *
 * O conteúdo só muda quando sai uma carga nova ou quando alguém edita pelo app, mas era lido inteiro do
 * banco a cada página (1000+ estratégias). Aqui ele fica pronto na memória e a cada `checkMs` uma consulta
 * mínima confere a versão no banco; se mudou, recarrega. `maxAgeMs` força a releitura de tempos em tempos
 * (edições feitas direto no banco, fora do app). Leituras simultâneas compartilham a mesma carga.
 */
export interface ContentCacheOptions<T> {
  load: () => Promise<T>;
  readVersion: () => Promise<string>;
  now?: () => number;
  checkMs?: number;
  maxAgeMs?: number;
}

export interface ContentCache<T> {
  get: () => Promise<T>;
  /** Descarta o que está na memória: a próxima leitura vai ao banco. */
  invalidate: () => void;
}

export function createContentCache<T>(options: ContentCacheOptions<T>): ContentCache<T> {
  const now = options.now ?? Date.now;
  const checkMs = options.checkMs ?? 30_000;
  const maxAgeMs = options.maxAgeMs ?? 10 * 60_000;
  let entry: { value: T; version: string; loadedAt: number; checkedAt: number } | null = null;
  let pending: Promise<T> | null = null;
  let generation = 0;

  async function reload(): Promise<T> {
    const gen = generation;
    const [version, value] = await Promise.all([options.readVersion().catch(() => ""), options.load()]);
    // Invalidado durante a leitura: não guarda o que pode estar velho
    if (gen === generation) entry = { value, version, loadedAt: now(), checkedAt: now() };
    return value;
  }

  async function refresh(): Promise<T> {
    const current = entry;
    if (current && now() - current.loadedAt < maxAgeMs) {
      try {
        const version = await options.readVersion();
        if (version === current.version && entry === current) {
          current.checkedAt = now();
          return current.value;
        }
      } catch {
        // Banco instável: segue com o que tem e tenta de novo na próxima janela
        current.checkedAt = now();
        return current.value;
      }
    }
    return reload();
  }

  return {
    async get() {
      if (entry && now() - entry.checkedAt < checkMs && now() - entry.loadedAt < maxAgeMs) return entry.value;
      pending ??= refresh().finally(() => {
        pending = null;
      });
      return pending;
    },
    invalidate() {
      entry = null;
      pending = null;
      generation++;
    },
  };
}
