import {
  DEFAULT_SITEMAP,
  DEFAULT_GANTT,
  COLOR_OPTIONS,
  CORE_FEATURES_LIST,
} from "./default_data.js";

let state = {
  sitemap: [],
  gantt: [],
  features: [],
  contrast: { bg: "#1D3557", fg: "#F1FAEE" },
  checks: {},
};

function saveState() {
  localStorage.setItem("civic_clarity_state", JSON.stringify(state));
  updateWorkspaceStats();
}

function loadState() {
  const saved = localStorage.getItem("civic_clarity_state");
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (e) {
      console.error("Error loading state from localStorage, falling back to defaults.", e);
      resetToDefaults();
    }
  } else {
    resetToDefaults();
  }
}

function resetToDefaults() {
  state.sitemap = JSON.parse(JSON.stringify(DEFAULT_SITEMAP));
  state.gantt = JSON.parse(JSON.stringify(DEFAULT_GANTT));
  state.features = JSON.parse(JSON.stringify(CORE_FEATURES_LIST));
  state.contrast = { bg: "#1D3557", fg: "#F1FAEE" };
  state.checks = {};
  saveState();
}

function updateWorkspaceStats() {
  const smCount = document.getElementById("stat-sitemap-count");
  const gtCount = document.getElementById("stat-gantt-count");
  const chCount = document.getElementById("stat-checks-count");
  const lsSaved = document.getElementById("stat-last-saved");

  if (smCount) smCount.textContent = state.sitemap.length;
  if (gtCount) gtCount.textContent = state.gantt.length;

  const totalChecks = document.querySelectorAll(".workspace-checkbox").length;
  const activeChecks = Object.values(state.checks).filter(Boolean).length;
  if (chCount) chCount.textContent = `${activeChecks}/${totalChecks}`;

  if (lsSaved) {
    const d = new Date();
    lsSaved.textContent = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}

function renderSitemap() {
  const treeCanvas = document.getElementById("sitemap-tree-canvas");
  const editorList = document.getElementById("sitemap-editor-list");
  if (!treeCanvas || !editorList) return;

  editorList.innerHTML = "";
  state.sitemap.forEach((node) => {
    const div = document.createElement("div");
    div.className = "p-2 bg-civic-slate-900 rounded border border-civic-slate-800 space-y-1.5";
    div.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <input type="text" value="${node.label}" data-id="${node.id}" class="node-label-input bg-transparent border-b border-civic-slate-800 focus:border-civic-gold-500 outline-none text-xs text-white font-medium w-full">
        <button class="node-delete-btn text-slate-500 hover:text-red-400 transition-colors" data-id="${node.id}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="flex items-center gap-1.5 justify-between">
        <span class="text-[9px] font-mono text-slate-500 block truncate max-w-[110px]">${node.path}</span>
        <div class="flex items-center gap-1 bg-civic-slate-950 p-0.5 rounded border border-civic-slate-800">
          <button class="depth-btn px-1 py-0.5 rounded text-[9px] font-semibold transition-colors ${node.depth === 0 ? "bg-civic-gold-500 text-civic-slate-950" : "text-slate-400 hover:text-white"}" data-id="${node.id}" data-depth="0">Top</button>
          <button class="depth-btn px-1 py-0.5 rounded text-[9px] font-semibold transition-colors ${node.depth === 1 ? "bg-civic-gold-500 text-civic-slate-950" : "text-slate-400 hover:text-white"}" data-id="${node.id}" data-depth="1">Sub</button>
        </div>
      </div>
    `;
    editorList.appendChild(div);
  });

  treeCanvas.innerHTML = "";
  const rootUl = document.createElement("ul");
  rootUl.className = "space-y-2";

  state.sitemap.forEach((node) => {
    const li = document.createElement("li");
    li.className = `${node.depth > 0 ? "ml-8 pl-4 border-l-2 border-civic-slate-800" : ""} transition-all duration-300`;

    li.innerHTML = `
      <div class="flex items-center gap-2.5 p-2 bg-civic-navy-900/20 hover:bg-civic-navy-900/40 border border-civic-slate-800/80 rounded-lg transition-colors">
        <i data-lucide="${node.depth === 0 ? "folder" : "file-text"}" class="w-4 h-4 ${node.depth === 0 ? "text-civic-gold-400" : "text-civic-sage-400"}"></i>
        <div class="flex-1">
          <span class="text-xs font-semibold text-white block">${node.label}</span>
          <span class="text-[10px] text-slate-500 font-mono">${node.path}</span>
        </div>
      </div>
    `;
    rootUl.appendChild(li);
  });

  treeCanvas.appendChild(rootUl);
  lucide.createIcons();
  attachSitemapListeners();
}

function attachSitemapListeners() {
  document.querySelectorAll(".node-label-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-id");
      const node = state.sitemap.find((n) => n.id === id);
      if (node) {
        node.label = e.target.value;
        node.path =
          "/" +
          e.target.value
            .toLowerCase()
            .replace(new RegExp("[^a-z0-9 ]", "g"), "")
            .replace(new RegExp(" ", "g"), "-");
        saveState();
        renderSitemap();
      }
    });
  });

  document.querySelectorAll(".node-delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const button = e.currentTarget;
      const id = button.getAttribute("data-id");
      state.sitemap = state.sitemap.filter((n) => n.id !== id);
      saveState();
      renderSitemap();
    });
  });

  document.querySelectorAll(".depth-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      const depth = parseInt(e.target.getAttribute("data-depth"), 10);
      const node = state.sitemap.find((n) => n.id === id);
      if (node) {
        node.depth = depth;
        saveState();
        renderSitemap();
      }
    });
  });
}

function renderGantt() {
  const container = document.getElementById("gantt-rows-container");
  const selector = document.getElementById("gantt-select-milestone");
  if (!container || !selector) return;

  container.innerHTML = "";
  state.gantt.forEach((item) => {
    const row = document.createElement("div");
    row.className = "gantt-row py-1 text-xs";

    const startCol = item.start;
    const spanCol = item.duration;

    row.innerHTML = `
      <div class="gantt-label-col">
        <span class="font-semibold text-white block truncate" title="${item.label}">${item.label}</span>
        <span class="text-[10px] text-slate-400 block">${item.owner}</span>
      </div>
      <div class="gantt-grid-col grid grid-cols-14 gap-1 relative">
        <div class="h-6 rounded bg-gradient-to-r from-civic-navy-500 to-civic-gold-500/80 border border-civic-gold-500/30 text-[10px] text-white flex items-center px-2 font-mono shadow-md truncate"
             style="grid-column: ${startCol} / span ${spanCol}">
          W${startCol} - W${startCol + spanCol - 1} (${spanCol}w)
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  const currentVal = selector.value;
  selector.innerHTML = "";
  state.gantt.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.label;
    selector.appendChild(opt);
  });
  if (currentVal && state.gantt.some((i) => i.id === currentVal)) {
    selector.value = currentVal;
  }
  updateGanttFormValues();
}

function updateGanttFormValues() {
  const selector = document.getElementById("gantt-select-milestone");
  const startInput = document.getElementById("gantt-start-val");
  const durInput = document.getElementById("gantt-duration-val");
  const ownerInput = document.getElementById("gantt-owner-val");

  if (!selector || !startInput || !durInput || !ownerInput) return;

  const selectedId = selector.value;
  const item = state.gantt.find((i) => i.id === selectedId);
  if (item) {
    startInput.value = item.start;
    durInput.value = item.duration;
    ownerInput.value = item.owner;
  }
}

function renderFeatures() {
  const container = document.getElementById("features-cards-container");
  if (!container) return;

  container.innerHTML = "";
  state.features.forEach((feat) => {
    const card = document.createElement("div");
    card.className =
      "p-5 bg-civic-slate-900/60 border border-civic-slate-800 rounded-xl space-y-3 hover:border-civic-gold-500/40 transition-colors";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h4 class="text-lg font-serif font-semibold text-white">${feat.title}</h4>
          <p class="text-slate-300 text-xs mt-1 leading-relaxed">${feat.desc}</p>
        </div>
        <span class="px-2.5 py-1 rounded bg-civic-navy-900/80 border border-civic-slate-800 text-[10px] font-mono font-semibold uppercase tracking-wider text-civic-gold-400">
          Priority: ${feat.priority}
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-civic-slate-800/60 text-xs">
        <div>
          <span class="text-slate-500 font-mono uppercase text-[9px] block">Public Problem Solved</span>
          <span class="text-slate-300">${feat.problem}</span>
        </div>
        <div class="flex items-center justify-between sm:justify-end gap-3 self-end">
          <span class="text-slate-500 font-mono uppercase text-[9px] block sm:inline">Status</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-civic-sage-900/30 border border-civic-sage-500 text-civic-sage-400">
            ${feat.state}
          </span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function calculateRelativeLuminance(hex) {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function calculateContrastRatio(color1, color2) {
  const lum1 = calculateRelativeLuminance(color1);
  const lum2 = calculateRelativeLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function renderContrastTool() {
  const bgSelect = document.getElementById("contrast-bg-select");
  const fgSelect = document.getElementById("contrast-fg-select");
  const showcaseCard = document.getElementById("contrast-showcase-card");
  const sampleTextBlock = document.getElementById("contrast-sample-text-block");
  const ratioVal = document.getElementById("contrast-ratio-val");

  if (!bgSelect || !fgSelect || !showcaseCard || !sampleTextBlock) return;

  if (bgSelect.options.length === 0) {
    COLOR_OPTIONS.forEach((opt) => {
      const bOption = document.createElement("option");
      bOption.value = opt.hex;
      bOption.textContent = `${opt.name} (${opt.hex})`;
      bgSelect.appendChild(bOption);

      const fOption = document.createElement("option");
      fOption.value = opt.hex;
      fOption.textContent = `${opt.name} (${opt.hex})`;
      fgSelect.appendChild(fOption);
    });

    bgSelect.value = state.contrast.bg;
    fgSelect.value = state.contrast.fg;
  }

  const currentBg = bgSelect.value;
  const currentFg = fgSelect.value;

  sampleTextBlock.style.backgroundColor = currentBg;
  sampleTextBlock.style.color = currentFg;

  const ratio = calculateContrastRatio(currentBg, currentFg);
  ratioVal.textContent = `${ratio.toFixed(2)}:1`;

  const passNormalAA = ratio >= 4.5;
  const passNormalAAA = ratio >= 7.0;
  const passLargeAA = ratio >= 3.0;
  const passLargeAAA = ratio >= 4.5;

  updateContrastTag("tag-normal-aa", passNormalAA);
  updateContrastTag("tag-normal-aaa", passNormalAAA);
  updateContrastTag("tag-large-aa", passLargeAA);
  updateContrastTag("tag-large-aaa", passLargeAAA);

  state.contrast.bg = currentBg;
  state.contrast.fg = currentFg;
  saveState();
}

function updateContrastTag(id, passed) {
  const el = document.getElementById(id);
  if (!el) return;
  if (passed) {
    el.className = "text-xs font-bold text-emerald-400 block font-sans mt-0.5";
    el.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 inline mr-0.5"></i> PASS';
  } else {
    el.className = "text-xs font-bold text-red-400 block font-sans mt-0.5";
    el.innerHTML = '<i data-lucide="x" class="w-3.5 h-3.5 inline mr-0.5"></i> FAIL';
  }
  lucide.createIcons();
}

function setupPlaygrounds() {
  const bookmarkBtn = document.getElementById("playground-bookmark-btn");
  const bookmarkIcon = document.getElementById("playground-bookmark-icon");
  const bookmarkTxt = document.getElementById("playground-bookmark-txt");

  const audioBtn = document.getElementById("playground-audio-btn");
  const audioVisualizer = document.getElementById("audio-visualizer-bars");
  const audioTxt = document.getElementById("playground-audio-txt");

  let isBookmarked = false;
  let isPlayingAudio = false;

  bookmarkBtn?.addEventListener("click", () => {
    isBookmarked = !isBookmarked;

    bookmarkBtn.classList.add("spring-active");
    setTimeout(() => {
      bookmarkBtn.classList.remove("spring-active");
      bookmarkBtn.classList.add("spring-settle");

      if (isBookmarked) {
        bookmarkIcon.classList.remove("text-slate-400");
        bookmarkIcon.classList.add("text-civic-gold-400", "fill-civic-gold-500");
        bookmarkTxt.textContent = "Saved to Workspace";
      } else {
        bookmarkIcon.classList.add("text-slate-400");
        bookmarkIcon.classList.remove("text-civic-gold-400", "fill-civic-gold-500");
        bookmarkTxt.textContent = "Save Proposal Item";
      }
      setTimeout(() => bookmarkBtn.classList.remove("spring-settle"), 100);
    }, 120);
  });

  audioBtn?.addEventListener("click", () => {
    isPlayingAudio = !isPlayingAudio;
    if (isPlayingAudio) {
      audioVisualizer.classList.add("playing-state");
      audioTxt.textContent = "Synthesizing...";
    } else {
      audioVisualizer.classList.remove("playing-state");
      audioTxt.textContent = "Listen to Summary";
    }
  });
}

function exportWorkspaceMarkdown() {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let md = `# Civic Clarity Redesign Blueprint & Strategy Core Export\n`;
  md += `**Date:** ${dateStr}\n`;
  md += `**Target System:** CivicFeed Federal RSS Aggregator Curation Portal\n`;
  md += `**Aesthetic Mandate:** Warm Civic Minimalism (WCAG Level AAA Targets)\n\n`;

  md += `## 1. STRATEGIC GOALS CHECKLIST\n`;
  document.querySelectorAll(".workspace-checkbox").forEach((chk) => {
    const parentText =
      chk.closest("label")?.innerText.replace(new RegExp("\\n", "g"), " - ") ||
      `Goal ID: ${chk.id}`;
    const status = chk.checked ? "[x]" : "[ ]";
    md += `${status} ${parentText}\n`;
  });
  md += `\n`;

  md += `## 2. PROPOSED SITE HIERARCHY MAP\n`;
  md += `\`\`\`\n`;
  state.sitemap.forEach((node) => {
    const indent = "  ".repeat(node.depth);
    md += `${indent}- ${node.label} (${node.path})\n`;
  });
  md += `\`\`\`\n\n`;

  md += `## 3. PROPOSED ROLLOUT TIMELINE\n`;
  md += `| Milestone Name | Start Week | Duration | Lead Owner |\n`;
  md += `| :--- | :---: | :---: | :--- |\n`;
  state.gantt.forEach((item) => {
    md += `| ${item.label} | Week ${item.start} | ${item.duration} Weeks | ${item.owner} |\n`;
  });
  md += `\n`;

  md += `## 4. DESIGN SYSTEM VISUAL ACCESSIBILITY METRICS\n`;
  md += `- Background Palette Choice: \`${state.contrast.bg}\`\n`;
  md += `- Foreground Text Selection: \`${state.contrast.fg}\`\n`;
  const ratio = calculateContrastRatio(state.contrast.bg, state.contrast.fg);
  md += `- Evaluated WCAG Contrast Ratio: **${ratio.toFixed(2)}:1** (Passes AA: ${ratio >= 4.5}, Passes AAA: ${ratio >= 7.0})\n\n`;

  md += `--- \n*Generated from the Civic Clarity Proposal Strategy Workspace.*`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "civic_clarity_redesign_strategy.md");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setupCheckboxTracking() {
  document.querySelectorAll(".workspace-checkbox").forEach((chk) => {
    const id = chk.id;

    if (state.checks[id]) {
      chk.checked = true;
    }

    chk.addEventListener("change", (e) => {
      state.checks[id] = e.target.checked;
      saveState();
    });
  });
}

function handleResetAction() {
  if (
    confirm("Are you sure you want to reset this planning environment back to standard defaults?")
  ) {
    localStorage.removeItem("civic_clarity_state");
    location.reload();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadState();

  renderSitemap();
  renderGantt();
  renderFeatures();
  renderContrastTool();
  setupCheckboxTracking();
  setupPlaygrounds();
  updateWorkspaceStats();

  document.getElementById("btn-add-sitemap-node")?.addEventListener("click", () => {
    const label = prompt("Enter the name of your new sitemap node:");
    if (label) {
      const id = "sm-custom-" + Date.now();
      const path =
        "/" +
        label
          .toLowerCase()
          .replace(new RegExp("[^a-z0-9 ]", "g"), "")
          .replace(new RegExp(" ", "g"), "-");
      state.sitemap.push({ id, label, path, depth: 1 });
      saveState();
      renderSitemap();
    }
  });

  document
    .getElementById("gantt-select-milestone")
    ?.addEventListener("change", updateGanttFormValues);

  document.getElementById("btn-update-gantt")?.addEventListener("click", () => {
    const selector = document.getElementById("gantt-select-milestone");
    const startInput = document.getElementById("gantt-start-val");
    const durInput = document.getElementById("gantt-duration-val");
    const ownerInput = document.getElementById("gantt-owner-val");

    if (selector && startInput && durInput && ownerInput) {
      const selectedId = selector.value;
      const item = state.gantt.find((i) => i.id === selectedId);
      if (item) {
        item.start = Math.max(1, Math.min(14, parseInt(startInput.value, 10) || 1));
        item.duration = Math.max(1, Math.min(14, parseInt(durInput.value, 10) || 1));
        item.owner = ownerInput.value;
        saveState();
        renderGantt();
      }
    }
  });

  document.getElementById("contrast-bg-select")?.addEventListener("change", renderContrastTool);
  document.getElementById("contrast-fg-select")?.addEventListener("change", renderContrastTool);
  document
    .getElementById("btn-export-workspace")
    ?.addEventListener("click", exportWorkspaceMarkdown);
  document.getElementById("btn-reset-workspace")?.addEventListener("click", handleResetAction);

  const sections = document.querySelectorAll("section[id]");
  const navItems = document.querySelectorAll(".nav-item");

  window.addEventListener("scroll", () => {
    let currentId = "";
    const scrollPos = window.scrollY + 120;

    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = sec.getAttribute("id");
      }
    });

    navItems.forEach((item) => {
      item.classList.remove("nav-item-active");
      const href = item.getAttribute("href");
      if (href === `#${currentId}`) {
        item.classList.add("nav-item-active");
      }
    });
  });

  lucide.createIcons();
});
