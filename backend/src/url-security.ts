import dns from "dns/promises";
import { isIP } from "net";

export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 5;
export const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

const BLOCKED_PORTS = new Set([
  // Administrative / infrastructure services that should never be reached by a feed fetcher.
  22, 23, 25, 53, 110, 143, 3306, 5432, 6379, 8086, 9200, 9300, 27017,
]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (process.env.CIVICFEED_ALLOW_PRIVATE_URLS === "1") return false;
  if (!ip) return true;

  // IPv4 classifications.
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
    const [a, b, c, d] = parts;
    // Loopback: 127.0.0.0/8
    if (a === 127) return true;
    // Link-local: 169.254.0.0/16 (includes cloud metadata services)
    if (a === 169 && b === 254) return true;
    // Private: 10.0.0.0/8
    if (a === 10) return true;
    // Private: 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // Private: 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Multicast / reserved / broadcast.
    if (a >= 224) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
    // 255.255.255.255
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  }

  // IPv6 loopback.
  if (ip === "::1") return true;

  return false;
}

async function resolveIps(hostname: string): Promise<string[]> {
  const ips: string[] = [];
  try {
    ips.push(...(await dns.resolve4(hostname)));
  } catch {
    // ignore
  }
  try {
    ips.push(...(await dns.resolve6(hostname)));
  } catch {
    // ignore
  }
  return ips;
}

export async function assertSafeUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs containing credentials are not allowed");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTP and HTTPS URLs are allowed");
  }

  const port = url.port ? Number.parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
  if (Number.isNaN(port) || BLOCKED_PORTS.has(port)) {
    throw new UnsafeUrlError(`Port ${port} is not allowed`);
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw new UnsafeUrlError("URL has no hostname");
  }

  // Direct IP literal.
  const ipLiteral = isIP(hostname);
  if (ipLiteral > 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeUrlError("Private or reserved IP addresses are not allowed");
    }
    return url;
  }

  // Hostname: resolve and verify all returned IPs are public.
  const ips = await resolveIps(hostname);
  if (ips.length === 0) {
    throw new UnsafeUrlError("Could not resolve hostname");
  }

  for (const ip of ips) {
    if (isPrivateOrReservedIp(ip)) {
      throw new UnsafeUrlError("Hostname resolves to a private or reserved IP address");
    }
  }

  return url;
}

async function readBodyWithLimit(res: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) {
    return { text: "", truncated: false };
  }

  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (total < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = value as Uint8Array;
    const remaining = MAX_RESPONSE_BYTES - total;
    if (chunk.length > remaining) {
      chunks.push(chunk.slice(0, remaining));
      total = MAX_RESPONSE_BYTES;
      truncated = true;
      break;
    }
    chunks.push(chunk);
    total += chunk.length;
  }

  if (!truncated && total >= MAX_RESPONSE_BYTES) {
    truncated = true;
  }

  await reader.cancel();
  return { text: decoder.decode(concatChunks(chunks)), truncated };
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export interface GuardedFetchResult {
  ok: boolean;
  status: number;
  text: string;
  error?: string;
  truncated: boolean;
}

export async function guardedFetch(inputUrl: string): Promise<GuardedFetchResult> {
  let url = inputUrl;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    let validated: URL;
    try {
      validated = await assertSafeUrl(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, status: 0, text: "", error: message, truncated: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(validated.toString(), {
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (e) {
      clearTimeout(timer);
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, status: 0, text: "", error: message, truncated: false };
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, status: res.status, text: "", error: "Redirect without Location header", truncated: false };
      }
      url = new URL(location, validated).toString();
      redirectCount++;
      continue;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, text: "", error: `HTTP ${res.status}`, truncated: false };
    }

    const { text, truncated } = await readBodyWithLimit(res);
    return { ok: true, status: res.status, text, truncated };
  }

  return { ok: false, status: 0, text: "", error: "Too many redirects", truncated: false };
}
