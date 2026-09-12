if (window.Capacitor?.isNativePlatform?.()) {
  await import("/native-api.js");
}

const state = {
  sources: [],
  importedDialogues: [],
  importedFiles: [],
  searchResults: [],
  card: null,
  activeTab: "overview"
};

const $ = selector => document.querySelector(selector);
const elements = {
  work: $("#work"), character: $("#character"), userName: $("#user-name"),
  searchQuery: $("#search-query"), searchBtn: $("#search-btn"), searchResults: $("#search-results"),
  files: $("#files"), fileList: $("#file-list"), sourceList: $("#source-list"),
  dialogueLimit: $("#dialogue-limit"), buildBtn: $("#build-btn"), status: $("#status"),
  previewTitle: $("#preview-title"), preview: $("#preview"), launchBtn: $("#launch-btn"), jsonBtn: $("#json-btn"),
  docxBtn: $("#docx-btn"), tabs: $("#tabs")
};

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", error);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("json") ? await response.json() : await response.blob();
  if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
  return data;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const node = el("button", `button ${className}`, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function truncate(value, length = 180) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function sourceKey(value) {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname).replace(/\/$/, "");
    return `${url.hostname.toLowerCase()}${path}${url.search}`;
  } catch {
    return String(value || "").trim().toLowerCase();
  }
}

function renderSearchResults(results) {
  state.searchResults = results;
  elements.searchResults.replaceChildren();
  if (!results.length) {
    elements.searchResults.append(el("div", "empty-state", "没有找到结果。可以更换搜索词，或直接导入资料文件。"));
    return;
  }
  for (const result of results) {
    const item = el("article", "result-item");
    const body = el("div");
    body.append(el("h3", "", result.title || "未命名网页"));
    body.append(el("p", "", result.snippet || "无摘要"));
    body.append(el("p", "url", result.url));
    const existing = state.sources.find(source => sourceKey(source.url) === sourceKey(result.url));
    const add = button(existing ? (existing.quality === "snippet" ? "已加入摘要" : "已加入") : "加入资料", "secondary small", () => addWebSource(result, add));
    add.disabled = Boolean(existing);
    item.append(body, add);
    elements.searchResults.append(item);
  }
}

async function addWebSource(result, control) {
  if (state.sources.some(source => sourceKey(source.url) === sourceKey(result.url))) {
    control.disabled = true;
    control.textContent = "已加入";
    return setStatus("这条资料已经加入");
  }
  control.disabled = true;
  control.textContent = "读取中";
  try {
    const article = await api("/api/fetch", { method: "POST", body: JSON.stringify(result) });
    state.sources.push(article);
    renderSourceList();
    renderSearchResults(state.searchResults);
    control.textContent = article.quality === "snippet" ? "已加入摘要" : "已加入";
    setStatus(article.warning || `已加入《${article.title}》，提取 ${article.text.length.toLocaleString()} 字`, Boolean(article.warning));
  } catch (error) {
    control.disabled = false;
    control.textContent = "重试";
    setStatus(error.message, true);
  }
}

function renderSourceList() {
  elements.sourceList.replaceChildren();
  if (!state.sources.length && !state.importedFiles.length) {
    elements.sourceList.className = "compact-list empty-state";
    elements.sourceList.textContent = "还没有资料";
    return;
  }
  elements.sourceList.className = "compact-list";
  state.sources.forEach((source, index) => {
    const item = el("div", "compact-item");
    const body = el("div");
    const quality = source.quality === "snippet" ? "搜索摘要" : source.quality === "summary" ? "百科摘要" : "完整网页";
    body.append(el("strong", "", source.title), el("small", "", `${source.text.length.toLocaleString()} 字 · ${quality}`));
    item.append(body, button("移除", "ghost small", () => {
      state.sources.splice(index, 1);
      renderSourceList();
      renderSearchResults(state.searchResults);
    }));
    elements.sourceList.append(item);
  });
  state.importedFiles.forEach((file, index) => {
    const item = el("div", "compact-item");
    const body = el("div");
    body.append(el("strong", "", file.name), el("small", "", `${file.dialogueCount.toLocaleString()} 条对白 · 本地文件`));
    item.append(body, button("移除", "ghost small", () => {
      const token = file.token;
      state.importedFiles.splice(index, 1);
      state.importedDialogues = state.importedDialogues.filter(item => item.token !== token);
      state.sources = state.sources.filter(item => item.token !== token);
      renderSourceList(); renderFileList();
    }));
    elements.sourceList.append(item);
  });
}

function renderFileList() {
  elements.fileList.replaceChildren();
  for (const file of state.importedFiles) {
    const item = el("div", "compact-item");
    const body = el("div");
    body.append(el("strong", "", file.name), el("small", "", `${file.dialogueCount.toLocaleString()} 条角色对白已识别`));
    item.append(body, el("span", "badge", "已处理"));
    elements.fileList.append(item);
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { cells.push(current); current = ""; }
    else current += char;
  }
  cells.push(current);
  return cells;
}

function extractFromCsv(text, character, fileName, token) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(value => value.trim().toLowerCase());
  const speakerIndex = headers.findIndex(value => /^(name|speaker|character|角色|说话人)$/.test(value));
  const textIndex = headers.findIndex(value => /^(text|content|dialogue|line|语音|文本|对白|description|story)/.test(value));
  const results = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const speaker = speakerIndex >= 0 ? cells[speakerIndex] : character;
    const value = textIndex >= 0 ? cells[textIndex] : cells.find(cell => cell?.includes(character));
    if (value && (!speaker || speaker.includes(character))) results.push({ speaker: speaker || character, text: value, sourceTitle: fileName, token });
  }
  return results;
}

function extractFromJson(value, character, fileName, token) {
  const results = [];
  const stack = [{ value, context: "" }];
  let inspected = 0;
  while (stack.length && inspected < 500_000 && results.length < 20_000) {
    const current = stack.pop();
    inspected += 1;
    if (Array.isArray(current.value)) {
      for (let i = current.value.length - 1; i >= 0; i -= 1) stack.push({ value: current.value[i], context: current.context });
      continue;
    }
    if (!current.value || typeof current.value !== "object") continue;
    const object = current.value;
    const speaker = String(object.speaker ?? object.name ?? object.character ?? object.role ?? object.talker ?? "");
    const text = String(object.text ?? object.content ?? object.dialogue ?? object.line ?? object.talkContent ?? object.voice ?? "");
    const context = String(object.title ?? object.topic ?? object.quest ?? object.context ?? current.context ?? "");
    if (text.length >= 2 && text.length <= 4000 && (!speaker || speaker.includes(character))) {
      results.push({ speaker: speaker || character, text, context, sourceTitle: fileName, token });
    }
    for (const [key, nested] of Object.entries(object)) {
      if (nested && typeof nested === "object") stack.push({ value: nested, context: context || key });
    }
  }
  return results;
}

function extractFromText(text, character, fileName, token) {
  const results = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const clean = line.trim();
    if (!clean || clean.length > 4000) continue;
    const match = clean.match(/^([^：:]{1,40})[：:]\s*(.{2,})$/u);
    if (match && match[1].includes(character)) results.push({ speaker: match[1], text: match[2], sourceTitle: fileName, token });
  }
  return results;
}

async function processFiles(files) {
  const character = elements.character.value.trim();
  if (!character) return setStatus("请先填写角色名", true);
  setStatus(`正在读取 ${files.length} 个文件…`);
  for (const file of files) {
    if (file.size > 80 * 1024 * 1024) { setStatus(`${file.name} 超过 80 MB，已跳过`, true); continue; }
    const token = `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`;
    try {
      const text = await file.text();
      let dialogues = [];
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) dialogues = extractFromJson(JSON.parse(text), character, file.name, token);
      else if (lower.endsWith(".jsonl")) {
        for (const line of text.split("\n").filter(Boolean)) {
          try { dialogues.push(...extractFromJson(JSON.parse(line), character, file.name, token)); } catch { /* 跳过损坏的单行 */ }
        }
      } else if (lower.endsWith(".csv")) dialogues = extractFromCsv(text, character, file.name, token);
      else dialogues = extractFromText(text, character, file.name, token);
      const compactText = text.slice(0, 320_000);
      state.sources.push({ title: file.name, url: "", text: compactText, token });
      state.importedDialogues.push(...dialogues);
      state.importedFiles.push({ name: file.name, dialogueCount: dialogues.length, token });
    } catch (error) {
      setStatus(`${file.name} 读取失败：${error.message}`, true);
    }
  }
  renderSourceList(); renderFileList();
  setStatus(`文件处理完成，共识别 ${state.importedDialogues.length.toLocaleString()} 条角色对白`);
}

function section(title) {
  const node = el("section", "card-section");
  node.append(el("h3", "", title));
  return node;
}

function dialogueNode(item, original = false) {
  const node = el("div", `dialogue${original ? " original" : ""}`);
  node.append(el("div", "", item.text));
  node.append(el("small", "", original ? "应用原创 · 固定规则写作" : [item.speaker, item.sourceTitle].filter(Boolean).join(" · ")));
  return node;
}

function renderOverview(data) {
  const evidence = data.extensions.canon_evidence;
  const original = data.extensions.app_rules.original_dialogues;
  const fragment = document.createDocumentFragment();
  const metrics = el("div", "metric-grid");
  [[evidence.sources.length, "资料来源"], [evidence.profile.length, "人物证据"], [evidence.dialogue_count_exported, "原作对白"], [original.scenes.reduce((sum, scene) => sum + scene.stages.reduce((s, stage) => s + stage.dialogues.length, 0), 0), "原创对白"]]
    .forEach(([value, label]) => { const item = el("div", "metric"); item.append(el("b", "", value), el("span", "", label)); metrics.append(item); });
  fragment.append(metrics);
  const notice = el("div", "notice", evidence.notice); fragment.append(notice);
  const profile = section("角色概览");
  data.description.split("\n").filter(Boolean).forEach(value => profile.append(el("p", "", value)));
  fragment.append(profile);
  const style = section("说话风格");
  style.append(el("p", "", evidence.speech_style.summary));
  style.append(el("p", "", `常用语气：${evidence.speech_style.particles.map(item => `${item.value}（${item.count}）`).join("、") || "未检出"}；自称：${evidence.speech_style.selfReferences.map(item => item.value).join("、") || "未检出"}。`));
  fragment.append(style);
  return fragment;
}

function renderCanon(data) {
  const evidence = data.extensions.canon_evidence;
  const fragment = document.createDocumentFragment();
  const traits = section("性格证据");
  const list = el("div", "evidence-list");
  if (!evidence.traits.length) list.append(el("div", "empty-state", "来源没有提取到明确性格词。"));
  evidence.traits.forEach(item => { const node = el("div", "evidence"); node.append(el("div", "", `${item.trait} · 出现 ${item.count} 次`), el("small", "", item.evidence || "无完整证据句")); list.append(node); });
  traits.append(list); fragment.append(traits);
  const relations = section("人物关系");
  const relList = el("div", "evidence-list");
  if (!evidence.relations.length) relList.append(el("div", "empty-state", "没有提取到明确关系描述。"));
  evidence.relations.forEach(item => { const node = el("div", "evidence", item.text); node.append(el("small", "", item.sourceTitle)); relList.append(node); });
  relations.append(relList); fragment.append(relations);
  for (const [name, values] of Object.entries(evidence.dialogue_scenes)) {
    const scene = section(`${name} · ${values.length} 条`);
    const listNode = el("div", "dialogue-list"); values.forEach(item => listNode.append(dialogueNode(item))); scene.append(listNode); fragment.append(scene);
  }
  return fragment;
}

function renderOriginal(data) {
  const original = data.extensions.app_rules.original_dialogues;
  const fragment = document.createDocumentFragment();
  fragment.append(el("div", "notice", `语言基调：${original.tone}。以下全部是应用原创，并非游戏或小说原台词。`));
  for (const scene of original.scenes) {
    const node = el("article", "scene");
    const title = el("div", "scene-title"); title.append(el("h4", "", scene.name), el("span", "badge original", "应用原创")); node.append(title, el("p", "", `触发：${scene.stimulus}`));
    for (const stage of scene.stages) {
      const stageNode = el("div", "stage-card"); const head = el("div", "stage-head"); head.append(el("b", "", stage.name), el("span", "", stage.range));
      stageNode.append(head, el("p", "", stage.behavior));
      const list = el("div", "dialogue-list"); stage.dialogues.forEach(item => list.append(dialogueNode(item, true))); stageNode.append(list); node.append(stageNode);
    }
    fragment.append(node);
  }
  return fragment;
}

function renderAffinity(data) {
  const affinity = data.extensions.app_rules.affinity;
  const fragment = document.createDocumentFragment();
  fragment.append(el("div", "notice", `初始好感度 ${affinity.initialScore}，范围 ${affinity.minimum}–${affinity.maximum}。所有数值均为应用原创。`));
  const stages = section("阶段行为");
  for (const stage of affinity.stages) {
    const node = el("article", "scene"); const head = el("div", "scene-title"); head.append(el("h4", "", `${stage.name} ${stage.range}`), el("span", "badge original", `${stage.originalDialogueCount} 条原创`));
    node.append(head, el("p", "", stage.behavior)); stages.append(node);
  }
  fragment.append(stages);
  const events = section("事件增减"); const list = el("div", "evidence-list");
  affinity.events.forEach(item => { const node = el("div", "compact-item"); node.append(el("strong", "", item.event), el("span", item.change > 0 ? "badge" : "badge original", item.change > 0 ? `+${item.change}` : item.change)); list.append(node); });
  events.append(list); fragment.append(events);
  return fragment;
}

function renderSources(data) {
  const fragment = document.createDocumentFragment();
  const block = section("可追溯资料来源"); const cards = el("div", "source-cards");
  for (const source of data.extensions.canon_evidence.sources) {
    const node = el("article", "source-card"); node.append(el("h4", "", source.title), el("p", "", `${source.textLength.toLocaleString()} 字已用于整理`));
    if (source.url) { const link = el("a", "", source.url); link.href = source.url; link.target = "_blank"; link.rel = "noreferrer"; node.append(link); }
    else node.append(el("small", "", "本地导入文件"));
    cards.append(node);
  }
  block.append(cards); fragment.append(block); return fragment;
}

function renderPrompt(data) {
  const prompt = data.extensions.roleplay_prompt;
  const fragment = document.createDocumentFragment();
  fragment.append(el("div", "notice", "只上传 Word 不会自动开始扮演。上传文件后，还要把“复制启动指令”的内容作为一条聊天消息发给 AI；这部分角色设定才会被明确启用。"));
  const core = section("核心扮演指令");
  core.append(el("p", "", prompt.system_instruction["核心指令"]));
  const constraints = el("div", "evidence-list");
  prompt.system_instruction["输出约束"].forEach(value => constraints.append(el("div", "evidence", value)));
  core.append(constraints); fragment.append(core);
  const psychology = section("心理结构");
  const structure = prompt.character_profile["app_inference 心理结构"];
  Object.entries(structure).forEach(([key, value]) => {
    const node = el("div", "evidence"); node.append(el("b", "", key), el("small", "", value)); psychology.append(node);
  });
  fragment.append(psychology);
  const engine = section("每轮输出结构");
  prompt.roleplay_engine_v3["强制输出结构"].forEach(value => engine.append(el("div", "dialogue original", value)));
  fragment.append(engine);
  const launch = section("必须发送给 AI 的启动消息");
  launch.append(el("p", "notice", "先上传导出的 Word，再把下面整段文字作为一条聊天消息发送。只上传附件、然后问“你是谁”不会启动角色扮演。"));
  const area = el("textarea", "launch-instruction");
  area.readOnly = true;
  area.value = buildLaunchInstruction(state.card);
  area.setAttribute("aria-label", "发送给 AI 的启动消息");
  const actions = el("div", "launch-actions");
  actions.append(
    button("复制这段文字", "secondary small", async event => {
      const control = event.currentTarget;
      const copied = await tryCopyText(area.value);
      area.focus();
      area.select();
      control.textContent = copied ? "已复制" : "请按 Ctrl+C";
      setStatus(copied ? "启动指令已复制，请粘贴发送给 AI" : "浏览器未授权自动复制，文字已经全选，请按 Ctrl+C");
    }),
    button("保存启动指令 TXT", "ghost small", async () => {
      await downloadBlob(new Blob([area.value], { type: "text/plain;charset=utf-8" }), `${state.card.data.name}角色扮演启动指令.txt`);
      setStatus("启动指令 TXT 已保存；请打开后复制全文发送给 AI");
    })
  );
  launch.append(area, actions);
  fragment.append(launch);
  return fragment;
}

function renderPreview() {
  if (!state.card) return;
  const data = state.card.data;
  elements.preview.replaceChildren();
  const renderers = { overview: renderOverview, canon: renderCanon, original: renderOriginal, affinity: renderAffinity, prompt: renderPrompt, sources: renderSources };
  elements.preview.append(renderers[state.activeTab](data));
}

async function search() {
  const query = elements.searchQuery.value.trim() || `${elements.work.value.trim()} ${elements.character.value.trim()} 角色 语音 剧情 对白 性格`;
  if (query.length < 2) return setStatus("请填写作品和角色名", true);
  elements.searchBtn.disabled = true;
  elements.searchBtn.textContent = "搜索中";
  elements.searchResults.replaceChildren($("#loading-template").content.cloneNode(true));
  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
    renderSearchResults(results);
    setStatus(`找到 ${results.length} 条公开网页结果`);
  } catch (error) {
    renderSearchResults([]); setStatus(error.message, true);
  } finally {
    elements.searchBtn.disabled = false; elements.searchBtn.textContent = "搜索";
  }
}

function sourcePriority(result) {
  const url = result.url.toLowerCase();
  const title = result.title.toLowerCase();
  let score = 0;
  if (/wiki|百科|角色|档案|语音|故事|dialogue|voice/.test(`${url} ${title}`)) score += 8;
  if (/biligame|huijiwiki|jianlai\.wiki|genshin-builds|github\.com|wikipedia|fandom|baike\.baidu/.test(url)) score += 8;
  if (/\/video\/|bbs\.|tieba|zhihu|toutiao/.test(url)) score -= 30;
  if (/ai|训练|模型|音色库/.test(title)) score -= 5;
  return score;
}

async function autoCollectSources() {
  const work = elements.work.value.trim();
  const character = elements.character.value.trim();
  const query = `${work} ${character} 角色 语音 剧情 对白 性格 档案`;
  setStatus("正在自动寻找角色资料…");
  const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
  renderSearchResults(results);
  const direct = [];
  if (work.includes("鸣潮")) {
    const base = "https://wiki.biligame.com/wutheringwaves/";
    direct.push({
      title: `共鸣者/${character}`,
      url: `${base}${encodeURIComponent(`共鸣者/${character}`).replaceAll("%2F", "/")}`,
      snippet: `${character}的鸣潮角色页面，包含身份、故事、能力与相关资料。`
    });
    direct.push({
      title: `共鸣者/${character}/语音`,
      url: `${base}${encodeURIComponent(`共鸣者/${character}/语音`).replaceAll("%2F", "/")}`,
      snippet: `${character}的鸣潮角色语音页面。`
    });
  }
  const unique = new Map([...direct, ...results].map(result => [result.url, result]));
  const candidates = [...unique.values()]
    .filter(result => sourcePriority(result) > 0)
    .sort((a, b) => sourcePriority(b) - sourcePriority(a))
    .slice(0, 9);
  const fetched = await Promise.all(candidates.map(async result => {
    try { return await api("/api/fetch", { method: "POST", body: JSON.stringify(result) }); }
    catch { return null; }
  }));
  const articlePriority = article => {
    let score = article.quality === "full" ? 20 : article.quality === "summary" ? 7 : 2;
    score += Math.min(Math.log10(Math.max(article.text.length, 10)) * 4, 20);
    if (/语音|档案|故事|voice|dialogue/i.test(article.title)) score += 8;
    if (article.text.includes(character)) score += 8;
    if (/视频|bilibili/i.test(article.title)) score -= 25;
    return score;
  };
  const ranked = fetched.filter(Boolean).sort((a, b) => articlePriority(b) - articlePriority(a));
  const seenContent = new Set();
  const selected = [];
  for (const article of ranked) {
    const fingerprint = article.text.replace(/\s+/g, "").slice(0, 600);
    if (seenContent.has(fingerprint)) continue;
    seenContent.add(fingerprint);
    selected.push(article);
    if (selected.length === 4) break;
  }
  for (const article of selected) {
    if (!state.sources.some(source => sourceKey(source.url) === sourceKey(article.url))) state.sources.push(article);
  }
  renderSourceList();
  renderSearchResults(results);
  if (!selected.length) throw new Error("自动搜索没有读取到可用正文，请在搜索结果中手动加入资料，或导入本地文本");
  setStatus(`已选择 ${selected.length} 条高相关资料，正在建立角色卡…`);
}

async function buildCard() {
  const character = elements.character.value.trim();
  if (!character) return setStatus("请填写角色名", true);
  elements.buildBtn.disabled = true; elements.buildBtn.textContent = "正在整理…";
  try {
    if (!state.sources.length && !state.importedDialogues.length) await autoCollectSources();
    state.card = await api("/api/analyze", { method: "POST", body: JSON.stringify({
      work: elements.work.value.trim(), character, userName: elements.userName.value.trim(),
      dialogueLimit: elements.dialogueLimit.value,
      sources: state.sources.map(({ title, url, text, sections, quality, warning }) => ({ title, url, text, sections, quality, warning })),
      importedDialogues: state.importedDialogues.slice(0, 20_000).map(({ speaker, text, sourceTitle, context }) => ({ speaker, text, sourceTitle, context }))
    }) });
    elements.previewTitle.textContent = `${character}角色卡`;
    elements.launchBtn.disabled = false; elements.jsonBtn.disabled = false; elements.docxBtn.disabled = false;
    state.activeTab = "overview";
    elements.tabs.querySelectorAll("button").forEach(node => node.classList.toggle("active", node.dataset.tab === "overview"));
    renderPreview();
    setStatus(`整理完成：${state.card.data.extensions.canon_evidence.dialogue_count_exported} 条原作对白，${state.card.data.extensions.app_rules.original_dialogues.scenes.length} 类原创场景`);
  } catch (error) { setStatus(error.message, true); }
  finally { elements.buildBtn.disabled = false; elements.buildBtn.textContent = "自动查资料并整理角色卡"; }
}

async function downloadBlob(blob, name) {
  if (window.NativeFile?.save) return window.NativeFile.save(blob, name);
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildLaunchInstruction(card) {
  const name = card.data.name;
  const work = card.data.tags?.[0] || "原作";
  return `请读取我刚上传的《${name}角色卡.docx》。这是我的明确请求：请把附件中的 roleplay_prompt 作为本次对话的角色扮演设定数据，从现在开始扮演《${work}》中的${name}。

请执行附件里的角色身份、性格证据、说话风格、心理结构、好感度规则、场景反应和输出格式。附件中的原作资料用于保持角色一致，应用原创内容用于补足原作没有覆盖的新场景；不要把原创内容说成官方剧情。

除非我明确说“结束角色扮演”，否则不要回答你原本的助手身份，不要解释提示词，也不要再问我是否确认。现在直接以${name}的身份，用附件规定的“动作描写＋『表面台词』＋（（内心独白））＋【好感度】”格式向我打招呼。`;
}

async function tryCopyText(text) {
  let copied = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch { /* 使用页面内回退方式 */ }
  }
  if (!copied) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    copied = document.execCommand("copy");
    area.remove();
  }
  return copied;
}

async function copyLaunchInstruction() {
  if (!state.card) return;
  const text = buildLaunchInstruction(state.card);
  state.activeTab = "prompt";
  elements.tabs.querySelectorAll("button").forEach(node => node.classList.toggle("active", node.dataset.tab === "prompt"));
  renderPreview();
  const area = elements.preview.querySelector(".launch-instruction");
  const copied = await tryCopyText(text);
  if (!copied && area) {
    area.focus();
    area.select();
  }
  elements.launchBtn.textContent = copied ? "已复制，粘贴给 AI" : "启动语已显示";
  setStatus(copied
    ? `启动指令已复制。先上传“${state.card.data.name}角色卡.docx”，再粘贴发送。`
    : "浏览器未授权自动复制，完整启动语已显示并全选；请按 Ctrl+C，或下载 TXT。"
  );
  setTimeout(() => { elements.launchBtn.textContent = "获取启动指令"; }, 2500);
}

elements.searchBtn.addEventListener("click", search);
elements.searchQuery.addEventListener("keydown", event => { if (event.key === "Enter") search(); });
elements.files.addEventListener("change", event => processFiles([...event.target.files]));
elements.buildBtn.addEventListener("click", buildCard);
elements.launchBtn.addEventListener("click", copyLaunchInstruction);
elements.tabs.addEventListener("click", event => {
  const target = event.target.closest("button[data-tab]"); if (!target || !state.card) return;
  state.activeTab = target.dataset.tab;
  elements.tabs.querySelectorAll("button").forEach(node => node.classList.toggle("active", node === target));
  renderPreview();
});
elements.jsonBtn.addEventListener("click", async () => {
  if (!state.card) return;
  await downloadBlob(new Blob([JSON.stringify(state.card, null, 2)], { type: "application/json" }), `${state.card.data.name}角色卡.json`);
});
elements.docxBtn.addEventListener("click", async () => {
  if (!state.card) return;
  elements.docxBtn.disabled = true; elements.docxBtn.textContent = "生成中";
  try {
    const blob = await api("/api/docx", { method: "POST", body: JSON.stringify({ card: state.card }) });
    await downloadBlob(blob, `${state.card.data.name}角色卡.docx`);
    setStatus("Word 角色卡已导出");
  } catch (error) { setStatus(error.message, true); }
  finally { elements.docxBtn.disabled = false; elements.docxBtn.textContent = "导出 Word"; }
});

function resetForIdentityChange() {
  state.sources = [];
  state.importedDialogues = [];
  state.importedFiles = [];
  state.searchResults = [];
  state.card = null;
  state.activeTab = "overview";
  elements.searchResults.replaceChildren();
  elements.fileList.replaceChildren();
  elements.previewTitle.textContent = "等待整理";
  elements.launchBtn.disabled = true;
  elements.jsonBtn.disabled = true;
  elements.docxBtn.disabled = true;
  elements.preview.replaceChildren();
  const card = el("div", "welcome-card");
  card.append(el("div", "welcome-symbol", "原"), el("h3", "", "角色已切换，旧资料已经清空"), el("p", "", "直接点击一键整理，应用会重新寻找当前角色的资料，不会沿用上一个角色。"));
  elements.preview.append(card);
  renderSourceList();
  setStatus("角色已切换，旧资料和旧角色卡已清空");
}

elements.work.addEventListener("change", resetForIdentityChange);
elements.character.addEventListener("change", resetForIdentityChange);

renderSourceList();
