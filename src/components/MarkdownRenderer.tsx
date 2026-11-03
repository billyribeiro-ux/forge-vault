import React, { useState } from "react";
import { ArrowSquareOut, Check, CheckSquare, Copy, FileCode, Square } from "./icons";

interface MarkdownRendererProps {
  content: string;
  onCopySuccess?: (label: string) => void;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function extractMarkdownHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split("\n");
  const headings: TocHeading[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/`/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      headings.push({ id, text, level });
    }
  }
  return headings;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 text-[12.5px] font-mono rounded-md bg-(--md-sys-color-surface-container-high) text-indigo-600 dark:text-indigo-300 border border-(--md-sys-color-outline-variant)"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-700 dark:text-slate-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = /^https?:\/\//i.test(href);
      return (
        <a
          key={idx}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="inline-flex items-center gap-0.5 font-medium text-indigo-600 dark:text-indigo-400 underline underline-offset-4 hover:opacity-85"
        >
          <span>{label}</span>
          {isExternal && <ArrowSquareOut className="w-3 h-3 shrink-0" />}
        </a>
      );
    }
    return token;
  });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onCopySuccess }) => {
  const [copiedBlockIndex, setCopiedBlockIndex] = useState<number | null>(null);

  const handleCopyCodeBlock = async (code: string, index: number, lang: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBlockIndex(index);
      onCopySuccess?.(`Copied ${lang || "code"} snippet to clipboard`);
      setTimeout(() => setCopiedBlockIndex(null), 1800);
    } catch {
      // Ignore
    }
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal Rule (---, ***, ___)
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      elements.push(
        <hr
          key={`hr-${blockKey++}`}
          className="my-5 border-0 border-t border-(--md-sys-color-outline-variant)"
        />,
      );
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeString = codeLines.join("\n");
      const currentBlockIdx = blockKey++;

      elements.push(
        <div
          key={`code-${currentBlockIdx}`}
          className="my-4 rounded-2xl overflow-hidden border border-(--md-sys-color-outline-variant) bg-[#0C0E13] text-slate-100"
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#181B21] border-b border-[#282C37] text-xs text-slate-400">
            <div className="flex items-center gap-2 font-mono">
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lang}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{codeLines.length} lines</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyCodeBlock(codeString, currentBlockIdx, lang)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-slate-200 hover:text-white bg-[#262A33] hover:bg-[#313540] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedBlockIndex === currentBlockIdx ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-[13px] leading-relaxed font-mono overflow-x-auto text-slate-100">
            <code>{codeString}</code>
          </pre>
        </div>,
      );
      continue;
    }

    // Markdown Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim());

        const headers = parseRow(tableLines[0]);
        const bodyRows = tableLines.slice(2).map(parseRow);

        elements.push(
          <div
            key={`table-${blockKey++}`}
            className="my-4 overflow-x-auto rounded-2xl border border-(--md-sys-color-outline-variant)"
          >
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-(--md-sys-color-surface-container-low) border-b border-(--md-sys-color-outline-variant)">
                  {headers.map((header, hIdx) => (
                    <th
                      key={hIdx}
                      className="px-4 py-2.5 font-semibold text-xs text-slate-700 dark:text-slate-300"
                    >
                      {renderInlineFormatting(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--md-sys-color-outline-variant)">
                {bodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-(--md-sys-color-surface-container-low) transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300"
                      >
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    // Headings (# through ######)
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = text
        .replace(/`/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (level === 1) {
        elements.push(
          <h1
            id={id}
            key={`h1-${blockKey++}`}
            className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-2 mb-3 pb-2 border-b border-(--md-sys-color-outline-variant)"
          >
            {renderInlineFormatting(text)}
          </h1>,
        );
      } else if (level === 2) {
        elements.push(
          <h2
            id={id}
            key={`h2-${blockKey++}`}
            className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 mt-6 mb-2.5"
          >
            {renderInlineFormatting(text)}
          </h2>,
        );
      } else if (level === 3) {
        elements.push(
          <h3
            id={id}
            key={`h3-${blockKey++}`}
            className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-1.5"
          >
            {renderInlineFormatting(text)}
          </h3>,
        );
      } else {
        elements.push(
          <h4
            id={id}
            key={`h4-${blockKey++}`}
            className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-3 mb-1"
          >
            {renderInlineFormatting(text)}
          </h4>,
        );
      }
      i++;
      continue;
    }

    // Blockquote / Callout
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <div
          key={`quote-${blockKey++}`}
          className="my-3.5 p-4 rounded-2xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-xs leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {renderInlineFormatting(quoteLines.join(" "))}
        </div>,
      );
      continue;
    }

    // Unordered list (including GFM task lists `- [ ]` and `- [x]`)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul
          key={`ul-${blockKey++}`}
          className="my-3 space-y-1.5 text-[14px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {listItems.map((item, idx) => {
            const taskMatch = /^\[([ xX])\]\s+(.+)$/.exec(item);
            if (taskMatch) {
              const isChecked = taskMatch[1].toLowerCase() === "x";
              return (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  )}
                  <span className={isChecked ? "line-through opacity-75" : ""}>
                    {renderInlineFormatting(taskMatch[2])}
                  </span>
                </li>
              );
            }
            return (
              <li key={idx} className="leading-relaxed list-disc list-inside">
                {renderInlineFormatting(item)}
              </li>
            );
          })}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol
          key={`ol-${blockKey++}`}
          className="my-3 space-y-1.5 list-decimal list-inside text-[14px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Empty line
    if (trimmed === "") {
      i++;
      continue;
    }

    // Standard paragraph
    elements.push(
      <p
        key={`p-${blockKey++}`}
        className="my-2.5 text-[14.5px] leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {renderInlineFormatting(trimmed)}
      </p>,
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};
