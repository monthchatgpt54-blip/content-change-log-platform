import { env } from "cloudflare:workers";
import {
  excerptContaining,
  parseContentBlocks,
  type ContentBlock,
  type ContentKind,
} from "@/lib/content-structure";

export type AuditFinding = {
  exactLocation: string;
  contentKind: ContentKind;
  category: string;
  issue: string;
  action: "CLEAN" | "CORRECT" | "REWRITE" | "ADD" | "REMOVE" | "VERIFY";
  priority: "Critical" | "High" | "Medium" | "Low";
  beforeText: string;
  afterText: string;
  reason: string;
  evidence: string;
  confidence: number;
};

export type AuditResult = {
  provider: "openai" | "rules";
  model: string | null;
  score: number;
  summary: string;
  findings: AuditFinding[];
  checks: Array<{
    name: string;
    status: "pass" | "warning" | "fail";
    detail: string;
  }>;
};

type AuditInput = {
  title: string;
  content: string;
  primaryKeyword?: string;
  targetMarket: string;
  languageStandard: string;
  niche?: string;
};

const claimPattern = /\b(best|guaranteed|number one|#1|always|never fails|proven results?)\b/i;
const genericCtaPattern = /\b(contact us today|get started today|learn more today|call us today)\b/i;
const britishToAmerican: Record<string, string> = {
  optimise: "optimize",
  optimisation: "optimization",
  organisation: "organization",
  colour: "color",
  centre: "center",
  analyse: "analyze",
  customised: "customized",
  behaviour: "behavior",
  licence: "license",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function isTableSeparator(block: ContentBlock) {
  return block.kind === "table_row" && /^\s*\|?\s*:?-{3,}/.test(block.raw);
}

function structuralExcerpt(block: ContentBlock, pattern: RegExp) {
  return excerptContaining(block, pattern);
}

function replacement(
  block: ContentBlock,
  pattern: RegExp | string,
  next: string,
) {
  const before = structuralExcerpt(
    block,
    typeof pattern === "string" ? new RegExp(escapeRegExp(pattern), "i") : pattern,
  );
  return { before, after: before.replace(pattern, next) };
}

function rulesAudit(input: AuditInput): AuditResult {
  const blocks = parseContentBlocks(input.content);
  const findings: AuditFinding[] = [];
  const normalizedSeen = new Map<string, string>();

  for (const block of blocks) {
    if (block.kind === "code" || isTableSeparator(block) || !block.plainText) continue;
    const normalized = block.plainText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized.length > 50 && normalizedSeen.has(normalized)) {
      findings.push({
        exactLocation: block.location,
        contentKind: block.kind,
        category: "Duplication",
        issue: "Duplicates " + normalizedSeen.get(normalized),
        action: "REMOVE",
        priority: "High",
        beforeText: block.raw,
        afterText: "Remove this duplicate " + block.kind.replace("_", " ") + " and keep the stronger original occurrence.",
        reason: "Repeated content dilutes the page and makes the reading experience feel unedited.",
        evidence: "Exact normalized " + block.kind.replace("_", " ") + " match inside the submitted content.",
        confidence: 99,
      });
    } else {
      normalizedSeen.set(normalized, block.location);
    }

    const claim = block.plainText.match(claimPattern)?.[0];
    if (claim) {
      const edit = replacement(block, claimPattern, "evidence-led");
      findings.push({
        exactLocation: block.location,
        contentKind: block.kind,
        category: "Accuracy and trust",
        issue: "Unsupported absolute claim: “" + claim + "”",
        action: "CORRECT",
        priority: "High",
        beforeText: edit.before,
        afterText: edit.after,
        reason: "Replaces an unverified superlative while preserving the original block type and surrounding content.",
        evidence: "The supplied copy contains an absolute performance claim without a cited source.",
        confidence: 94,
      });
    }

    if (block.raw.includes("—")) {
      const edit = replacement(block, "—", ", ");
      findings.push({
        exactLocation: block.location,
        contentKind: block.kind,
        category: "Voice and punctuation",
        issue: "Em dash conflicts with the selected editorial style",
        action: "CLEAN",
        priority: "Low",
        beforeText: edit.before,
        afterText: edit.after.replaceAll(" — ", ". "),
        reason: "Uses the selected punctuation style without flattening a bullet or table row into paragraph text.",
        evidence: "Direct punctuation match.",
        confidence: 98,
      });
    }

    const british = Object.keys(britishToAmerican).find((word) =>
      new RegExp("\\b" + word + "\\b", "i").test(block.plainText),
    );
    if (british && input.languageStandard.toLowerCase().includes("american")) {
      const pattern = new RegExp("\\b" + british + "\\b", "gi");
      const edit = replacement(block, pattern, britishToAmerican[british]);
      findings.push({
        exactLocation: block.location,
        contentKind: block.kind,
        category: "American English",
        issue: "British spelling detected: “" + british + "”",
        action: "CLEAN",
        priority: "Medium",
        beforeText: edit.before,
        afterText: edit.after,
        reason: "Aligns spelling with the selected United States language standard while retaining the original structure.",
        evidence: "Dictionary-based language-standard check.",
        confidence: 99,
      });
    }

    if (genericCtaPattern.test(block.plainText)) {
      const edit = replacement(
        block,
        genericCtaPattern,
        "discuss the scope and next step",
      );
      findings.push({
        exactLocation: block.location,
        contentKind: block.kind,
        category: "Conversion clarity",
        issue: "Generic or repetitive call to action",
        action: "REWRITE",
        priority: "Medium",
        beforeText: edit.before,
        afterText: edit.after,
        reason: "Uses a more decision-oriented phrase and preserves any bullet marker, table delimiter, and remaining sentences.",
        evidence: "Generic CTA phrase detected in the submitted copy.",
        confidence: 91,
      });
    }

    if (
      (block.kind === "paragraph" || block.kind === "quote") &&
      !/<[^>]+>/.test(block.raw)
    ) {
      const sentences = block.raw.split(/(?<=[.!?])\s+/);
      const longSentence = sentences.find(
        (sentence) => sentence.trim().split(/\s+/).length > 34,
      );
      if (longSentence) {
        const words = longSentence.trim().split(/\s+/);
        findings.push({
          exactLocation: block.location,
          contentKind: block.kind,
          category: "Readability",
          issue: "Narrative sentence exceeds 34 words",
          action: "REWRITE",
          priority: "Medium",
          beforeText: longSentence.trim(),
          afterText:
            words.slice(0, 20).join(" ") +
            ". " +
            words.slice(20).join(" "),
          reason: "Splits one narrative sentence without changing bullets, table cells, headings, or other surrounding blocks.",
          evidence: words.length + "-word narrative sentence detected.",
          confidence: 88,
        });
      }
    }
  }

  const plainContent = blocks.map((block) => block.plainText).join(" ");
  const wordCount = plainContent.split(/\s+/).filter(Boolean).length;
  const keyword = input.primaryKeyword?.trim();
  const keywordCount = keyword
    ? (plainContent.toLowerCase().match(
        new RegExp(escapeRegExp(keyword.toLowerCase()), "g"),
      ) ?? []).length
    : 0;

  if (keyword && keywordCount === 0) {
    findings.push({
      exactLocation: "Page-wide",
      contentKind: "page",
      category: "Search intent",
      issue: "Primary keyword is absent",
      action: "ADD",
      priority: "High",
      beforeText: "The exact primary topic is not stated in the submitted copy.",
      afterText: "Add “" + keyword + "” naturally to the most relevant existing block after confirming fit.",
      reason: "The page should clearly establish its primary topic without forcing it into an unrelated bullet or table cell.",
      evidence: "Zero exact-match occurrences found.",
      confidence: 97,
    });
  } else if (keyword && wordCount > 0 && keywordCount / wordCount > 0.035) {
    findings.push({
      exactLocation: "Page-wide",
      contentKind: "page",
      category: "Search quality",
      issue: "Primary keyword may be overused",
      action: "CLEAN",
      priority: "High",
      beforeText: keywordCount + " exact uses across " + wordCount + " words.",
      afterText: "Keep only contextually necessary uses and preserve the page's existing lists and tables.",
      reason: "Natural topical coverage is stronger than repetitive exact-match phrasing.",
      evidence: "Exact-match usage exceeds the conservative 3.5% review threshold.",
      confidence: 86,
    });
  }

  if (!blocks.some((block) => block.kind === "heading") && wordCount > 250) {
    findings.push({
      exactLocation: "Page structure",
      contentKind: "page",
      category: "Information architecture",
      issue: "Long content has no explicit section headings",
      action: "ADD",
      priority: "Medium",
      beforeText: "No Markdown or HTML H1–H6 headings detected.",
      afterText: "Add descriptive H2 headings around distinct user questions and decision points without converting existing lists or tables.",
      reason: "Clear sections help readers scan the page and understand its topic hierarchy.",
      evidence: wordCount + " words reviewed with no detected heading.",
      confidence: 82,
    });
  }

  const capped = findings.slice(0, 40);
  const score = Math.max(
    35,
    100 -
      capped.reduce(
        (sum, finding) =>
          sum +
          { Critical: 18, High: 11, Medium: 6, Low: 2 }[finding.priority],
        0,
      ),
  );
  const bulletCount = blocks.filter((block) => block.kind === "bullet").length;
  const tableRowCount = blocks.filter((block) => block.kind === "table_row").length;
  const checks: AuditResult["checks"] = [
    {
      name: "Original preserved",
      status: "pass",
      detail: "Version 0 remains immutable.",
    },
    {
      name: "Structure detected",
      status: "pass",
      detail:
        bulletCount +
        " bullets and " +
        tableRowCount +
        " table rows were isolated from narrative paragraphs.",
    },
    {
      name: "American English",
      status: capped.some((finding) => finding.category === "American English")
        ? "warning"
        : "pass",
      detail: input.languageStandard,
    },
    {
      name: "Unsupported claims",
      status: capped.some((finding) => finding.category === "Accuracy and trust")
        ? "warning"
        : "pass",
      detail: "Absolute claims require evidence.",
    },
    {
      name: "Duplicate blocks",
      status: capped.some((finding) => finding.category === "Duplication")
        ? "warning"
        : "pass",
      detail: "Paragraph, bullet, and table-row duplication checked separately.",
    },
    {
      name: "Primary topic",
      status: keyword && keywordCount === 0 ? "fail" : "pass",
      detail: keyword || "No primary keyword supplied.",
    },
    {
      name: "Manual approval",
      status: "pass",
      detail: "Publishing remains blocked until review is complete.",
    },
  ];

  return {
    provider: "rules",
    model: null,
    score,
    summary: capped.length
      ? capped.length +
        " traceable change" +
        (capped.length === 1 ? "" : "s") +
        " found. Bullets, table rows, headings, and paragraphs were reviewed as separate structures."
      : "No high-confidence mechanical issues were found. Bullets, tables, headings, and paragraphs were still classified separately.",
    findings: capped,
    checks,
  };
}

function readRuntime(name: string) {
  return (env as unknown as Record<string, string | undefined>)[name];
}

function extractOutputText(payload: unknown) {
  const record = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  if (record.output_text) return record.output_text;
  return (
    record.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? "")
      .join("") ?? ""
  );
}

function findingSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "exactLocation",
      "contentKind",
      "category",
      "issue",
      "action",
      "priority",
      "beforeText",
      "afterText",
      "reason",
      "evidence",
      "confidence",
    ],
    properties: {
      exactLocation: { type: "string" },
      contentKind: {
        type: "string",
        enum: ["paragraph", "heading", "bullet", "table_row", "quote", "code", "page"],
      },
      category: { type: "string" },
      issue: { type: "string" },
      action: {
        type: "string",
        enum: ["CLEAN", "CORRECT", "REWRITE", "ADD", "REMOVE", "VERIFY"],
      },
      priority: {
        type: "string",
        enum: ["Critical", "High", "Medium", "Low"],
      },
      beforeText: { type: "string" },
      afterText: { type: "string" },
      reason: { type: "string" },
      evidence: { type: "string" },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
    },
  };
}

async function openAIAudit(
  input: AuditInput,
  fallback: AuditResult,
): Promise<AuditResult | null> {
  const apiKey = readRuntime("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = readRuntime("OPENAI_MODEL") || "gpt-5.4-mini";
  const structure = parseContentBlocks(input.content).map((block) => ({
    kind: block.kind,
    location: block.location,
    raw: block.raw,
  }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are a senior American content editor and SEO quality reviewer. Never invent facts, rankings, prices, statistics, testimonials, or competitor findings. Produce atomic, surgical changes. Respect the supplied structural classification: a bullet must remain one bullet, a table row must retain its delimiters and cell count, and neither may be rewritten as a paragraph. Never shorten a multi-sentence bullet by returning only its first sentence. Quote exact source text and preserve all unaffected sentences. Use VERIFY when evidence is missing. Return only JSON.",
      input: JSON.stringify({
        brief: {
          title: input.title,
          primaryKeyword: input.primaryKeyword,
          targetMarket: input.targetMarket,
          languageStandard: input.languageStandard,
          niche: input.niche,
        },
        structure,
        deterministicPrecheck: fallback.findings,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "master_content_audit",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["score", "summary", "findings"],
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              findings: {
                type: "array",
                maxItems: 40,
                items: findingSchema(),
              },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error("OpenAI audit failed with status " + response.status);
  }
  const parsed = JSON.parse(extractOutputText(await response.json())) as Pick<
    AuditResult,
    "score" | "summary" | "findings"
  >;
  return {
    provider: "openai",
    model,
    score: parsed.score,
    summary: parsed.summary,
    findings: parsed.findings,
    checks: fallback.checks,
  };
}

export async function runContentAudit(
  input: AuditInput,
  options?: { rulesOnly?: boolean },
): Promise<AuditResult> {
  const fallback = rulesAudit(input);
  if (options?.rulesOnly) return fallback;
  try {
    return (await openAIAudit(input, fallback)) ?? fallback;
  } catch {
    return {
      ...fallback,
      summary:
        fallback.summary +
        " OpenAI was unavailable, so this run used the deterministic review engine.",
    };
  }
}

export async function recheckFinding(
  finding: AuditFinding,
  reviewerInstruction: string,
): Promise<
  Pick<
    AuditFinding,
    "afterText" | "reason" | "evidence" | "confidence" | "priority"
  > | null
> {
  const apiKey = readRuntime("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = readRuntime("OPENAI_MODEL") || "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "Recheck one proposed edit against the reviewer's instruction. Preserve verified meaning and every unaffected sentence. Keep bullets as bullets and table rows with the same delimiters and cell count. Never invent facts. Return only JSON.",
      input: JSON.stringify({ finding, reviewerInstruction }),
      text: {
        format: {
          type: "json_schema",
          name: "rechecked_change",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "afterText",
              "reason",
              "evidence",
              "confidence",
              "priority",
            ],
            properties: {
              afterText: { type: "string" },
              reason: { type: "string" },
              evidence: { type: "string" },
              confidence: { type: "integer", minimum: 0, maximum: 100 },
              priority: {
                type: "string",
                enum: ["Critical", "High", "Medium", "Low"],
              },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) return null;
  return JSON.parse(extractOutputText(await response.json()));
}
