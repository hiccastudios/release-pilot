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
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ").trim();

const titleCase = value => value.toLocaleLowerCase("id").replace(/(^|[\s'’(-])\p{L}/gu, letter => letter.toLocaleUpperCase("id"));

function likelyTitle(value = "") {
  const withoutExtension = clean(value).replace(/\.(?:wav|flac|mp3|m4a|aiff?)$/i, "");
  const normalized = withoutExtension
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—]\s*(?:master(?:ed)?|mst|final(?: mix)?|mix(?:down)?|remix|edit|radio edit|instrumental|karaoke|demo|rough|preview|version|versi|rev(?:isi)?|take)(?:\s*[a-z]?\d+)?\s*$/i, "")
    .replace(/(?:^|\s)(?:master(?:ed)?|mst|final(?: mix)?|mix(?:down)?|edit|demo|rough|preview|version|versi|rev(?:isi)?|take)(?:\s*[a-z]?\d+)?\s*$/i, "")
    .replace(/(?:^|\s)m\d+\s*$/i, "")
    .replace(/\s+/g, " ").trim();
  return titleCase(normalized || withoutExtension);
}

const cleanWiki = (value = "") => clean(value
  .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
  .replace(/\[\[([^\]]+)\]\]/g, "$1")
  .replace(/\{\{[^}]+\}\}/g, " "));

function possibleWriter(text = "") {
  const normalized = clean(text);
  const patterns = [
    /(?:diciptakan|digubah|ditulis)(?:\s+oleh)?\s*[:,-]?\s+([^.;|–—]{2,70})/i,
    /pencipta(?:\s+lagu)?(?:nya)?\s*(?:adalah|ialah|:|-)?\s*([^.;|–—]{2,70})/i,
    /(?:lagu\s+)?ciptaan\s+([^.;|–—]{2,70})/i,
    /(?:merupakan\s+)?karya\s+([^.;|–—]{2,70})/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].replace(/\s+(?:yang|dan lagu|untuk|pada|dengan)\b.*$/i, "").trim();
  }
  return "";
}

const compactTitle = value => clean(value).toLocaleLowerCase("id").replace(/[^\p{L}\p{N}]+/gu, "");

function canonicalFromHeadline(headline, wantedTitle) {
  const patterns = [
    /(?:lirik|chord|makna)\s+(?:lagu\s+)?(.+?)\s+(?:-|–|—)\s+/i,
    /judul(?:\s+lagu)?\s+['“\"]?(.+?)['”\"]?(?:\s+(?:-|–|—)|$)/i,
  ];
  for (const pattern of patterns) {
    const found = clean(headline).match(pattern)?.[1]?.replace(/^(?:lagu\s+)/i, "").trim();
    if (found && compactTitle(found) === compactTitle(wantedTitle)) return titleCase(found);
  }
  return "";
}

function writerFromHeadline(headline = "") {
  const text = clean(headline);
  const before = text.match(/([^,]{2,90}),\s*pencipta lagu/i)?.[1];
  if (before) {
    const trimmed = before.replace(/^.*?(?:profil|karier|sosok|musisi)\s+/i, "").trim();
    const words = trimmed.split(/\s+/);
    return words.slice(-4).join(" ").replace(/^(?:dan|karier)\s+/i, "");
  }
  const after = text.match(/pencipta lagu[^,]{0,45},\s*([^,.;–—]{2,60})/i)?.[1];
  return after?.replace(/\s+(?:meninggal|wafat|ungkap|bicara)\b.*$/i, "").trim() || "";
}

function credibleWriter(writer, title) {
  const value = clean(writer).replace(/\s+(?:yang|dan lagu|untuk|pada|dengan)\b.*$/i, "").trim();
  const normalized = compactTitle(value);
  const normalizedTitle = compactTitle(title);
  if (!value || normalized === normalizedTitle || normalized.includes(normalizedTitle) || value.length > 60) return "";
  if (/^(?:lagu|anak|anak-anak|indonesia|siapa)\b|\b(?:adalah|ialah|siapa)$|^(?:judul|pencipta)\b/i.test(value)) return "";
  return value;
}

function verifiedReference(title) {
  const references = {
    dudidam: {
      title: "Du Di Dam", songwriter: "Papa T Bob",
      sourceTitle: "Du Di Dam — kredit Composition & Lyrics: Papa T Bob",
      sourceUrl: "https://www.shazam.com/en-us/song/1690487523/du-di-dam",
      snippet: "Kredit komposisi dan lirik pada halaman lagu.", source: "Shazam",
    },
  };
  const match = references[compactTitle(title)];
  return match ? [match] : [];
}

function clueReference(title, brief) {
  const text = clean(brief);
  if (!text) return [];
  const protectedText = text
    .replace(/\b([A-Z])\.(?=[A-Z]\.)/g, "$1§")
    .replace(/\b([A-Z])\.(?=\s+[A-Z][a-z])/g, "$1§");
  const writerMatch = protectedText.match(/pencipta(?:\s+lagu)?(?:nya)?[^.]{0,180}?\s(?:adalah|ialah|:|-)\s*([\p{L}][\p{L}\p{N}§'’ -]{1,70}?)(?=\.(?:\s+[A-Z]|$)|$)/iu);
  const writerFromClue = writerMatch?.[1]?.replace(/§/g, ".") || possibleWriter(text);
  const writer = credibleWriter(writerFromClue, title);
  if (!writer) return [];
  const namedTitle = text.match(/pencipta(?:\s+lagu)?\s*["“']([^"”']{2,90})["”']/i)?.[1];
  const candidateTitle = namedTitle && (
    compactTitle(namedTitle).includes(compactTitle(title)) || compactTitle(title).includes(compactTitle(namedTitle))
  ) ? titleCase(namedTitle) : title;
  return [{
    title: candidateTitle,
    songwriter: writer,
    sourceTitle: "Kandidat dari clue / AI Overview yang Anda tulis",
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`pencipta lagu ${candidateTitle} ${writer}`)}`,
    snippet: text.slice(0, 260),
    source: "Clue pengguna — perlu verifikasi",
  }];
}

function writerBesideTitle(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean(text).match(new RegExp(`${escaped}\\s*\\(([^)]+)\\)`, "i"))?.[1]?.trim() || "";
}

async function fetchText(url, accept, timeout = 7000) {
  const response = await fetch(url, {
    headers: { "accept": accept, "user-agent": "HiccaReleaseResearch/1.0 (+https://release.hiccastudios.my.id)" },
    signal: AbortSignal.timeout(timeout),
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
  const quotedClue = clean(brief).match(/["“']([^"”']{5,100})["”']/)?.[1] || "";
  const queries = [`pencipta lagu ${title}${quotedClue ? ` \"${quotedClue}\"` : ""}`];
  const settled = await Promise.allSettled(queries.map(query => fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`, "application/rss+xml, application/xml, text/xml", 15000)));
  const feeds = settled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const items = feeds.flatMap(xml => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map(match => {
    const item = match[1];
    const sourceTitle = clean(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const snippet = clean(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]);
    return {
      title, songwriter: "", sourceTitle,
      sourceUrl: clean(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]), snippet: snippet.slice(0, 260), source: "Google News",
    };
  }));
  const canonicalTitle = items.map(item => canonicalFromHeadline(item.sourceTitle, title)).find(Boolean) || title;
  return items.map(item => ({
    ...item,
    title: canonicalTitle,
    songwriter: credibleWriter(possibleWriter(`${item.sourceTitle}. ${item.snippet}`), canonicalTitle)
      || credibleWriter(writerFromHeadline(item.sourceTitle), canonicalTitle),
  }));
}

async function googleSuggestions(title) {
  const queries = [`pencipta lagu ${title}`, `${title} pencipta lagu`];
  const responses = await Promise.all(queries.map(query => fetchText(`https://www.google.com/complete/search?client=firefox&hl=id&q=${encodeURIComponent(query)}`, "application/json")));
  return responses.flatMap(payload => (JSON.parse(payload)?.[1] || []).slice(0, 5)).map(suggestion => ({
    title, songwriter: credibleWriter(possibleWriter(suggestion), title), sourceTitle: suggestion,
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
      const originalTitle = String(body?.title || "").trim().slice(0, 160);
      const brief = String(body?.brief || "").trim().slice(0, 500);
      if (!originalTitle) return json({ error: "Judul wajib diisi." }, 400, origin);
      const title = likelyTitle(originalTitle);
      const settled = await Promise.allSettled([googleNews(title, brief), wikipedia(title), googleSuggestions(title)]);
      const researched = [...verifiedReference(title), ...settled.flatMap(result => result.status === "fulfilled" ? result.value : [])];
      const raw = researched.some(item => item.songwriter) ? researched : [...clueReference(title, brief), ...researched];
      const seen = new Set();
      const candidates = raw
        .filter(item => item.sourceUrl && !seen.has(item.sourceUrl) && seen.add(item.sourceUrl))
        .sort((a, b) => rank(b, title) - rank(a, title))
        .slice(0, 10);
      return json({ originalTitle, title, candidates, googleUrl: `https://www.google.com/search?q=${encodeURIComponent(`pencipta lagu ${title} ${brief}`.trim())}` }, 200, origin);
    } catch (error) {
      console.error(JSON.stringify({ event: "research_error", message: error instanceof Error ? error.message : "Unknown error" }));
      return json({ error: "Riset gagal sementara. Coba lagi." }, 502, origin);
    }
  },
};
