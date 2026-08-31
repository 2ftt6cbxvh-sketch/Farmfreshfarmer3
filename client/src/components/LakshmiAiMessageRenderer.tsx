import React from "react";
import { AlertTriangle, Sparkles, HeartPulse, Leaf, ShieldCheck, CheckCircle2 } from "lucide-react";

interface LakshmiAiMessageRendererProps {
  content: string;
  isUser?: boolean;
}

/**
 * Format inline text styles: bold, inline code, currency, highlighted keywords
 * Strips all raw markdown asterisks and backticks
 */
function renderInlineText(text: string): React.ReactNode[] {
  // Replace triple/double asterisks or inline code
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|₹[\d,]+(?:\.\d+)?)/g);

  return tokens.map((token, idx) => {
    // Bold token: **Text**
    if (token.startsWith("**") && token.endsWith("**")) {
      const inner = token.slice(2, -2).trim();

      // Warning or critical medical terms
      if (/emergency|immediate|doctor|infection|severe|alert|warning|⚠️|🚨|pus|fever/i.test(inner)) {
        return (
          <strong key={idx} className="font-extrabold text-amber-500 dark:text-amber-400">
            {inner}
          </strong>
        );
      }

      // First-aid or beneficial organic terms
      if (/aloe vera|turmeric|neem|honey|coconut oil|remedy|first-aid|organic|protein|fiber|vitamins/i.test(inner)) {
        return (
          <strong key={idx} className="font-extrabold text-emerald-600 dark:text-emerald-400">
            {inner}
          </strong>
        );
      }

      return (
        <strong key={idx} className="font-extrabold text-foreground tracking-tight">
          {inner}
        </strong>
      );
    }

    // Currency highlight (e.g. ₹150)
    if (/^₹[\d,]+(?:\.\d+)?$/.test(token)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center font-mono font-black text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded bg-emerald-500/10 text-[11px]"
        >
          {token}
        </span>
      );
    }

    // Inline Code: `code`
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-muted text-emerald-600 dark:text-emerald-400 font-mono text-[10.5px] border border-border"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // Clean any stray asterisks or hashes from plain text
    const cleanText = token.replace(/[*_#~]/g, "");
    return cleanText;
  });
}

/**
 * Render Markdown Table Block into a Clean Glass Table
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
      className="my-2.5 overflow-hidden rounded-xl border border-emerald-500/30 bg-background/90 shadow-sm"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="bg-emerald-950/20 dark:bg-emerald-950/60 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-black uppercase text-[9px] tracking-wider">
              {headerRow.map((col, cIdx) => (
                <th key={cIdx} className="px-2.5 py-2 whitespace-nowrap">
                  {renderInlineText(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/60">
            {dataRows.map((rowCells, rIdx) => (
              <tr
                key={rIdx}
                className={rIdx % 2 === 0 ? "bg-transparent" : "bg-muted/30"}
              >
                {rowCells.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1.5 text-foreground/90 font-medium whitespace-nowrap align-middle">
                    {renderInlineText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LakshmiAiMessageRenderer({ content, isUser = false }: LakshmiAiMessageRendererProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap font-medium">{content}</div>;
  }

  // Clean away any leftover metadata directives or dividers
  const cleanContent = content
    .replace(/<<<VISION_METADATA:[\s\S]*?>>>/g, "")
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
    let trimmed = line.trim();

    // Skip horizontal divider lines like ---, ***, ___
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushTable(idx);
      blocks.push(<div key={`hr-${idx}`} className="my-2 border-b border-card-border/60" />);
      return;
    }

    // 1. Table Row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      currentTableLines.push(trimmed);
      return;
    } else {
      flushTable(idx);
    }

    // 2. Empty line
    if (!trimmed) {
      blocks.push(<div key={`spacer-${idx}`} className="h-1" />);
      return;
    }

    // 3. Headings: ### Title or ## Title or # Title or **Header:**
    if (/^#{1,4}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,4}\s+/, "").replace(/[*#]/g, "").trim();
      const isHealthHeading = /medical|doctor|hospital|first-aid|skin|wound|burn|scar|warning|alert/i.test(headingText);
      const isPlantHeading = /plant|crop|recipe|soil|garden|pest/i.test(headingText);

      blocks.push(
        <div key={`heading-${idx}`} className="flex items-center gap-1.5 pt-2 pb-1 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs tracking-tight border-b border-card-border/40">
          {isHealthHeading ? (
            <HeartPulse size={13} className="text-amber-500 shrink-0" />
          ) : isPlantHeading ? (
            <Leaf size={13} className="text-emerald-500 shrink-0" />
          ) : (
            <Sparkles size={12} className="text-amber-400 shrink-0" />
          )}
          <span>{headingText}</span>
        </div>
      );
      return;
    }

    // 4. Blockquote or Medical / Safety Disclaimer (> text)
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s*/, "").replace(/[*_]/g, "").trim();
      blocks.push(
        <div
          key={`quote-${idx}`}
          className="my-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2"
        >
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{quoteText}</div>
        </div>
      );
      return;
    }

    // 5. Bullet points / Lists (* item, - item, • item)
    if (/^(\*|\-|•)\s+/.test(trimmed)) {
      const textOnly = trimmed.replace(/^(\*|\-|•)\s+/, "");
      blocks.push(
        <div key={`bullet-${idx}`} className="flex items-start gap-2 pl-1 py-0.5 text-[11.5px] leading-relaxed">
          <span className="text-emerald-500 font-black mt-0.5">•</span>
          <div className="flex-1 text-foreground/90 font-medium">{renderInlineText(textOnly)}</div>
        </div>
      );
      return;
    }

    // 6. Numbered Lists (1. item, 2. item)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push(
        <div key={`num-${idx}`} className="flex items-start gap-2 pl-1 py-1 text-[11.5px] leading-relaxed">
          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 shrink-0">
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

  return <div className="space-y-1">{blocks}</div>;
}
