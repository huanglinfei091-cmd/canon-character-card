const MAX_CHARS = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

export const sourceCatalog = [
  { id: "genshin-texts", work: "原神", title: "GenshinTexts", url: "https://github.com/kqwyf/GenshinTexts", kind: "游戏文本提取工具", description: "可整理剧情对话、角色语音和角色故事。" },
  { id: "genshin-dialog", work: "原神", title: "GenshinDialog", url: "https://github.com/mrzjy/GenshinDialog", kind: "游戏对白提取工具", description: "按角色整理多语言剧情对白。" },
  { id: "wuwa-data", work: "鸣潮", title: "WutheringWaves Data", url: "https://github.com/Arikatsu/WutheringWaves_Data", kind: "游戏公开数据仓库", description: "鸣潮 TextMap 和资源数据来源。" },
  { id: "jianlai-wiki", work: "剑来", title: "Jian Lai Wiki", url: "https://jianlai.wiki/characters/", kind: "角色百科", description: "提供人物档案、关系、性格与经历。" }
];

function cleanText(value) {
  return String(value || "").replace(/\[[0-9]+\]/g, "").replace(/[\t\u00a0]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
}

function publicUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只允许 http 或 https 地址");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) throw new Error("不允许访问本机或内网地址");
  return url;
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, redirect: "follow", signal: controller.signal, headers: { "accept-language": "zh-CN,zh;q=0.9,en;q=0.6", ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`网页返回 ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_CHARS) throw new Error("网页内容超过 5 MB 限制");
    return { text, contentType: response.headers.get("content-type") || "" };
  } finally { clearTimeout(timer); }
}

function htmlDocument(html) { return new DOMParser().parseFromString(html, "text/html"); }

function extractHtmlArticle(html, requestedUrl, preferredTitle = "") {
  const requested = new URL(requestedUrl);
  const doc = htmlDocument(html);
  doc.querySelectorAll("script,style,noscript,nav,footer,form,iframe,svg,canvas,.mw-editsection,.reference,.references,.portable-infobox__item-image").forEach(node => node.remove());
  const title = cleanText(preferredTitle || doc.querySelector("h1")?.textContent || doc.title || requested.hostname);
  const container = doc.querySelector("article,main,#mw-content-text,.mw-parser-output,.entry-content,.page-content") || doc.body;
  const sections = [];
  let heading = "概览";
  container?.querySelectorAll("h1,h2,h3,p,li,blockquote,table tr,.pi-data").forEach(node => {
    const tag = node.tagName.toLowerCase();
    const value = cleanText(node.textContent);
    if (!value || value.length < 2) return;
    if (["h1", "h2", "h3"].includes(tag)) { heading = value.slice(0, 120); return; }
    if (value.length <= 4 && tag !== "p") return;
    sections.push({ heading, text: value.slice(0, 4000) });
  });
  const text = cleanText(sections.map(section => `${section.heading}\n${section.text}`).join("\n"));
  if (text.length < 80) throw new Error("网页没有提取到足够的正文");
  return { url: requested.href, title, text: text.slice(0, 350_000), sections: sections.slice(0, 2500), quality: "full" };
}

function unwrapDuckDuckGoUrl(href) {
  try { const url = new URL(href, "https://html.duckduckgo.com"); const target = url.searchParams.get("uddg"); return target ? decodeURIComponent(target) : url.href; }
  catch { return href; }
}

export async function searchWeb(query) {
  const { text } = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const doc = htmlDocument(text);
  return [...doc.querySelectorAll(".result")].slice(0, 10).map(node => {
    const anchor = node.querySelector("a.result__a");
    return { title: cleanText(anchor?.textContent), url: unwrapDuckDuckGoUrl(anchor?.getAttribute("href")), snippet: cleanText(node.querySelector(".result__snippet")?.textContent) };
  }).filter(item => item.url?.startsWith("http"));
}

async function fetchFandom(requested) {
  const match = decodeURIComponent(requested.pathname).match(/^(\/[^/]+)?\/wiki\/(.+)$/u);
  if (!match) throw new Error("无法识别 Fandom 页面标题");
  const api = new URL(`${requested.origin}${match[1] || ""}/api.php`);
  Object.entries({ action: "parse", page: match[2], prop: "text|displaytitle", format: "json", origin: "*" }).forEach(([key, value]) => api.searchParams.set(key, value));
  const data = JSON.parse((await fetchText(api.href)).text);
  if (data.error) throw new Error(data.error.info || "Fandom 页面不存在");
  const display = cleanText(htmlDocument(data.parse?.displaytitle || "").body.textContent || data.parse?.title);
  return extractHtmlArticle(data.parse?.text?.["*"] || "", requested.href, display);
}

async function fetchBaidu(requested) {
  const match = decodeURIComponent(requested.pathname).match(/\/item\/([^/]+)/u);
  if (!match) throw new Error("无法识别百度百科词条名");
  const api = new URL("https://baike.baidu.com/api/openapi/BaikeLemmaCardApi");
  Object.entries({ scope: "103", format: "json", appid: "379020", bk_key: match[1], bk_length: "12000" }).forEach(([key, value]) => api.searchParams.set(key, value));
  const data = JSON.parse((await fetchText(api.href)).text);
  const text = cleanText(data.abstract || data.desc || "");
  if (text.length < 40) throw new Error("百度百科接口没有返回正文摘要");
  return { url: requested.href, title: cleanText(data.title || match[1]), text, sections: [{ heading: "百科摘要", text }], quality: "summary", warning: "百度百科当前通过公开摘要接口读取" };
}

export function makeSnippetFallback({ url, title, snippet, reason = "网页拒绝自动读取" }) {
  const text = cleanText(snippet);
  if (text.length < 30) throw new Error(reason);
  return { url, title: cleanText(title || new URL(url).hostname), text, sections: [{ heading: "搜索结果摘要", text }], quality: "snippet", warning: `${reason}，已使用搜索结果摘要` };
}

export async function fetchArticle(value) {
  const requested = publicUrl(value);
  if (requested.hostname.endsWith("fandom.com")) return fetchFandom(requested);
  if (requested.hostname === "baike.baidu.com") return fetchBaidu(requested);
  const { text, contentType } = await fetchText(requested.href);
  if (!contentType.includes("html") && !contentType.includes("text")) throw new Error("当前只支持网页和纯文本来源");
  if (!contentType.includes("html")) return { url: requested.href, title: requested.hostname, text: cleanText(text), sections: [], quality: "full" };
  return extractHtmlArticle(text, requested.href);
}
