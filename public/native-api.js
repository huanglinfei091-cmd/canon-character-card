import { analyzeCharacter } from "../src/analyzer.js";
import { buildDocxBlob } from "../src/document.js";
import { fetchArticle, makeSnippetFallback, searchWeb, sourceCatalog } from "../src/mobile-sources.js";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const networkFetch = window.fetch.bind(window);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json;charset=utf-8" } });
}

window.fetch = async (input, options = {}) => {
  const value = typeof input === "string" ? input : input.url;
  if (!value.startsWith("/api/")) return networkFetch(input, options);
  try {
    const url = new URL(value, "https://native.local");
    const body = options.body ? JSON.parse(options.body) : {};
    if (url.pathname === "/api/health") return json({ ok: true, mode: "native-no-model", keysRequired: false });
    if (url.pathname === "/api/catalog") return json(sourceCatalog);
    if (url.pathname === "/api/search") return json(await searchWeb(url.searchParams.get("q") || ""));
    if (url.pathname === "/api/fetch") {
      try { return json(await fetchArticle(body.url)); }
      catch (error) { return json(makeSnippetFallback({ ...body, reason: error.message })); }
    }
    if (url.pathname === "/api/analyze") return json(analyzeCharacter(body));
    if (url.pathname === "/api/docx") {
      if (!body.card?.data?.name) return json({ error: "缺少角色卡内容" }, 400);
      return new Response(await buildDocxBlob(body.card), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
    }
    return json({ error: "本地接口不存在" }, 404);
  } catch (error) { return json({ error: error.message || "处理失败" }, 500); }
};

function safeName(value) { return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80); }

window.NativeFile = {
  async save(blob, name) {
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    const data = String(dataUrl).split(",")[1];
    const saved = await Filesystem.writeFile({ path: safeName(name), data, directory: Directory.Cache, recursive: true });
    await Share.share({ title: name, files: [saved.uri], dialogTitle: `保存或分享 ${name}` });
    return saved.uri;
  }
};
