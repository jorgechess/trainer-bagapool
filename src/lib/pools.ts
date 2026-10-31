/** Logos disponíveis para as pools. */

/** Pools do Baga desenhadas em vetor: "BAGA" + palavra em pincel na cor da pool. */
export const BAGA_MARKS: Record<string, string> = {
  "baga-main": "MAIN",
  "baga-mid": "MID",
  "baga-low": "LOW",
  "baga-micro": "MICRO",
};

/** Logos em imagem (arquivos em /public/pools). */
export const IMAGE_LOGOS: Record<string, string> = {
  "5high": "/pools/5high.png",
  "no-deal": "/pools/no-deal.png",
  almirantes: "/pools/almirantes.png",
};

export const LOGO_OPTIONS: { value: string; label: string }[] = [
  { value: "baga-main", label: "Baga Main" },
  { value: "baga-mid", label: "Baga Mid" },
  { value: "baga-low", label: "Baga Low" },
  { value: "baga-micro", label: "Baga Micro" },
  { value: "5high", label: "5 High (losango)" },
  { value: "no-deal", label: "No Deal" },
  { value: "almirantes", label: "Almirantes (caveira)" },
];

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
