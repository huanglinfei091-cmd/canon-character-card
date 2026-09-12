import fs from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3188";
const outputPath = process.argv[2];

if (!outputPath) {
  console.error("请提供输出文件路径");
  process.exit(1);
}

const candidates = [
  {
    title: "共鸣者/爱弥斯",
    url: "https://wiki.biligame.com/wutheringwaves/%E5%85%B1%E9%B8%A3%E8%80%85/%E7%88%B1%E5%BC%A5%E6%96%AF",
    snippet: "爱弥斯的身份、档案、故事和人物关系资料。"
  },
  {
    title: "爱弥斯/鉴定报告与故事 | 鸣潮 Wiki | Fandom",
    url: "https://wutheringwaves.fandom.com/zh/wiki/%E7%88%B1%E5%BC%A5%E6%96%AF/%E9%89%B4%E5%AE%9A%E6%8A%A5%E5%91%8A%E4%B8%8E%E6%95%85%E4%BA%8B",
    snippet: "爱弥斯的鉴定报告、珍贵之物和角色故事。"
  },
  {
    title: "爱弥斯 - 萌娘百科",
    url: "https://mzh.moegirl.org.cn/%E7%88%B1%E5%BC%A5%E6%96%AF",
    snippet: "鸣潮角色爱弥斯的经历、设定和相关台词。"
  },
  {
    title: "爱弥斯 - 维基百科",
    url: "https://zh.wikipedia.org/zh-hans/%E6%84%9B%E5%BD%8C%E6%96%AF",
    snippet: "爱弥斯是拉海洛星炬学院的学生和隧者适格者。"
  }
];

async function jsonRequest(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function main() {
  const sources = [];
  const skipped = [];
  for (const candidate of candidates) {
    try {
      sources.push(await jsonRequest("/api/fetch", candidate));
    } catch (error) {
      skipped.push({ title: candidate.title, error: error.message });
    }
  }
  if (sources.length < 2) throw new Error(`可用来源不足：${JSON.stringify(skipped)}`);
  const card = await jsonRequest("/api/analyze", {
    work: "鸣潮",
    character: "爱弥斯",
    dialogueLimit: 200,
    sources
  });
  const response = await fetch(`${baseUrl}/api/docx`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card })
  });
  if (!response.ok) throw new Error(`/api/docx: ${response.status} ${await response.text()}`);
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  console.log(JSON.stringify({
    outputPath,
    bytes: (await fs.stat(outputPath)).size,
    sources: sources.map(source => ({ title: source.title, quality: source.quality, textLength: source.text.length })),
    canonDialogues: card.data.extensions.canon_evidence.dialogue_count_exported,
    originalDialogues: card.data.extensions.app_rules.original_dialogues.total
    ,skipped
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
