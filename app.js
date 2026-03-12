/* Alphabet of Refusal - tiny client-side router + localStorage persistence. */

const STORAGE_KEY = "aor.tree.v1";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function nowClock() {
  // Design is intentionally minimal; keep hook for future use.
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function loadTree() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const tree = raw ? safeParse(raw, null) : null;
  if (tree && typeof tree === "object") {
    // One-time cleanup: earlier iterations may have left demo content under D.
    // Keep the rest of the user's local state.
    if (!tree.__migrations || typeof tree.__migrations !== "object") tree.__migrations = {};
    if (!tree.__migrations.cleaned_d_20260312) {
      if (tree.folders && typeof tree.folders === "object") tree.folders.D = [];
      if (tree.layout && typeof tree.layout === "object") delete tree.layout["letter/D"];
      tree.__migrations.cleaned_d_20260312 = true;
      saveTree(tree);
    }

    // Ensure T contains a starter subfolder named "Test".
    if (!tree.__migrations.seed_t_test_20260312) {
      if (!tree.folders || typeof tree.folders !== "object") tree.folders = {};
      const list = Array.isArray(tree.folders.T) ? tree.folders.T : [];
      if (!list.includes("Test")) list.unshift("Test");
      tree.folders.T = list;
      tree.__migrations.seed_t_test_20260312 = true;
      saveTree(tree);
    }

    // One-time: snap the home screen back to the default 8-wide grid:
    // 8 + 8 + 8 + 2 for A–Z.
    if (!tree.__migrations.home_grid_8x_20260312) {
      if (tree.layout && typeof tree.layout === "object") delete tree.layout.home;
      tree.__migrations.home_grid_8x_20260312 = true;
      saveTree(tree);
    }
    return tree;
  }
  const fresh = {
    folders: { T: ["Test"] },
    layout: {},
    __migrations: { seed_t_test_20260312: true, cleaned_d_20260312: true, home_grid_8x_20260312: true },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveTree(tree) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
}

function ensureLayout(tree) {
  if (!tree.layout || typeof tree.layout !== "object") tree.layout = {};
  return tree.layout;
}

function layoutKey(route) {
  if (route.kind === "home") return "home";
  if (route.kind === "letter") return `letter/${route.letter}`;
  return null;
}

function defaultPosForIndex(i) {
  const col = i % 8;
  const row = Math.floor(i / 8);
  return { x: 20 + col * 120, y: 20 + row * 110 };
}

function getPos(tree, key, id, i) {
  const layout = ensureLayout(tree);
  if (!layout[key] || typeof layout[key] !== "object") layout[key] = {};
  const map = layout[key];
  if (!map[id] || typeof map[id] !== "object") {
    const used = new Set(
      Object.entries(map)
        .filter(([k, v]) => k !== id && v && typeof v === "object")
        .map(([, v]) => `${v.x},${v.y}`)
    );

    // If this view already has saved positions, avoid assigning a new icon
    // to a spot that another icon is using (common when inserting at the top).
    let j = i;
    let candidate = defaultPosForIndex(j);
    while (used.has(`${candidate.x},${candidate.y}`) && j < 200) {
      j += 1;
      candidate = defaultPosForIndex(j);
    }

    map[id] = candidate;
    saveTree(tree);
  }
  return map[id];
}

function ensureUniquePositions(tree, key, ids) {
  const layout = ensureLayout(tree);
  if (!layout[key] || typeof layout[key] !== "object") layout[key] = {};
  const map = layout[key];

  const used = new Set();
  let changed = false;

  const nextFree = () => {
    for (let j = 0; j < 400; j += 1) {
      const p = defaultPosForIndex(j);
      const sig = `${p.x},${p.y}`;
      if (!used.has(sig)) return p;
    }
    return defaultPosForIndex(0);
  };

  ids.forEach((id, i) => {
    let p = map[id];
    if (!p || typeof p !== "object" || typeof p.x !== "number" || typeof p.y !== "number") {
      p = getPos(tree, key, id, i);
    }
    const sig = `${p.x},${p.y}`;
    if (used.has(sig)) {
      const free = nextFree();
      map[id] = free;
      used.add(`${free.x},${free.y}`);
      changed = true;
      return;
    }
    used.add(sig);
  });

  if (changed) saveTree(tree);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function makeDraggable(item, link, tree, key, id) {
  let dragging = false;
  let moved = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  link.addEventListener("click", (e) => {
    if (item.dataset.dragging === "1") e.preventDefault();
  });

  item.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = false;
    moved = false;
    pointerId = e.pointerId;
    const rect = item.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
  });

  item.addEventListener("pointermove", (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) {
      dragging = true;
      item.dataset.dragging = "1";
      try {
        item.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture fails; dragging still works in most browsers.
      }
    }
    if (!dragging) return;
    moved = true;
    e.preventDefault();

    const parent = item.parentElement;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();

    const w = item.offsetWidth || 108;
    const h = item.offsetHeight || 92;

    const rawLeft = startLeft + dx - pr.left;
    const rawTop = startTop + dy - pr.top;
    const left = clamp(rawLeft, 0, Math.max(0, pr.width - w));
    const top = clamp(rawTop, 0, Math.max(0, pr.height - h));

    item.style.left = `${Math.round(left)}px`;
    item.style.top = `${Math.round(top)}px`;
  });

  item.addEventListener("pointerup", (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    pointerId = null;
    if (item.hasPointerCapture?.(e.pointerId)) {
      try {
        item.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    if (!moved) return;
    const layout = ensureLayout(tree);
    if (!layout[key] || typeof layout[key] !== "object") layout[key] = {};
    layout[key][id] = { x: parseInt(item.style.left || "0", 10), y: parseInt(item.style.top || "0", 10) };
    saveTree(tree);
    // Clear on next tick so clicks immediately after dragging don't open.
    window.setTimeout(() => {
      delete item.dataset.dragging;
    }, 0);
  });

  item.addEventListener("pointercancel", (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    pointerId = null;
    if (item.hasPointerCapture?.(e.pointerId)) {
      try {
        item.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    delete item.dataset.dragging;
  });
}

function randomName() {
  const a = [
    "tender",
    "broken",
    "loud",
    "quiet",
    "spare",
    "sealed",
    "unclear",
    "borrowed",
    "wrong",
    "soft",
    "burnt",
    "sleeping",
    "unfinished",
    "private",
    "public",
    "unpaid",
    "stubborn",
    "impossible",
    "later",
    "never",
  ];
  const n = [
    "drafts",
    "receipts",
    "apologies",
    "instructions",
    "questions",
    "excuses",
    "promises",
    "scripts",
    "notes",
    "voices",
    "maps",
    "proof",
    "versions",
    "warnings",
    "spare_parts",
    "misfiled_memory",
    "alt_titles",
    "small_no",
    "big_no",
    "do_not_open",
  ];
  const tail = Math.random().toString(16).slice(2, 6);
  return `${a[Math.floor(Math.random() * a.length)]}_${n[Math.floor(Math.random() * n.length)]}_${tail}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function parseRoute() {
  const h = window.location.hash || "#/";
  const raw = h.startsWith("#") ? h.slice(1) : h;
  const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { kind: "home" };
  const letter = parts[0]?.toUpperCase();
  if (!LETTERS.includes(letter)) return { kind: "home" };
  if (parts.length === 1) return { kind: "letter", letter };
  return { kind: "subfolder", letter, id: parts.slice(1).join("/") };
}

function setCrumb(route) {
  const el = document.getElementById("crumb");
  if (!el) return;
  // Breadcrumb UI removed (minimal). Keep hook for future use.
  void route;
}

function setWindowTitle(text) {
  const el = document.getElementById("windowTitle");
  if (el) el.textContent = text;
  document.title = text === "Alphabet of Refusal" ? "Alphabet of Refusal" : `${text} · Alphabet of Refusal`;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

function renderToolbar(route, tree) {
  const toolbar = document.getElementById("toolbar");
  if (!toolbar) return;
  toolbar.innerHTML = "";

  if (route.kind === "home") {
    // No controls on the home screen (minimal).
    return;
  }

  if (route.kind === "letter") {
    toolbar.appendChild(
      el("div", { class: "toolgroup" }, [
        el("a", { class: "btn", href: "#/" }, [document.createTextNode("Back to A–Z")]),
      ])
    );
    return;
  }

  toolbar.appendChild(
    el("div", { class: "toolgroup" }, [
      el("a", { class: "btn", href: `#/${route.letter}` }, [document.createTextNode("Back to letter")]),
      el("a", { class: "btn", href: "#/" }, [document.createTextNode("Back to A–Z")]),
    ])
  );
}

function folderTile(title, meta, href) {
  void meta; // Intentionally unused (minimal design).
  const item = el("div", { class: "iconItem" });
  const link = el("a", { class: "iconLink", href, role: "button" });
  link.appendChild(el("div", { class: "macFolder", "aria-hidden": "true" }));
  link.appendChild(el("div", { class: "iconLabel", html: escapeHtml(title) }));
  item.appendChild(link);
  return { item, link };
}

function renderHome(tree) {
  setWindowTitle("Alphabet of Refusal");
  const content = document.getElementById("content");
  content.innerHTML = "";
  const area = el("div", { class: "desktopArea" });
  const key = "home";
  LETTERS.forEach((letter, i) => {
    const { x, y } = getPos(tree, key, letter, i);
    const { item, link } = folderTile(letter, "", `#/${letter}`);
    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    makeDraggable(item, link, tree, key, letter);
    area.appendChild(item);
  });
  content.appendChild(area);
}

function renderLetter(route, tree) {
  setWindowTitle(route.letter);
  const content = document.getElementById("content");
  content.innerHTML = "";

  const list = tree.folders[route.letter] || [];

  if (list.length === 0) {
    content.appendChild(
      el("div", { class: "paper" }, [
        el("h2", { class: "pageTitle" }, [document.createTextNode(route.letter)]),
        el("p", {}, [document.createTextNode("No subfolders yet.")]),
      ])
    );
    return;
  }

  const key = layoutKey(route);
  ensureUniquePositions(tree, key, list);
  const area = el("div", { class: "desktopArea" });
  list.forEach((id, i) => {
    const { x, y } = getPos(tree, key, id, i);
    const { item, link } = folderTile(id, "", `#/${route.letter}/${encodeURIComponent(id)}`);
    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    makeDraggable(item, link, tree, key, id);
    area.appendChild(item);
  });
  content.appendChild(area);
}

function renderSubfolder(route, tree) {
  setWindowTitle(`${route.letter} / ${route.id}`);
  const content = document.getElementById("content");
  content.innerHTML = "";

  const wrap = el("div", { class: "paper" });
  wrap.appendChild(el("h2", { class: "pageTitle" }, [document.createTextNode(route.id)]));
  const hint = el("div", { class: "small" });
  hint.textContent = "Empty folder.";
  wrap.appendChild(hint);

  if (route.letter === "T" && route.id === "Test") {
    hint.textContent = "Document:";
    wrap.appendChild(el("hr", { class: "rule" }));
    const pdfPath = "./assets/docs/Crude-English-Catalogue.pdf";
    wrap.appendChild(
      el("p", {}, [
        el("a", { href: pdfPath, target: "_blank", rel: "noopener" }, [
          document.createTextNode("Crude-English-Catalogue.pdf (open in new tab)"),
        ]),
      ])
    );
    wrap.appendChild(
      el("object", {
        data: pdfPath,
        type: "application/pdf",
        style: "width: 100%; height: 70vh; border: 1px solid #d9d9d9; border-radius: 10px;",
      })
    );
  }

  content.appendChild(wrap);
}

function renderNotFound() {
  setWindowTitle("Alphabet of Refusal");
  const content = document.getElementById("content");
  content.innerHTML = "";
  content.appendChild(
    el("div", { class: "paper" }, [
      el("h2", { class: "pageTitle" }, [document.createTextNode("That folder doesn’t exist")]),
      el("p", {}, [document.createTextNode("Go back to the A–Z view and pick a letter.")]),
      el("p", {}, [el("a", { href: "#/", class: "btn" }, [document.createTextNode("Back to A–Z")])]),
    ])
  );
}

function render() {
  const route = parseRoute();
  const tree = loadTree();

  setCrumb(route);

  renderToolbar(route, tree);

  if (route.kind === "home") return renderHome(tree);
  if (route.kind === "letter") return renderLetter(route, tree);
  if (route.kind === "subfolder") {
    const list = tree.folders[route.letter] || [];
    if (!list.includes(route.id)) return renderNotFound();
    return renderSubfolder(route, tree);
  }
  return renderHome(tree);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  nowClock();
  if (!window.location.hash) window.location.hash = "#/";
  render();
});
