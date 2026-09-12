import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import express from "express";
import { analyzeCharacter } from "./src/analyzer.js";
import { buildDocx } from "./src/document.js";
import { fetchArticle, makeSnippetFallback, searchWeb, sourceCatalog } from "./src/sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "no-model", keysRequired: false }));
app.get("/api/catalog", (_req, res) => res.json(sourceCatalog));

app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 2 || query.length > 120) return res.status(400).json({ error: "搜索内容应为 2 到 120 个字符" });
    res.json(await searchWeb(query));
  } catch (error) {
    res.status(502).json({ error: `公开网页搜索失败：${error.message}` });
  }
});

app.post("/api/fetch", async (req, res) => {
  try {
    res.json(await fetchArticle(req.body?.url));
  } catch (error) {
    try {
      res.json(makeSnippetFallback({
        url: req.body?.url,
        title: req.body?.title,
        snippet: req.body?.snippet,
        reason: error.message
      }));
    } catch {
      res.status(400).json({ error: `读取来源失败：${error.message}` });
    }
  }
});

app.post("/api/analyze", (req, res) => {
  try {
    res.json(analyzeCharacter(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/docx", async (req, res) => {
  try {
    const card = req.body?.card;
    if (!card?.data?.name) return res.status(400).json({ error: "缺少角色卡内容" });
    const buffer = await buildDocx(card);
    const safeName = card.data.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
    res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}角色卡.docx`)}`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: `生成 Word 文件失败：${error.message}` });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "导入内容过大，请减少文件数量或分批处理" });
  res.status(500).json({ error: "应用发生未处理错误" });
});

export function startServer({ port = Number(process.env.PORT || 3188), host = "127.0.0.1", open = process.env.NO_OPEN !== "1" } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const url = `http://${host}:${actualPort}`;
      console.log(`原作角色卡整理器已启动：${url}`);
      if (open && process.platform === "win32") execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, () => {});
      resolve({ server, url });
    });
    server.once("error", reject);
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const { server } = await startServer();
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}
