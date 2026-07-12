import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const feedsPath = path.join(root, "backend", "src", "feeds.ts");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const govinfoPath = args.get("--govinfo");
const dvidsPath = args.get("--dvids");
const govinfoLimit = Number(args.get("--govinfo-limit") ?? "174");
const dvidsLimit = Number(args.get("--dvids-limit") ?? "80");
const targetWorkingFeeds = Number(args.get("--target-working") ?? "505");

if (!govinfoPath && !dvidsPath) {
  console.error("Usage: node scripts/append-validated-feeds.mjs --govinfo <json> --dvids <json>");
  process.exit(1);
}

const source = fs.readFileSync(feedsPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
};
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox, { filename: feedsPath });

const { feeds, categoryList } = sandbox.exports;
const existingUrls = new Set(feeds.map((feed) => feed.rssUrl));

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, filePath), "utf8"));
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+New items on GovInfo$/i, "")
    .replace(/\s+items on GovInfo$/i, "")
    .trim();
}

function shortName(value, maxLength = 50) {
  const trimmed = clean(value);
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

function jsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function tags(values) {
  return [...new Set(values.map((value) => String(value).toLowerCase()).filter(Boolean))];
}

function govinfoCategory(title, url) {
  const value = `${title} ${url}`.toLowerCase();
  if (value.includes("uscourts")) return "Courts & Judiciary";
  if (value.includes("federal register") || value.includes("regulations") || value.includes("cfr")) return "Rulemaking & Regulations";
  if (value.includes("economic") || value.includes("budget")) return "Finance & Economy";
  if (value.includes("gao")) return "Oversight & Audits";
  if (value.includes("public papers") || value.includes("presidential") || value.includes("daily compilation")) return "Executive & Press";
  return "Congress & Legislation";
}

function govinfoFeed(entry) {
  const rawTitle = clean(entry.title || entry.url.split("/").at(-1));
  const title = rawTitle.replace(/\s+-\s+Bulk Data Feed$/i, " Bulk Data");
  const category = govinfoCategory(title, entry.url);
  const subCategory = category === "Courts & Judiciary" ? "Federal court records" : category;
  return {
    name: `GovInfo - ${title}`,
    shortName: shortName(`GovInfo ${title}`),
    agency: "U.S. Government Publishing Office / GovInfo",
    description: `Official GovInfo updates for ${title.toLowerCase()}.`,
    rssUrl: entry.url,
    website: "https://www.govinfo.gov",
    department: "GPO",
    category,
    subCategory,
    contentType: category === "Courts & Judiciary" ? "Court document feed" : "Government document feed",
    updateFrequency: "",
    status: "working",
    priority: category === "Oversight & Audits" ? 6 : undefined,
    tags: tags([category, "gpo", "govinfo", category === "Courts & Judiciary" ? "courts" : "documents"]),
  };
}

function dvidsFeed(entry) {
  const unit = clean(String(entry.title ?? "").replace(/^DVIDS Unit RSS Feed:\s*/i, "")) || `DVIDS Unit ${entry.id}`;
  return {
    name: `${unit} Updates`,
    shortName: shortName(unit),
    agency: "Defense Visual Information Distribution Service (DVIDS)",
    description: `Official DVIDS media updates for ${unit}.`,
    rssUrl: entry.url,
    website: "https://www.dvidshub.net",
    department: "DOD",
    category: "Defense & Security",
    subCategory: "Military media",
    contentType: "Unit media feed",
    updateFrequency: "",
    status: "working",
    priority: 5,
    tags: tags(["Defense & Security", "dvids", "dod", "military", "media"]),
  };
}

function uniqueWorking(entries, mapper, limit) {
  const selected = [];
  if (limit <= 0) return selected;
  for (const entry of entries) {
    if (!entry?.url || existingUrls.has(entry.url) || Number(entry.count ?? 0) <= 0) continue;
    const feed = mapper(entry);
    if (!categoryList.includes(feed.category)) {
      throw new Error(`Unknown category "${feed.category}" for ${feed.rssUrl}`);
    }
    selected.push(feed);
    existingUrls.add(feed.rssUrl);
    if (selected.length >= limit) break;
  }
  return selected;
}

const currentWorkingFeeds = feeds.filter((feed) => feed.status === "working").length;
let remainingNeeded = Math.max(0, targetWorkingFeeds - currentWorkingFeeds);
const govinfoAdditions = govinfoPath
  ? uniqueWorking(loadJson(govinfoPath), govinfoFeed, Math.min(govinfoLimit, remainingNeeded))
  : [];
remainingNeeded -= govinfoAdditions.length;
const dvidsAdditions = dvidsPath
  ? uniqueWorking(loadJson(dvidsPath), dvidsFeed, Math.min(dvidsLimit, remainingNeeded))
  : [];

const additions = [
  ...govinfoAdditions,
  ...dvidsAdditions,
];

let nextId = feeds.length + 1;
const renderedAdditions = additions.map((feed) => {
  const id = `feed-${String(nextId++).padStart(3, "0")}`;
  const priority = feed.priority ? `,priority:${feed.priority}` : "";
  const renderedTags = `[${feed.tags.map(jsString).join(",")}]`;
  return `  {id:${jsString(id)},name:${jsString(feed.name)},shortName:${jsString(feed.shortName)},agency:${jsString(feed.agency)},description:${jsString(feed.description)},rssUrl:${jsString(feed.rssUrl)},website:${jsString(feed.website)},department:${jsString(feed.department)},category:${jsString(feed.category)},subCategory:${jsString(feed.subCategory)},contentType:${jsString(feed.contentType)},updateFrequency:${jsString(feed.updateFrequency)},status:"working" as const${priority},tags:${renderedTags}},`;
});

const allFeeds = [...feeds, ...additions.map((feed, offset) => ({ ...feed, id: `feed-${String(feeds.length + offset + 1).padStart(3, "0")}` }))];
const byCategory = Object.fromEntries(categoryList.map((category) => [category, 0]));
const byStatus = { unverified: 0, working: 0, blocked: 0 };
for (const feed of allFeeds) {
  byCategory[feed.category] += 1;
  byStatus[feed.status] += 1;
}

let updated = source;
if (renderedAdditions.length > 0) {
  const feedArrayEnd = /\r?\n\];\r?\n\r?\nexport const feedStats = /;
  if (!feedArrayEnd.test(source)) {
    throw new Error("Could not locate feeds array terminator before feedStats.");
  }
  updated = updated.replace(feedArrayEnd, `\n\n  // --- VALIDATED FEDERAL DOCUMENT AND MILITARY MEDIA FEEDS ---\n${renderedAdditions.join("\n")}\n];\n\nexport const feedStats = `);
}
updated = updated.replace(/total: \d+,/, `total: ${allFeeds.length},`);
updated = updated.replace(/byCategory: \{[\s\S]*?\r?\n\s*\},\r?\n\s*byStatus:/, `byCategory: {\n${categoryList.map((category) => `    ${jsString(category)}: ${byCategory[category]},`).join("\n")}\n  },\n  byStatus:`);
updated = updated.replace(/byStatus: \{[^}]+ \}/, `byStatus: { unverified: ${byStatus.unverified}, working: ${byStatus.working}, blocked: ${byStatus.blocked} }`);

fs.writeFileSync(feedsPath, updated);
console.log(`Appended ${additions.length} validated feeds. Working feeds: ${byStatus.working}/${allFeeds.length}.`);
