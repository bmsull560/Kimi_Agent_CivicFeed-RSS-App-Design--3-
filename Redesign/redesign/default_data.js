export const DEFAULT_SITEMAP = [
  { id: "sm-01", label: "Dashboard / Stream", path: "/dashboard", depth: 0 },
  { id: "sm-02", label: "AI Civic TL;DR Digest", path: "/dashboard/tldr", depth: 1 },
  { id: "sm-03", label: "Custom Saved Briefings", path: "/dashboard/my-briefing", depth: 1 },
  { id: "sm-04", label: "Health & Environment Hub", path: "/hubs/health-environment", depth: 1 },
  {
    id: "sm-05",
    label: "Defense & Foreign Policy Hub",
    path: "/hubs/defense-foreign-policy",
    depth: 1,
  },
  { id: "sm-06", label: "Science & Innovation Hub", path: "/hubs/science-innovation", depth: 1 },
  { id: "sm-07", label: "Law & Economy Hub", path: "/hubs/law-economy", depth: 1 },
  {
    id: "sm-08",
    label: "Social Infrastructure Hub",
    path: "/hubs/social-infrastructure",
    depth: 1,
  },
  { id: "sm-09", label: "Priority Settings Core", path: "/settings/priority", depth: 1 },
  { id: "sm-10", label: "Developer API Portal", path: "/developer/api", depth: 0 },
];

export const DEFAULT_GANTT = [
  {
    id: "gt-1",
    label: "Phase 1: RSS Parser Modernization & Ingestion",
    start: 1,
    duration: 4,
    owner: "Lead Backend Architect",
  },
  {
    id: "gt-2",
    label: "Phase 2: Civic Clarity Design System & Tokens",
    start: 4,
    duration: 3,
    owner: "Principal UI/UX Designer",
  },
  {
    id: "gt-3",
    label: "Phase 3: AI Vector Embeddings & TL;DR Models",
    start: 7,
    duration: 4,
    owner: "Senior AI Specialist",
  },
  {
    id: "gt-4",
    label: "Phase 4: High-Fidelity Audio TTS & Feed Engine",
    start: 9,
    duration: 3,
    owner: "Frontend Audio Lead",
  },
  {
    id: "gt-5",
    label: "Phase 5: WCAG 2.1 AA Compliance & Audits",
    start: 12,
    duration: 2,
    owner: "Accessibility Director",
  },
];

export const COLOR_OPTIONS = [
  { name: "Liberty Blue (Primary)", hex: "#1D3557" },
  { name: "Parchment Warm (Background)", hex: "#F1FAEE" },
  { name: "Patriot Crimson (Alert Accent)", hex: "#E63946" },
  { name: "Deep Charcoal (Text Ground)", hex: "#2B2D42" },
  { name: "Celadon Green (Success Tint)", hex: "#457B9D" },
  { name: "Morning Sky (Subtle Blue)", hex: "#A8DADC" },
];

export const CORE_FEATURES_LIST = [
  {
    id: "feat-tldr",
    title: "Civic TL;DR (AI Policy Summarizer)",
    desc: "Leverages lightweight LLMs to turn complex, dry federal announcements from 505 feeds into digestible 3-sentence editorial bullet points.",
    problem:
      "Resolves severe cognitive overload of scrolling through raw legislative and administrative jargon.",
    priority: "High",
    state: "Core Feature Prototype",
  },
  {
    id: "feat-narrator",
    title: "Natural TTS Narration",
    desc: "Generates high-fidelity, expressive audio readings of policy briefings to enable hands-free listening on commute paths.",
    problem:
      "Solves accessibility barriers for visually impaired users and aids comprehension of dense reports.",
    priority: "Medium-High",
    state: "Audio Engine Sandbox",
  },
  {
    id: "feat-priority",
    title: "Smart Priority Feed Engine",
    desc: "Uses client-side threshold filters to identify high-importance agency statements, pushing them into critical feeds instantly.",
    problem:
      "Ensures essential regulatory announcements are not buried under high-frequency administrative noise.",
    priority: "High",
    state: "Algorithm Confirmed",
  },
  {
    id: "feat-hubs",
    title: "Thematic Hub Consolidation",
    desc: "Intelligently channels 21 disjointed, bureaucratic categories into 5 elegant visual streams matching human-centric interests.",
    problem: "Simplifies archaic siloed federal hierarchies into human-understandable categories.",
    priority: "High",
    state: "Navigation Implemented",
  },
  {
    id: "feat-briefing",
    title: "Interactive Weekly Briefing & Recap",
    desc: "Compiles targeted agency highlights into structured markdown newsletters and customizable digital dashboards.",
    problem:
      "Eliminates daily tracking exhaustion for policy analysts and active civic investigators.",
    priority: "Medium",
    state: "Output Engine Ready",
  },
];
