import React from "react";
import { AlertTriangle, Sparkles, MapPin, Zap, ArrowUpRight, TrendingUp, PackageCheck, PackageX, Boxes } from "lucide-react";

interface NarayanaAiMessageRendererProps {
  content: string;
  isUser?: boolean;
  onActionClick?: (prompt: string) => void;
}

/**
 * Format inline text styles: bold, inline code, currency, status highlights, locations
 */
function renderInlineText(text: string, onActionClick?: (prompt: string) => void): React.ReactNode[] {
  // Split on bold (**text**), inline code (`code`), currency (₹...), or action triggers
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|₹[\d,]+(?:\.\d+)?)/g);

  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2);

      // Status pill styling: Warning / Low Stock
      if (/low stock|out of stock|critical|alert|warning|⚠️|🚨|below threshold/i.test(inner)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black text-[10.5px] border border-amber-500/40 shadow-xs"
          >
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            {inner}
          </span>
        );
      }

      // Status pill styling: Adequate / In Stock / Healthy
      if (/in stock|adequate|active|healthy|verified|✅|approved/i.test(inner)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black text-[10.5px] border border-emerald-500/40 shadow-xs"
          >
            <PackageCheck size={11} className="text-emerald-400 shrink-0" />
            {inner}
          </span>
        );
      }

      // Units or quantities styling
      if (/^\d+\s*(?:units?|kg|gm|crates?|packs?|gaps?|items?|orders?|crops?)/i.test(inner)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-sky-500/15 text-sky-300 font-mono font-black text-[11px] border border-sky-500/30"
          >
            {inner}
          </span>
        );
      }

      return (
        <strong key={idx} className="font-extrabold text-foreground tracking-tight">
          {inner}
        </strong>
      );
    }

    // Currency highlight (e.g. ₹12,450)
    if (/^₹[\d,]+(?:\.\d+)?$/.test(token)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center font-mono font-black text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px]"
        >
          {token}
        </span>
      );
    }

    // Inline Code
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-black/50 text-amber-300 font-mono text-[10px] border border-amber-500/20"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    return token;
  });
}

/**
 * Extract stock numbers and render mini stock gauge meter
 */
function renderStockMeter(cellText: string): React.ReactNode | null {
  const stockMatch = cellText.match(/(\d+)\s*units?/i);
  const threshMatch = cellText.match(/threshold\s*[:\s]*(\d+)/i);

  if (!stockMatch) return null;

  const current = parseInt(stockMatch[1], 10);
  const threshold = threshMatch ? parseInt(threshMatch[1], 10) : 10;
  const ratio = Math.min(100, Math.round((current / (threshold || 10)) * 100));

  const isLow = current <= threshold;
  const isCritical = current <= Math.max(1, Math.round(threshold * 0.4));

  return (
    <div className="mt-1 flex items-center gap-1.5 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCritical
              ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
              : isLow
              ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
          }`}
          style={{ width: `${Math.max(8, Math.min(100, ratio))}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono font-bold ${isCritical ? "text-red-400" : isLow ? "text-amber-400" : "text-emerald-400"}`}>
        {ratio}%
      </span>
    </div>
  );
}

/**
 * Render Markdown Table Block into a High-End Executive Glass Table with inline Action Triggers & Meters
 */
function renderTableBlock(tableLines: string[], key: number, onActionClick?: (prompt: string) => void): React.ReactNode {
  if (tableLines.length < 2) return null;

  // Filter out delimiter row (e.g. |---|---|)
  const rows = tableLines.filter((line) => !/^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)+\|?$/.test(line.trim()));
  if (rows.length === 0) return null;

  const headerRow = rows[0]
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  const dataRows = rows.slice(1).map((row) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
  );

  return (
    <div
      key={key}
      className="my-3 overflow-hidden rounded-2xl border border-emerald-500/30 bg-background/95 shadow-xl backdrop-blur-md"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-amber-950/80 border-b border-emerald-500/30 text-muted-foreground font-black uppercase text-[9px] tracking-wider">
              {headerRow.map((col, cIdx) => (
                <th key={cIdx} className="px-3 py-2.5 text-foreground/90 whitespace-nowrap">
                  {renderInlineText(col, onActionClick)}
                </th>
              ))}
              {onActionClick && <th className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/60">
            {dataRows.map((rowCells, rIdx) => {
              const isWarningRow = rowCells.some((c) => /low stock|⚠️|0 units|critical|out of stock/i.test(c));
              const productNameCell = rowCells.find((c) => !/^\d+$/.test(c) && !/units?|stock|adequate|threshold/i.test(c)) || rowCells[1] || rowCells[0];
              const cleanProductName = productNameCell ? productNameCell.replace(/[*_`]/g, "").trim() : "";

              return (
                <tr
                  key={rIdx}
                  className={`transition-colors ${
                    isWarningRow
                      ? "bg-amber-500/10 hover:bg-amber-500/20"
                      : rIdx % 2 === 0
                      ? "bg-transparent hover:bg-muted/40"
                      : "bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  {rowCells.map((cell, cIdx) => {
                    const meter = renderStockMeter(cell);
                    return (
                      <td key={cIdx} className="px-3 py-2.5 text-foreground/90 font-medium whitespace-nowrap align-middle">
                        <div>{renderInlineText(cell, onActionClick)}</div>
                        {meter}
                      </td>
                    );
                  })}
                  {onActionClick && (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap align-middle">
                      {isWarningRow && cleanProductName && cleanProductName !== "Various" && (
                        <button
                          type="button"
                          onClick={() => onActionClick(`Restock ${cleanProductName} now with 50 units`)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-[10px] font-black transition active:scale-95 shadow-xs cursor-pointer"
                          title={`Restock ${cleanProductName}`}
                        >
                          <Zap size={11} className="text-amber-400" />
                          <span>Restock</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NarayanaAiMessageRenderer({ content, isUser = false, onActionClick }: NarayanaAiMessageRendererProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap font-medium">{content}</div>;
  }

  // Clean away any leftover metadata directives
  const cleanContent = content
    .replace(/<<<ACTION:[\s\S]*?>>>/g, "")
    .replace(/<<<FOLLOWUPS:[\s\S]*?>>>/g, "")
    .trim();

  const lines = cleanContent.split("\n");
  const blocks: React.ReactNode[] = [];

  let currentTableLines: string[] = [];

  const flushTable = (key: number) => {
    if (currentTableLines.length > 0) {
      blocks.push(renderTableBlock(currentTableLines, key, onActionClick));
      currentTableLines = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. Table Row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      currentTableLines.push(trimmed);
      return;
    } else {
      flushTable(idx);
    }

    // 2. Empty line
    if (!trimmed) {
      blocks.push(<div key={`spacer-${idx}`} className="h-1.5" />);
      return;
    }

    // 3. Section Headers (e.g., **Report Title** or ## Title)
    if (/^(#{1,3}\s*|\*\*)([^*#]+)(\*\*|\s*)$/.test(trimmed)) {
      const title = trimmed.replace(/^#{1,3}\s*|\*\*$/g, "").replace(/^\*\*/, "");
      blocks.push(
        <div key={`header-${idx}`} className="flex items-center gap-2 pt-2 pb-1 border-b border-card-border/80">
          <Sparkles size={14} className="text-amber-400 shrink-0" />
          <h4 className="font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
            {title}
          </h4>
        </div>
      );
      return;
    }

    // 4. Alert / Note Callouts
    if (/^\*?(Note|Warning|Alert|Critical):/i.test(trimmed) || trimmed.startsWith("⚠️") || trimmed.startsWith("🚨")) {
      blocks.push(
        <div
          key={`alert-${idx}`}
          className="my-2.5 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-start gap-2.5 shadow-sm backdrop-blur-xs"
        >
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{renderInlineText(trimmed.replace(/^(\*|Note:|Warning:)\s*/i, ""), onActionClick)}</div>
        </div>
      );
      return;
    }

    // 5. Bullet points / Lists
    if (/^(\*|\-|•)\s+/.test(trimmed)) {
      const textOnly = trimmed.replace(/^(\*|\-|•)\s+/, "");
      blocks.push(
        <div key={`bullet-${idx}`} className="flex items-start gap-2 pl-1 py-0.5 text-[11.5px] leading-relaxed">
          <span className="text-emerald-400 font-bold mt-0.5">•</span>
          <div className="flex-1 text-foreground/90 font-medium">{renderInlineText(textOnly, onActionClick)}</div>
        </div>
      );
      return;
    }

    // 6. Numbered Lists (e.g. 1. 2. 3.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push(
        <div key={`num-${idx}`} className="flex items-start gap-2 pl-1 py-1 text-[11.5px] leading-relaxed">
          <span className="font-mono font-black text-amber-400 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 shrink-0">
            {numMatch[1]}
          </span>
          <div className="flex-1 text-foreground/90 font-medium">{renderInlineText(numMatch[2], onActionClick)}</div>
        </div>
      );
      return;
    }

    // 7. Regular paragraph text
    blocks.push(
      <p key={`p-${idx}`} className="text-[11.5px] leading-relaxed text-foreground/90 font-medium">
        {renderInlineText(trimmed, onActionClick)}
      </p>
    );
  });

  // Flush any trailing table
  flushTable(lines.length + 1);

  return <div className="space-y-1.5">{blocks}</div>;
}

// Backward-compatibility alias
export const VishnuAiMessageRenderer = NarayanaAiMessageRenderer;
