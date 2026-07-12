import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const feedsPath = path.join(root, "backend", "src", "feeds.ts");
const source = fs.readFileSync(feedsPath, "utf8");

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox, { filename: feedsPath });

const { feeds, categoryList } = sandbox.module.exports;
const activeFeeds = feeds.filter((feed) => feed.status === "working");

function jsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function renderFeed(feed, index) {
  const id = `feed-${String(index + 1).padStart(3, "0")}`;
  const priority = feed.priority ? `,priority:${feed.priority}` : "";
  const tags = `[${feed.tags.map(jsString).join(",")}]`;
  return `  {id:${jsString(id)},name:${jsString(feed.name)},shortName:${jsString(feed.shortName)},agency:${jsString(feed.agency)},description:${jsString(feed.description)},rssUrl:${jsString(feed.rssUrl)},website:${jsString(feed.website)},department:${jsString(feed.department)},category:${jsString(feed.category)},subCategory:${jsString(feed.subCategory)},contentType:${jsString(feed.contentType)},updateFrequency:${jsString(feed.updateFrequency)},status:"working" as const${priority},tags:${tags}},`;
}

const activeCategories = categoryList.filter((category) =>
  activeFeeds.some((feed) => feed.category === category)
);
const byCategory = Object.fromEntries(activeCategories.map((category) => [category, 0]));
for (const feed of activeFeeds) byCategory[feed.category] += 1;

const header = source.slice(0, source.indexOf("export const feeds: Feed[] = ["));
const helpersStart = source.indexOf("export const getFeedsByCategory");
if (helpersStart < 0) throw new Error("Could not find feed helper exports.");
const helpers = source.slice(helpersStart);

const nextSource = `${header}export const feeds: Feed[] = [
${activeFeeds.map(renderFeed).join("\n")}
];

export const feedStats = {
  total: ${activeFeeds.length},
  byCategory: {
${activeCategories.map((category) => `    ${jsString(category)}: ${byCategory[category]},`).join("\n")}
  },
  byStatus: { unverified: 0, working: ${activeFeeds.length}, blocked: 0 },
};

export const categoryList: string[] = [
${activeCategories.map((category) => `  ${jsString(category)},`).join("\n")}

];

${helpers}`;

fs.writeFileSync(feedsPath, nextSource);
console.log(
  `Synced active catalog to ${activeFeeds.length} working feeds across ${activeCategories.length} categories.`
);
