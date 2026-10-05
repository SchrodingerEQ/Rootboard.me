import type { LucideIcon } from "lucide-react";
import type { Item } from "./types";

interface ItemChipProps {
  item: Item;
  /** Optional lucide fallback if an emoji turns out not to render on the
   *  kiosk's Firefox (brief §6.8): swap at the call site, one line. */
  icon?: LucideIcon;
  size?: "lg" | "md";
}

/** One "👕 T-shirt" chip. Theme tokens only. */
export function ItemChip({ item, icon: Icon, size = "lg" }: ItemChipProps) {
  const big = size === "lg";
  return (
    <span
      data-testid={`wtw-item-${item.id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: big ? 12 : 8,
        padding: big ? "10px 18px" : "6px 12px",
        borderRadius: 999,
        background: "var(--rb-chip)",
        color: "var(--rb-ink)",
        fontSize: big ? 26 : 20,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {Icon ? <Icon size={big ? 30 : 22} aria-hidden /> : <span style={{ fontSize: big ? 34 : 24 }}>{item.emoji}</span>}
      <span>{item.label}</span>
    </span>
  );
}
