export type ContentKind =
  | "paragraph"
  | "heading"
  | "bullet"
  | "table_row"
  | "quote"
  | "code"
  | "page";

export type ContentBlock = {
  kind: Exclude<ContentKind, "page">;
  raw: string;
  plainText: string;
  location: string;
  index: number;
};

const markdownBullet = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;
const markdownHeading = /^\s*#{1,6}\s+/;
const markdownQuote = /^\s*>\s?/;
const markdownTableSeparator = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function stripMarkup(value: string) {
  return value
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(markdownBullet, "")
    .replace(markdownQuote, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyLine(value: string): ContentBlock["kind"] | null {
  const line = value.trim();
  if (!line) return null;
  if (markdownHeading.test(value) || /^<h[1-6]\b/i.test(line)) return "heading";
  if (markdownBullet.test(value) || /^<li\b/i.test(line)) return "bullet";
  if (
    markdownTableSeparator.test(value) ||
    (/^\|.*\|$/.test(line) && line.split("|").length >= 3) ||
    /^<tr\b/i.test(line)
  ) return "table_row";
  if (markdownQuote.test(value) || /^<blockquote\b/i.test(line)) return "quote";
  if (/^\x60{3}/.test(line) || /^<pre\b/i.test(line)) return "code";
  if (/^<p\b/i.test(line)) return "paragraph";
  return null;
}

export function parseContentBlocks(content: string): ContentBlock[] {
  const source = content
    .replace(/\r\n?/g, "\n")
    .replace(/(<\/?(?:h[1-6]|p|li|tr|blockquote|pre)\b[^>]*>)/gi, "\n$1")
    .replace(/(<\/(?:h[1-6]|p|li|tr|blockquote|pre)>)/gi, "$1\n");
  const lines = source.split("\n");
  const provisional: Array<{ kind: ContentBlock["kind"]; raw: string }> = [];
  let paragraph: string[] = [];
  let code: string[] = [];
  let inFence = false;

  const flushParagraph = () => {
    const raw = paragraph.join("\n").trim();
    if (raw) provisional.push({ kind: "paragraph", raw });
    paragraph = [];
  };
  const flushCode = () => {
    const raw = code.join("\n").trim();
    if (raw) provisional.push({ kind: "code", raw });
    code = [];
  };

  for (const line of lines) {
    if (/^\s*\x60{3}/.test(line)) {
      if (inFence) {
        code.push(line);
        flushCode();
        inFence = false;
      } else {
        flushParagraph();
        inFence = true;
        code.push(line);
      }
      continue;
    }
    if (inFence) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const kind = classifyLine(line);
    if (kind && kind !== "paragraph") {
      flushParagraph();
      provisional.push({ kind, raw: line.trim() });
      continue;
    }
    if (kind === "paragraph" && /^<p\b/i.test(line.trim())) {
      flushParagraph();
      provisional.push({ kind: "paragraph", raw: line.trim() });
      continue;
    }

    const previous = provisional.at(-1);
    if (/^\s{2,}\S/.test(line) && previous?.kind === "bullet" && !paragraph.length) {
      previous.raw += "\n" + line;
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  if (code.length) flushCode();

  const counters: Record<ContentBlock["kind"], number> = {
    paragraph: 0,
    heading: 0,
    bullet: 0,
    table_row: 0,
    quote: 0,
    code: 0,
  };
  return provisional.map((block, index) => {
    counters[block.kind] += 1;
    const plainText = stripMarkup(block.raw);
    const label = {
      paragraph: "Paragraph " + counters.paragraph,
      heading: "Heading " + counters.heading + ": " + plainText.slice(0, 70),
      bullet: "Bullet " + counters.bullet,
      table_row: "Table row " + counters.table_row,
      quote: "Quote " + counters.quote,
      code: "Code block " + counters.code,
    }[block.kind];
    return { ...block, plainText, location: label, index };
  });
}

export function excerptContaining(block: ContentBlock, pattern: RegExp) {
  if (block.kind === "bullet" || block.kind === "table_row" || block.kind === "heading") {
    return block.raw;
  }
  const sentences = block.raw.split(/(?<=[.!?])(?:\s+|\n+)/);
  return sentences.find((sentence) => pattern.test(stripMarkup(sentence)))?.trim() ?? block.raw;
}
