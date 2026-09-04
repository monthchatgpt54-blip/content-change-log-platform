import { env } from "cloudflare:workers";

export type AuditFinding = {
  exactLocation: string;
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
  checks: Array<{ name: string; status: "pass" | "warning" | "fail"; detail: string }>;
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

function locationFor(index: number, value: string) {
  if (/^#{1,6}\s/.test(value)) return `Heading ${index + 1}`;
  return `Paragraph ${index + 1}`;
}

function firstSentence(value: string) {
  return value.match(/.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? value.slice(0, 260).trim();
}

function cleanMarkdown(value: string) {
  return value.replace(/^#{1,6}\s+/, "").trim();
}

function rulesAudit(input: AuditInput): AuditResult {
  const blocks = input.content
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const findings: AuditFinding[] = [];
  const normalizedSeen = new Map<string, number>();

  for (const [index, raw] of blocks.entries()) {
    const value = cleanMarkdown(raw);
    const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
    const location = locationFor(index, raw);

    if (normalized.length > 70 && normalizedSeen.has(normalized)) {
      findings.push({
        exactLocation: location,
        category: "Duplication",
        issue: `Duplicates paragraph ${Number(normalizedSeen.get(normalized)) + 1}`,
        action: "REMOVE",
        priority: "High",
        beforeText: value,
        afterText: "Remove this duplicate passage and keep the stronger original occurrence.",
        reason: "Repeated blocks dilute the page and make the reading experience feel unedited.",
        evidence: "Exact normalized paragraph match inside the submitted content.",
        confidence: 99,
      });
    } else {
      normalizedSeen.set(normalized, index);
    }

    const claim = value.match(claimPattern)?.[0];
    if (claim) {
      findings.push({
        exactLocation: location,
        category: "Accuracy and trust",
        issue: `Unsupported absolute claim: “${claim}”`,
        action: "CORRECT",
        priority: "High",
        beforeText: firstSentence(value),
        afterText: firstSentence(value).replace(claimPattern, "evidence-led"),
        reason: "A native editorial review should replace unverified superlatives with a precise, supportable statement.",
        evidence: "The supplied copy contains an absolute performance claim without a cited source.",
        confidence: 94,
      });
    }

    if (value.includes("—")) {
      findings.push({
        exactLocation: location,
        category: "Voice and punctuation",
        issue: "Em dash conflicts with the selected editorial style",
        action: "CLEAN",
        priority: "Low",
        beforeText: firstSentence(value),
        afterText: firstSentence(value).replaceAll(" — ", ". ").replaceAll("—", ", "),
        reason: "Uses standard American punctuation while preserving the sentence meaning.",
        evidence: "Direct punctuation match.",
        confidence: 98,
      });
    }

    const british = Object.keys(britishToAmerican).find((word) =>
      new RegExp(`\\b${word}\\b`, "i").test(value),
    );
    if (british && input.languageStandard.toLowerCase().includes("american")) {
      const pattern = new RegExp(`\\b${british}\\b`, "gi");
      findings.push({
        exactLocation: location,
        category: "American English",
        issue: `British spelling detected: “${british}”`,
        action: "CLEAN",
        priority: "Medium",
        beforeText: firstSentence(value),
        afterText: firstSentence(value).replace(pattern, britishToAmerican[british]),
        reason: "Aligns spelling with the selected United States language standard.",
        evidence: "Dictionary-based language-standard check.",
        confidence: 99,
      });
    }

    if (genericCtaPattern.test(value)) {
      findings.push({
        exactLocation: location,
        category: "Conversion clarity",
        issue: "Generic or repetitive call to action",
        action: "REWRITE",
        priority: "Medium",
        beforeText: firstSentence(value),
        afterText: "Discuss the scope, priorities, and expected outcomes before choosing the next step.",
        reason: "A decision-oriented CTA gives the reader more useful context than a generic prompt.",
        evidence: "Generic CTA phrase detected in the submitted copy.",
        confidence: 91,
      });
    }

    const sentences = value.split(/(?<=[.!?])\s+/);
    const longSentence = sentences.find((sentence) => sentence.trim().split(/\s+/).length > 34);
    if (longSentence) {
      const words = longSentence.trim().split(/\s+/);
      findings.push({
        exactLocation: location,
        category: "Readability",
        issue: "Sentence exceeds 34 words",
        action: "REWRITE",
        priority: "Medium",
        beforeText: longSentence.trim(),
        afterText: `${words.slice(0, 20).join(" ")}. ${words.slice(20).join(" ")}`,
        reason: "Splitting the sentence improves scanability without adding a new factual claim.",
        evidence: `${words.length}-word sentence detected.`,
        confidence: 88,
      });
    }
  }

  const wordCount = input.content.trim().split(/\s+/).filter(Boolean).length;
  const keyword = input.primaryKeyword?.trim();
  const keywordCount = keyword
    ? (input.content.toLowerCase().match(new RegExp(keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length
    : 0;
  if (keyword && keywordCount === 0) {
    findings.push({
      exactLocation: "Page-wide",
      category: "Search intent",
      issue: "Primary keyword is absent",
      action: "ADD",
      priority: "High",
      beforeText: "The exact primary topic is not stated in the submitted copy.",
      afterText: `Add “${keyword}” naturally to the title, opening context, or the most relevant section after confirming fit.`,
      reason: "The page should clearly establish its primary topic without forced repetition.",
      evidence: "Zero exact-match occurrences found.",
      confidence: 97,
    });
  } else if (keyword && wordCount > 0 && keywordCount / wordCount > 0.035) {
    findings.push({
      exactLocation: "Page-wide",
      category: "Search quality",
      issue: "Primary keyword may be overused",
      action: "CLEAN",
      priority: "High",
      beforeText: `${keywordCount} exact uses across ${wordCount} words.`,
      afterText: "Keep only contextually necessary uses and replace forced repetitions with clear topic language.",
      reason: "Natural topical coverage is stronger than repetitive exact-match phrasing.",
      evidence: "Exact-match usage exceeds the conservative 3.5% review threshold.",
      confidence: 86,
    });
  }

  if (!blocks.some((block) => /^#{1,3}\s/.test(block)) && wordCount > 250) {
    findings.push({
      exactLocation: "Page structure",
      category: "Information architecture",
      issue: "Long content has no explicit section headings",
      action: "ADD",
      priority: "Medium",
      beforeText: "No Markdown H1–H3 headings detected.",
      afterText: "Add descriptive H2 headings around distinct user questions and decision points.",
      reason: "Clear sections help readers scan the page and understand its topic hierarchy.",
      evidence: `${wordCount} words reviewed with no detected Markdown heading.`,
      confidence: 82,
    });
  }

  const capped = findings.slice(0, 40);
  const score = Math.max(35, 100 - capped.reduce((sum, finding) => {
    return sum + ({ Critical: 18, High: 11, Medium: 6, Low: 2 }[finding.priority]);
  }, 0));
  const checks: AuditResult["checks"] = [
    { name: "Original preserved", status: "pass", detail: "Version 0 remains immutable." },
    { name: "American English", status: capped.some((f) => f.category === "American English") ? "warning" : "pass", detail: input.languageStandard },
    { name: "Unsupported claims", status: capped.some((f) => f.category === "Accuracy and trust") ? "warning" : "pass", detail: "Absolute claims require evidence." },
    { name: "Duplicate blocks", status: capped.some((f) => f.category === "Duplication") ? "warning" : "pass", detail: "Exact in-document duplicate scan completed." },
    { name: "Primary topic", status: keyword && keywordCount === 0 ? "fail" : "pass", detail: keyword || "No primary keyword supplied." },
    { name: "Manual approval", status: "pass", detail: "Publishing remains blocked until review is complete." },
  ];

  return {
    provider: "rules",
    model: null,
    score,
    summary: capped.length
      ? `${capped.length} traceable change${capped.length === 1 ? "" : "s"} found. Review each proposed edit before applying or publishing.`
      : "No high-confidence mechanical issues were found. A human or AI semantic review is still recommended.",
    findings: capped,
    checks,
  };
}

function readRuntime(name: string) {
  return (env as unknown as Record<string, string | undefined>)[name];
}

function extractOutputText(payload: unknown) {
  const record = payload as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (record.output_text) return record.output_text;
  return record.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
}

async function openAIAudit(input: AuditInput, fallback: AuditResult): Promise<AuditResult | null> {
  const apiKey = readRuntime("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = readRuntime("OPENAI_MODEL") || "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: "You are a senior American content editor and SEO quality reviewer. Never invent facts, rankings, prices, statistics, testimonials, or competitor findings. Produce a surgical change log. Every change must quote exact supplied text, give an exact paragraph or heading location, preserve meaning unless a factual correction is required, and explain the reader/SEO/trust benefit. Findings unsupported by the supplied content must be marked VERIFY. Return only JSON.",
      input: JSON.stringify({ brief: input, deterministicPrecheck: fallback.findings }),
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
                type: "array", maxItems: 40,
                items: {
                  type: "object", additionalProperties: false,
                  required: ["exactLocation", "category", "issue", "action", "priority", "beforeText", "afterText", "reason", "evidence", "confidence"],
                  properties: {
                    exactLocation: { type: "string" }, category: { type: "string" }, issue: { type: "string" },
                    action: { type: "string", enum: ["CLEAN", "CORRECT", "REWRITE", "ADD", "REMOVE", "VERIFY"] },
                    priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
                    beforeText: { type: "string" }, afterText: { type: "string" }, reason: { type: "string" }, evidence: { type: "string" },
                    confidence: { type: "integer", minimum: 0, maximum: 100 }
                  }
                }
              }
            }
          }
        }
      }
    }),
  });
  if (!response.ok) throw new Error(`OpenAI audit failed with status ${response.status}`);
  const parsed = JSON.parse(extractOutputText(await response.json())) as Pick<AuditResult, "score" | "summary" | "findings">;
  return { provider: "openai", model, score: parsed.score, summary: parsed.summary, findings: parsed.findings, checks: fallback.checks };
}

export async function runContentAudit(input: AuditInput, options?: { rulesOnly?: boolean }): Promise<AuditResult> {
  const fallback = rulesAudit(input);
  if (options?.rulesOnly) return fallback;
  try {
    return (await openAIAudit(input, fallback)) ?? fallback;
  } catch {
    return { ...fallback, summary: `${fallback.summary} OpenAI was unavailable, so this run used the deterministic review engine.` };
  }
}

export async function recheckFinding(
  finding: AuditFinding,
  reviewerInstruction: string,
): Promise<Pick<AuditFinding, "afterText" | "reason" | "evidence" | "confidence" | "priority"> | null> {
  const apiKey = readRuntime("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = readRuntime("OPENAI_MODEL") || "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: "You are a senior American content editor. Recheck one proposed edit against the reviewer's instruction. Preserve verified meaning, do not invent facts, and return only the corrected suggestion as strict JSON.",
      input: JSON.stringify({ finding, reviewerInstruction }),
      text: { format: {
        type: "json_schema", name: "rechecked_change", strict: true,
        schema: {
          type: "object", additionalProperties: false,
          required: ["afterText", "reason", "evidence", "confidence", "priority"],
          properties: {
            afterText: { type: "string" }, reason: { type: "string" }, evidence: { type: "string" },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
            priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
          },
        },
      } },
    }),
  });
  if (!response.ok) return null;
  return JSON.parse(extractOutputText(await response.json()));
}
