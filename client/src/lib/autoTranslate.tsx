import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

// Auto-translates ALL visible text on the page into the chosen language by
// walking DOM text nodes, sending the English to /api/translate, and swapping
// the text in place. Re-runs as the UI changes (router, modals, lists).
//
// Notes:
// - The original English is remembered per node so switching back restores it.
// - Translations are cached in memory + localStorage, so each unique string is
//   only fetched once per language.
// - Nodes inside inputs, code blocks, or marked [data-no-translate] are skipped.

const ORIGINAL = new WeakMap<Text, string>();
const TOUCHED = new Set<Text>();
let applying = false;

function loadCache(lang: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(`tr-cache-${lang}`);
    if (raw) return new Map(Object.entries(JSON.parse(raw)));
  } catch {}
  return new Map();
}

function saveCache(lang: string, cache: Map<string, string>) {
  try {
    localStorage.setItem(`tr-cache-${lang}`, JSON.stringify(Object.fromEntries(cache)));
  } catch {}
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "INPUT", "SELECT", "OPTION"]);

function shouldSkip(node: Text): boolean {
  const p = node.parentElement;
  if (!p) return true;
  if (SKIP_TAGS.has(p.tagName)) return true;
  if (p.isContentEditable) return true;
  if (p.closest('[data-no-translate],[translate="no"]')) return true;
  const orig = ORIGINAL.get(node) ?? node.nodeValue ?? "";
  const trimmed = orig.trim();
  if (trimmed.length < 2) return true;
  // Skip anything without letters (pure numbers, scores, emoji, symbols).
  if (!/[A-Za-z]/.test(trimmed)) return true;
  return false;
}

function collect(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    if (!shouldSkip(t)) nodes.push(t);
  }
  return nodes;
}

function restoreAll() {
  applying = true;
  TOUCHED.forEach((node) => {
    const orig = ORIGINAL.get(node);
    if (orig != null && node.nodeValue !== orig) node.nodeValue = orig;
  });
  TOUCHED.clear();
  applying = false;
}

async function translateNodes(nodes: Text[], lang: string, cache: Map<string, string>) {
  // Remember originals and figure out which strings still need translating.
  const need = new Set<string>();
  for (const node of nodes) {
    if (!ORIGINAL.has(node)) ORIGINAL.set(node, node.nodeValue ?? "");
    const key = (ORIGINAL.get(node) ?? "").trim();
    if (key && !cache.has(key)) need.add(key);
  }

  if (need.size) {
    const arr = Array.from(need);
    for (let i = 0; i < arr.length; i += 60) {
      const batch = arr.slice(i, i + 60);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: batch, target: lang }),
        });
        const data = await res.json();
        (data.translations || []).forEach((tr: string, j: number) => {
          if (typeof tr === "string") cache.set(batch[j], tr);
        });
      } catch {}
    }
    saveCache(lang, cache);
  }

  // Apply translations, preserving leading/trailing whitespace.
  applying = true;
  for (const node of nodes) {
    const orig = ORIGINAL.get(node) ?? "";
    const trimmed = orig.trim();
    const tr = cache.get(trimmed);
    if (tr && tr !== trimmed) {
      const lead = orig.match(/^\s*/)?.[0] ?? "";
      const trail = orig.match(/\s*$/)?.[0] ?? "";
      const next = lead + tr + trail;
      if (node.nodeValue !== next) node.nodeValue = next;
      TOUCHED.add(node);
    }
  }
  applying = false;
}

export function AutoTranslate() {
  const { lang } = useTranslation();

  useEffect(() => {
    if (lang === "en") {
      restoreAll();
      return;
    }
    let cancelled = false;
    const cache = loadCache(lang);

    const run = () => {
      if (cancelled || applying) return;
      const nodes = collect(document.body);
      void translateNodes(nodes, lang, cache);
    };

    // Initial pass (let the current route render first).
    const initial = setTimeout(run, 50);

    // Re-translate when the DOM changes (navigation, modals, live lists).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver(() => {
      if (applying) return;
      clearTimeout(timer);
      timer = setTimeout(run, 350);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearTimeout(timer);
      obs.disconnect();
    };
  }, [lang]);

  return null;
}
