import { guardedFetch } from "./url-security.js";

export interface DiscoveredFeed {
  href: string;
  type: string;
  title: string;
}

function resolveHref(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, "i");
  const match = tag.match(pattern);
  return match?.[1] ?? null;
}

export async function discoverFeeds(inputUrl: string): Promise<DiscoveredFeed[]> {
  const result = await guardedFetch(inputUrl);
  if (!result.ok) return [];

  const html = result.text;
  const feeds: DiscoveredFeed[] = [];
  const seen = new Set<string>();

  // Match <link rel="alternate" type="application/rss+xml|atom+xml|xml" href="..." title="...">
  const linkPattern = /<link\b[^>]*?>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const tag = match[0];
    const rel = extractAttribute(tag, "rel");
    if (rel?.toLowerCase() !== "alternate") continue;

    const type = extractAttribute(tag, "type")?.toLowerCase() || "";
    if (!type.includes("rss") && !type.includes("atom") && !type.includes("xml")) continue;

    const href = extractAttribute(tag, "href");
    if (!href) continue;

    const resolved = resolveHref(inputUrl, href);
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    feeds.push({
      href: resolved,
      type,
      title: extractAttribute(tag, "title") || resolved,
    });
  }

  return feeds.slice(0, 10);
}
