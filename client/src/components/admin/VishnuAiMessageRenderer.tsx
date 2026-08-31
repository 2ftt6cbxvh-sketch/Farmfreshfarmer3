import React from "react";
import { AlertTriangle, Sparkles } from "lucide-react";

interface VishnuAiMessageRendererProps {
  content: string;
  isUser?: boolean;
}

/**
 * Format inline text styles: bold, inline code, currency, status highlights
 */
function renderInlineText(text: string): React.ReactNode[] {
  // Split on bold (**text**), inline code (`code`), or currency/status patterns
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2);

      // Status pill styling
      if (/low stock|out of stock|critical|alert|warning|⚠️|🚨/i.test(inner)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/20 text-amber-300 font-extrabold text-[11px] border border-amber-500/30"
          >
            {inner}
          </span>
        );
      }
      if (/in stock|adequate|active|healthy|verified|✅|approved/i.test(inner)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30"
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

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-black/40 text-amber-300 font-mono text-[10px] border border-amber-500/20"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    return token;
  });
}

/**
 * Render Markdown Table Block into a High-End Executive Glass Table
 */
function renderTableBlock(tableLines: string[], key: number): React.ReactNode {
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
      className="my-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-background/90 shadow-md backdrop-blur-md"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-amber-950/60 border-b border-emerald-500/30 text-muted-foreground font-black uppercase text-[9px] tracking-wider">
              {headerRow.map((col, cIdx) => (
                <th key={cIdx} className="px-3 py-2 text-foreground/90 whitespace-nowrap">
                  {renderInlineText(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/60">
            {dataRows.map((rowCells, rIdx) => {
              const isWarningRow = rowCells.some((c) => /low stock|⚠️|0 units|critical/i.test(c));
              return (
                <tr
                  key={rIdx}
                  className={`transition-colors ${
                    isWarningRow
                      ? "bg-amber-500/10 hover:bg-amber-500/15"
                      : rIdx % 2 === 0
                      ? "bg-transparent hover:bg-muted/40"
                      : "bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  {rowCells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-foreground/90 font-medium whitespace-nowrap">
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VishnuAiMessageRenderer({ content, isUser = false }: VishnuAiMessageRendererProps) {
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
      blocks.push(renderTableBlock(currentTableLines, key));
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
        <div key={`header-${idx}`} className="flex items-center gap-2 pt-1.5 pb-0.5 border-b border-card-border/80">
          <Sparkles size={13} className="text-amber-400 shrink-0" />
          <h4 className="font-black text-xs uppercase tracking-wider text-amber-300">{title}</h4>
        </div>
      );
      return;
    }

    // 4. Alert / Note Callouts
    if (/^\*?(Note|Warning|Alert|Critical):/i.test(trimmed) || trimmed.startsWith("⚠️") || trimmed.startsWith("🚨")) {
      blocks.push(
        <div
          key={`alert-${idx}`}
          className="my-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-start gap-2 shadow-xs"
        >
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{renderInlineText(trimmed.replace(/^(\*|Note:|Warning:)\s*/i, ""))}</div>
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
          <div className="flex-1 text-foreground/90 font-medium">{renderInlineText(textOnly)}</div>
        </div>
      );
      return;
    }

    // 6. Numbered Lists (e.g. 1. 2. 3.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push(
        <div key={`num-${idx}`} className="flex items-start gap-2 pl-1 py-0.5 text-[11.5px] leading-relaxed">
          <span className="font-mono font-bold text-amber-400 text-[10px] px-1 py-0.5 rounded bg-amber-500/15 shrink-0">
            {numMatch[1]}
          </span>
          <div className="flex-1 text-foreground/90 font-medium">{renderInlineText(numMatch[2])}</div>
        </div>
      );
      return;
    }

    // 7. Regular paragraph text
    blocks.push(
      <p key={`p-${idx}`} className="text-[11.5px] leading-relaxed text-foreground/90 font-medium">
        {renderInlineText(trimmed)}
      </p>
    );
  });

  // Flush any trailing table
  flushTable(lines.length + 1);

  return <div className="space-y-1.5">{blocks}</div>;
}
