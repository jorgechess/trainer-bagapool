/** Marca principal: "BAGA" creme em letra condensada, com a faixa vermelha por cima. */
export function BagaWordmark({ tagline = "TRAINER", size = "lg" }: { tagline?: string; size?: "sm" | "lg" }) {
  if (size === "sm") {
    return (
      <span className="font-display flex items-baseline gap-1.5 leading-none">
        <span className="text-3xl tracking-wide text-baga-cream">BAGA</span>
        <span className="text-sm tracking-[0.2em] text-baga-red">{tagline}</span>
      </span>
    );
  }
  return (
    <div className="relative inline-flex items-center justify-center select-none">
      <span className="font-display text-[7.5rem] leading-[0.85] tracking-tight text-baga-cream sm:text-[10rem]">
        BAGA
      </span>
      <span className="font-display absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-baga-black/80 px-2 text-sm tracking-[0.15em] whitespace-nowrap text-baga-red sm:text-3xl sm:tracking-[0.25em]">
        {tagline}
      </span>
    </div>
  );
}
