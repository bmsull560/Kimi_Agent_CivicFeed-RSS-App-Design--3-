import { db } from "./db.js";

export interface Enrichment {
  summary: string;
  summarySource: "ollama" | "openai" | "extractive";
  tags: string[];
  tagSources: string[];
}

// ─── Configuration ───────────────────────────────────────────────

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ─── Public API ──────────────────────────────────────────────────

export async function enrichArticle(
  entryId: string,
  feedId: string,
  title: string,
  description: string
): Promise<Enrichment> {
  const cached = getCachedEnrichment(entryId);
  if (cached) return cached;

  const text = cleanText(`${title}. ${description}`);

  // Try AI summary
  let summary: string;
  let summarySource: Enrichment["summarySource"] = "extractive";

  const aiSummary = await tryOllamaSummary(text);
  if (aiSummary) {
    summary = aiSummary;
    summarySource = "ollama";
  } else if (OPENAI_KEY) {
    const openaiSummary = await tryOpenAiSummary(text);
    if (openaiSummary) {
      summary = openaiSummary;
      summarySource = "openai";
    } else {
      summary = extractiveSummary(text);
    }
  } else {
    summary = extractiveSummary(text);
  }

  // Tags: merge RSS categories + NLP keywords
  const nlpTags = extractKeywords(text);
  const tags = [...new Set([...nlpTags])].slice(0, 8);
  const tagSources = tags.map(() => "nlp");

  const enrichment: Enrichment = { summary, summarySource, tags, tagSources };
  saveEnrichment(entryId, feedId, enrichment);
  return enrichment;
}

export function getCachedEnrichment(entryId: string): Enrichment | null {
  const sumRow = db
    .prepare("SELECT summary, source FROM article_summaries WHERE entry_id = ?")
    .get(entryId) as any;
  if (!sumRow) return null;

  const tagRows = db
    .prepare("SELECT tag, source FROM article_tags WHERE entry_id = ?")
    .all(entryId) as any[];

  return {
    summary: sumRow.summary,
    summarySource: sumRow.source,
    tags: tagRows.map((r) => r.tag),
    tagSources: tagRows.map((r) => r.source),
  };
}

// ─── Storage ─────────────────────────────────────────────────────

function saveEnrichment(entryId: string, feedId: string, e: Enrichment) {
  const insertSummary = db.prepare(`
    INSERT OR REPLACE INTO article_summaries (entry_id, feed_id, summary, source, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO article_tags (entry_id, feed_id, tag, source)
    VALUES (?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertSummary.run(entryId, feedId, e.summary, e.summarySource, Date.now());
    for (let i = 0; i < e.tags.length; i++) {
      insertTag.run(entryId, feedId, e.tags[i], e.tagSources[i] || "nlp");
    }
  })();
}

// ─── Summarizers ─────────────────────────────────────────────────

async function tryOllamaSummary(text: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "gemma3:4b",
        prompt: `Summarize this government news article in one sentence (max 30 words):\n\n${text.slice(0, 2000)}`,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const out = (data.response || "").trim();
    return out.length > 10 ? out : null;
  } catch {
    return null;
  }
}

async function tryOpenAiSummary(text: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: "You summarize government news articles in one concise sentence (max 30 words).",
          },
          {
            role: "user",
            content: text.slice(0, 3000),
          },
        ],
        max_tokens: 80,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const out = (data.choices?.[0]?.message?.content || "").trim();
    return out.length > 10 ? out : null;
  } catch {
    return null;
  }
}

function extractiveSummary(text: string): string {
  const sentences = text
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  if (sentences.length === 0) return text.slice(0, 200);
  // Take first 2 sentences, capped at 200 chars
  const summary = sentences.slice(0, 2).join(" ");
  return summary.length > 200 ? summary.slice(0, 200) + "..." : summary;
}

// ─── Tag Extraction ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our",
  "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two",
  "who", "boy", "did", "she", "use", "her", "way", "many", "oil", "sit", "set", "run", "eat", "far",
  "sea", "eye", "ago", "off", "too", "any", "say", "man", "try", "ask", "end", "why", "let", "put",
  "say", "she", "try", "way", "own", "say", "too", "old", "tell", "very", "when", "much", "would",
  "there", "their", "what", "said", "each", "which", "will", "about", "could", "other", "after",
  "first", "never", "these", "think", "where", "being", "every", "great", "might", "shall", "still",
  "those", "while", "this", "that", "with", "have", "from", "they", "know", "want", "been", "good",
  "than", "then", "them", "well", "were", "said", "time", "than", "them", "into", "just", "like",
  "over", "also", "back", "only", "work", "life", "even", "more", "here", "look", "down", "most",
  "long", "last", "find", "give", "does", "made", "part", "such", "take", "come", "upon",
  // government-specific stop words
  "government", "federal", "department", "agency", "administration", "office", "commission",
  "service", "public", "national", "state", "united", "states", "official", "according",
  "report", "announced", "statement", "press", "release", "news", "today", "said", "says",
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      freq.set(bg, (freq.get(bg) || 0) + 1);
    }
  }

  const sorted = [...freq.entries()]
    .filter(([, count]) => count >= 2 || (count >= 1 && freq.size < 20))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);

  return sorted;
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
