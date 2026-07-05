import { dietDotColor } from "@/lib/types";

// Renders the FSSAI-style veg/non-veg indicator (square with a dot).
export function DietDot({ tag, size = 14 }: { tag?: string | null; size?: number }) {
  const color = dietDotColor(tag);
  if (!color) return null;
  const dot = Math.round(size * 0.5);
  return (
    <span
      data-testid={`diet-${tag}`}
      title={tag === "veg" ? "Vegetarian" : "Non-vegetarian"}
      style={{ width: size, height: size, borderColor: color }}
      className="inline-flex items-center justify-center rounded-[3px] border-2"
    >
      <span style={{ width: dot, height: dot, background: color }} className="rounded-full block" />
    </span>
  );
}
