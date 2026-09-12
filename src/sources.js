import net from "node:net";
import * as cheerio from "cheerio";

const MAX_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

export const sourceCatalog = [
  {
    id: "genshin-texts",
    work: "原神",
    title: "GenshinTexts",
    url: "https://github.com/kqwyf/GenshinTexts",
    kind: "游戏文本提取工具",
    description: "可整理剧情对话、角色语音和角色故事。应用支持导入其 JSON、CSV 或 TXT 输出。"
  },
  {
    id: "genshin-dialog",
    work: "原神",
    title: "GenshinDialog",
    url: "https://github.com/mrzjy/GenshinDialog",
    kind: "游戏对白提取工具",
    description: "按角色整理多语言剧情对白，适合补充大规模原作台词语料。"
  },
  {
    id: "genshin-voice",
    work: "原神",
    title: "Genshin Voice",
    url: "https://github.com/simon300000/genshin-voice",
    kind: "角色语音数据集",
    description: "包含多语言角色语音文件，可与文字资料互相校对。"
  },
  {
    id: "wuwa-data",
    work: "鸣潮",
    title: "WutheringWaves Data",
    url: "https://github.com/Arikatsu/WutheringWaves_Data",
    kind: "游戏公开数据仓库",
    description: "鸣潮 TextMap 和资源数据来源。数据量较大，建议下载后通过本应用导入角色相关文本。"
  },
  {
    id: "wuwa-dialogue",
    work: "鸣潮",
    title: "Wuwa Dialogue Generator",
    url: "https://github.com/RealNath/wuwa-dialogue-generator",
    kind: "任务对白提取工具",
    description: "可按任务编号从鸣潮数据中提取完整对话。"
  },
  {
    id: "jianlai-wiki",
    work: "剑来",
    title: "Jian Lai Wiki",
    url: "https://jianlai.wiki/characters/",
    kind: "角色百科",
    description: "提供人物档案、关系、性格、经历与章节引用。小说原文请导入自己合法持有的文本。"
  }
];

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.");
}

export async function assertPublicUrl(value) {
  const url = new URL(value);
  if (!(["http:", "https:"].includes(url.protocol))) throw new Error("只允许 http 或 https 地址");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname) || hostname.endsWith(".local")) {
    throw new Error("不允许访问本机地址");
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) throw new Error("不允许访问内网地址");
  return url;
}

async function fetchLimited(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "CanonCharacterCard/1.0 (+local research tool)",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        ...(options.headers || {})
      }
    });
    if (!response.ok) throw new Error(`网页返回 ${response.status}`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new Error("网页内容超过 5 MB 限制");
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("网页内容超过 5 MB 限制");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { text: new TextDecoder("utf-8").decode(bytes), contentType: response.headers.get("content-type") || "" };
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\[[0-9]+\]/g, "")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

function extractHtmlArticle(html, requestedUrl, preferredTitle = "") {
  const requested = new URL(requestedUrl);
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, form, iframe, svg, canvas, .mw-editsection, .reference, .references, .portable-infobox__item-image").remove();
  const title = cleanText(preferredTitle || $("h1").first().text() || $("title").text() || requested.hostname);
  const root = $("article, main, #mw-content-text, .mw-parser-output, .entry-content, .page-content").first();
  const container = root.length ? root : $("body");
  const sections = [];
  let heading = "概览";
  container.find("h1, h2, h3, p, li, blockquote, table tr, .pi-data").each((_, element) => {
    const tag = element.tagName?.toLowerCase();
    const value = cleanText($(element).text());
    if (!value || value.length < 2) return;
    if (["h1", "h2", "h3"].includes(tag)) {
      heading = value.slice(0, 120);
      return;
    }
    if (value.length <= 4 && tag !== "p") return;
    sections.push({ heading, text: value.slice(0, 4000) });
  });
  const articleText = cleanText(sections.map(section => `${section.heading}\n${section.text}`).join("\n"));
  if (articleText.length < 80) throw new Error("网页没有提取到足够的正文");
  return { url: requested.href, title, text: articleText.slice(0, 350_000), sections: sections.slice(0, 2500), quality: "full" };
}

async function fetchFandomArticle(requested) {
  const match = decodeURIComponent(requested.pathname).match(/^(\/[^/]+)?\/wiki\/(.+)$/u);
  if (!match) throw new Error("无法识别 Fandom 页面标题");
  const localePrefix = match[1] || "";
  const page = match[2];
  const api = new URL(`${requested.origin}${localePrefix}/api.php`);
  api.searchParams.set("action", "parse");
  api.searchParams.set("page", page);
  api.searchParams.set("prop", "text|displaytitle");
  api.searchParams.set("format", "json");
  api.searchParams.set("origin", "*");
  const { text } = await fetchLimited(api.href, { headers: { accept: "application/json" } });
  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error.info || "Fandom 页面不存在");
  const displayTitle = cheerio.load(data.parse?.displaytitle || "").text() || data.parse?.title;
  return extractHtmlArticle(data.parse?.text?.["*"] || "", requested.href, cleanText(displayTitle));
}

async function fetchBaiduBaikeArticle(requested) {
  const decoded = decodeURIComponent(requested.pathname);
  const match = decoded.match(/\/item\/([^/]+)/u);
  if (!match) throw new Error("无法识别百度百科词条名");
  const api = new URL("https://baike.baidu.com/api/openapi/BaikeLemmaCardApi");
  api.searchParams.set("scope", "103");
  api.searchParams.set("format", "json");
  api.searchParams.set("appid", "379020");
  api.searchParams.set("bk_key", match[1]);
  api.searchParams.set("bk_length", "12000");
  const { text } = await fetchLimited(api.href, { headers: { accept: "application/json" } });
  const data = JSON.parse(text);
  const abstract = cleanText(data.abstract || data.desc || "");
  if (abstract.length < 40) throw new Error("百度百科接口没有返回正文摘要");
  return {
    url: requested.href,
    title: cleanText(data.title || match[1]),
    text: abstract,
    sections: [{ heading: "百科摘要", text: abstract }],
    quality: "summary",
    warning: "百度百科当前通过公开摘要接口读取，内容量少于完整页面"
  };
}

function unwrapDuckDuckGoUrl(href) {
  try {
    const url = new URL(href, "https://html.duckduckgo.com");
    const redirected = url.searchParams.get("uddg");
    return redirected ? decodeURIComponent(redirected) : url.href;
  } catch {
    return href;
  }
}

export async function searchWeb(query) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { text } = await fetchLimited(searchUrl, { method: "GET" });
  const $ = cheerio.load(text);
  const results = [];
  $(".result").each((_, element) => {
    if (results.length >= 10) return;
    const anchor = $(element).find("a.result__a").first();
    const href = unwrapDuckDuckGoUrl(anchor.attr("href"));
    if (!href || !href.startsWith("http")) return;
    results.push({
      title: cleanText(anchor.text()),
      url: href,
      snippet: cleanText($(element).find(".result__snippet").text())
    });
  });
  return results;
}

export function makeSnippetFallback({ url, title, snippet, reason = "网页拒绝自动读取" }) {
  const cleanSnippet = cleanText(snippet);
  if (cleanSnippet.length < 30) throw new Error(reason);
  return {
    url,
    title: cleanText(title || new URL(url).hostname),
    text: cleanSnippet,
    sections: [{ heading: "搜索结果摘要", text: cleanSnippet }],
    quality: "snippet",
    warning: `${reason}，已使用搜索结果摘要；建议再加入角色档案或游戏文本`
  };
}

export async function fetchArticle(value) {
  const requested = await assertPublicUrl(value);
  if (requested.hostname.endsWith("fandom.com")) return fetchFandomArticle(requested);
  if (requested.hostname === "baike.baidu.com") return fetchBaiduBaikeArticle(requested);
  const { text, contentType } = await fetchLimited(requested.href);
  if (!contentType.includes("html") && !contentType.includes("text")) {
    throw new Error("当前只支持网页和纯文本来源");
  }
  if (!contentType.includes("html")) {
    return { url: requested.href, title: requested.hostname, text: cleanText(text), sections: [], quality: "full" };
  }
  return extractHtmlArticle(text, requested.href);
}
