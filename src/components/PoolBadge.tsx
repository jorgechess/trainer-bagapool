import { BAGA_MARKS, IMAGE_LOGOS, initials } from "@/lib/pools";

export interface PoolLook {
  name: string;
  color: string;
  logo: string | null;
}

/** Cruz de naipes que fica em cima do "BAGA" nos logos das pools. */
function SuitCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" style={{ width: "34%", height: "auto" }}>
      <path d="M8 8l24 24M32 8L8 32" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <g fill="none" stroke="currentColor" strokeWidth="1.2" fontSize="11" textAnchor="middle" dominantBaseline="central">
        <text x="20" y="6">♥</text>
        <text x="6" y="20">♠</text>
        <text x="34" y="20">♣</text>
        <text x="20" y="34">♦</text>
      </g>
    </svg>
  );
}

/** Logo grande da pool. */
export function PoolLogo({ pool, size = 96, mini = false }: { pool: PoolLook; size?: number; mini?: boolean }) {
  if (pool.logo && BAGA_MARKS[pool.logo]) {
    return (
      <div
        className="flex flex-col items-center justify-center leading-none text-white"
        style={{ width: size, height: size }}
        aria-label={pool.name}
      >
        {!mini && <SuitCross className="text-white/80" />}
        <span className="font-black tracking-tight" style={{ fontSize: size * (mini ? 0.34 : 0.27) }}>
          BAGA
        </span>
        <span
          className="font-marker -mt-[0.1em] -rotate-6"
          style={{ fontSize: size * (mini ? 0.3 : 0.24), color: pool.color }}
        >
          {BAGA_MARKS[pool.logo]}
        </span>
      </div>
    );
  }
  if (pool.logo && IMAGE_LOGOS[pool.logo]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={IMAGE_LOGOS[pool.logo]} alt={pool.name} width={size} height={size} className="object-contain" />
    );
  }
  return (
    <div
      className="font-display flex items-center justify-center rounded-full border-2 bg-black"
      style={{ width: size, height: size, borderColor: pool.color, color: pool.color, fontSize: size * 0.42 }}
      aria-label={pool.name}
    >
      {initials(pool.name)}
    </div>
  );
}

/** Selo pequeno com o mini logo e o nome, para listas e para o topo do site. */
export function PoolChip({ pool, compact }: { pool: PoolLook | null; compact?: boolean }) {
  if (!pool) return <span className="text-xs text-zinc-500">Sem pool</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-black/70 py-0.5 pr-2.5 pl-1 text-xs font-semibold whitespace-nowrap"
      style={{ borderColor: `${pool.color}88`, color: pool.color }}
      title={pool.name}
    >
      <PoolLogo pool={pool} size={26} mini />
      {!compact && pool.name}
    </span>
  );
}
