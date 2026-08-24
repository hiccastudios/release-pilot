const ALLOWED_ORIGINS = new Set([
  "https://release.hiccastudios.my.id",
  "https://release-pilot.pages.dev",
  "null",
]);

const json = (data, status = 200, origin = "null") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://release.hiccastudios.my.id",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

const clean = (value = "") => value
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

const cleanWiki = (value = "") => clean(value
  .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
  .replace(/\[\[([^\]]+)\]\]/g, "$1")
  .replace(/\{\{[^}]+\}\}/g, " "));

function possibleWriter(text = "") {
  const normalized = clean(text);
  const patterns = [
    /(?:diciptakan|digubah|ditulis)\s+oleh\s+([^.;|–—]{2,70})/i,
    /pencipta(?:\s+lagu)?(?:nya)?\s*(?:adalah|:|-)\s*([^.;|–—]{2,70})/i,
    /(?:lagu\s+)?ciptaan\s+([^.;|–—]{2,70})/i,
    /(?:merupakan\s+)?karya\s+([^.;|–—]{2,70})/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].replace(/\s+(?:yang|dan lagu|untuk|pada|dengan)\b.*$/i, "").trim();
  }
  return "";
}

function writerBesideTitle(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean(text).match(new RegExp(`${escaped}\\s*\\(([^)]+)\\)`, "i"))?.[1]?.trim() || "";
}

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: { "accept": accept, "user-agent": "HiccaReleaseResearch/1.0 (+https://release.hiccastudios.my.id)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Upstream ${response.status}`);
  return response.text();
}

async function wikipedia(title) {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `\"${title}\" pencipta lagu`, gsrlimit: "6",
    prop: "extracts|info", explaintext: "1", exchars: "8000", exlimit: "max", inprop: "url", format: "json", origin: "*",
  });
  const data = JSON.parse(await fetchText(`https://id.wikipedia.org/w/api.php?${params}`, "application/json"));
  const pages = Object.values(data?.query?.pages || {});
  const listTexts = await Promise.all(pages.map(async page => {
    if (!/^Daftar lagu/i.test(page.title)) return "";
    try {
      const params = new URLSearchParams({ action: "parse", page: page.title, prop: "wikitext", format: "json", origin: "*" });
      const parsed = JSON.parse(await fetchText(`https://id.wikipedia.org/w/api.php?${params}`, "application/json"));
      return cleanWiki(parsed?.parse?.wikitext?.["*"] || "");
    } catch { return ""; }
  }));
  return pages.map((page, index) => {
    const extract = clean(page.extract || "");
    const evidence = listTexts[index] || extract;
    const isComposerPage = extract.toLocaleLowerCase("id").includes(title.toLocaleLowerCase("id"))
      && /adalah.{0,180}pencipta lagu/i.test(extract.slice(0, 500));
    return {
      title, songwriter: writerBesideTitle(evidence, title) || possibleWriter(`${page.title}. ${evidence}`) || (isComposerPage ? page.title : ""),
      sourceTitle: page.title, sourceUrl: page.fullurl, snippet: (extract || evidence).slice(0, 260), source: "Wikipedia Indonesia",
    };
  });
}

async function googleNews(title, brief) {
  const query = `\"${title}\" pencipta lagu ${brief || "Indonesia"}`.trim();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const xml = await fetchText(url, "application/rss+xml, application/xml, text/xml");
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map(match => {
    const item = match[1];
    const sourceTitle = clean(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const snippet = clean(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]);
    return {
      title, songwriter: possibleWriter(`${sourceTitle}. ${snippet}`), sourceTitle,
      sourceUrl: clean(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]), snippet: snippet.slice(0, 260), source: "Google News",
    };
  });
}

async function googleSuggestions(title) {
  const query = `${title} pencipta lagu`;
  const data = JSON.parse(await fetchText(`https://www.google.com/complete/search?client=firefox&hl=id&q=${encodeURIComponent(query)}`, "application/json"));
  return (data?.[1] || []).slice(0, 5).map(suggestion => ({
    title, songwriter: possibleWriter(suggestion), sourceTitle: suggestion,
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`,
    snippet: "Saran pencarian Google. Buka sumber untuk verifikasi kredit.", source: "Google",
  }));
}

function rank(candidate, wantedTitle) {
  const haystack = `${candidate.sourceTitle} ${candidate.snippet}`.toLocaleLowerCase("id");
  const words = wantedTitle.toLocaleLowerCase("id").split(/\s+/).filter(word => word.length > 2);
  return words.filter(word => haystack.includes(word)).length * 2 + (candidate.songwriter ? 5 : 0);
}

export default {
  async fetch(request) {
    const origin = request.headers.get("origin") || "null";
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://release.hiccastudios.my.id",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
    });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true }, 200, origin);
    if (url.pathname !== "/research" || request.method !== "POST") return json({ error: "Not found" }, 404, origin);
    try {
      const body = await request.json();
      const title = String(body?.title || "").trim().slice(0, 160);
      const brief = String(body?.brief || "").trim().slice(0, 500);
      if (!title) return json({ error: "Judul wajib diisi." }, 400, origin);
      const settled = await Promise.allSettled([googleNews(title, brief), wikipedia(title), googleSuggestions(title)]);
      const raw = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
      const seen = new Set();
      const candidates = raw
        .filter(item => item.sourceUrl && !seen.has(item.sourceUrl) && seen.add(item.sourceUrl))
        .sort((a, b) => rank(b, title) - rank(a, title))
        .slice(0, 10);
      return json({ title, candidates, googleUrl: `https://www.google.com/search?q=${encodeURIComponent(`\"${title}\" pencipta lagu ${brief}`.trim())}` }, 200, origin);
    } catch (error) {
      console.error(JSON.stringify({ event: "research_error", message: error instanceof Error ? error.message : "Unknown error" }));
      return json({ error: "Riset gagal sementara. Coba lagi." }, 502, origin);
    }
  },
};
