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
  userRole: $("#user-role"), userRoleCustom: $("#user-role-custom"), canonMode: $("#canon-mode"), adultContent: $("#adult-content"), adultConfirmed: $("#adult-confirmed"),
  ntrFields: $("#ntr-fields"), ntrPerspective: $("#ntr-perspective"), ntrOriginalPartner: $("#ntr-original-partner"), ntrThirdParty: $("#ntr-third-party"),
  initialAffinity: $("#initial-affinity"), initialCorruption: $("#initial-corruption"), initialBetrayal: $("#initial-betrayal"), resetValues: $("#reset-values"),
  subjectType: $("#subject-type"), profileMode: $("#profile-mode"), subjectGender: $("#subject-gender"),
  realRelationship: $("#real-relationship"), manualTraits: $("#manual-traits"), customPersona: $("#custom-persona"),
  realProfileFields: $("#real-profile-fields"), complexPersonaField: $("#complex-persona-field"), realPermissionCard: $("#real-permission-card"), realPermission: $("#real-permission"),
  publicSourceSection: $("#public-source-section"),
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

const VALUE_CONFIG = {
  affinity: { input: () => elements.initialAffinity, minimum: -100, maximum: 100, thresholds: [-80, -50, -20, 0, 10, 30, 50, 80, 100] },
  corruption: { input: () => elements.initialCorruption, minimum: 0, maximum: 100, thresholds: [10, 30, 50, 70, 90, 100] },
  betrayal: { input: () => elements.initialBetrayal, minimum: 0, maximum: 100, thresholds: [10, 30, 50, 70, 90, 100] }
};

const ROLE_DEFAULT_AFFINITY = { friend: 30, protagonist: 10, companion: 15, enemy: -20, villain: -50 };

function clampValue(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Math.round(Number(value) || 0)));
}

function currentQuickValue(key) {
  const config = VALUE_CONFIG[key];
  const input = config.input();
  if (input.value !== "") return clampValue(input.value, config.minimum, config.maximum);
  if (key === "affinity") return ROLE_DEFAULT_AFFINITY[elements.userRole.value] || 0;
  return 0;
}

function setQuickValue(key, value) {
  const config = VALUE_CONFIG[key];
  config.input().value = String(clampValue(value, config.minimum, config.maximum));
}

function applyQuickAction(key, action, amount = 0) {
  const config = VALUE_CONFIG[key];
  const current = currentQuickValue(key);
  if (action === "max") setQuickValue(key, config.maximum);
  else if (action === "next") setQuickValue(key, config.thresholds.find(value => value > current) ?? config.maximum);
  else setQuickValue(key, current + amount);
}

function optionalNumber(input) {
  return input.value === "" ? null : Number(input.value);
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
  [[evidence.sources.length, "资料来源"], [evidence.profile.length, "人物证据"], [evidence.dialogue_count_exported, "原作对白"], [original.total || 0, "原创对白"]]
    .forEach(([value, label]) => { const item = el("div", "metric"); item.append(el("b", "", value), el("span", "", label)); metrics.append(item); });
  fragment.append(metrics);
  const notice = el("div", "notice", evidence.notice); fragment.append(notice);
  const userRole = data.extensions.app_rules.user_role;
  const adult = data.extensions.app_rules.adult_content;
  const betrayal = data.extensions.app_rules.betrayal;
  const initialRouteState = data.extensions.app_rules.initial_route_state;
  const canon = data.extensions.app_rules.canon_policy;
  const canonSection = section(`原作人格 · ${canon.modeLabel}`);
  canonSection.append(el("p", canon.relationshipLock ? "route-note danger-text" : "route-note", `${canon.classification}：${canon.reason}`));
  const canonMeta = el("div", "evidence-list");
  canonMeta.append(el("div", "evidence", `关系判定：${canon.romanceGate}`));
  (canon.relationshipRules || []).forEach(item => canonMeta.append(el("div", "evidence", item)));
  (canon.evidence || []).forEach(item => canonMeta.append(el("div", "evidence", item)));
  if (canonMeta.childElementCount) canonSection.append(canonMeta);
  fragment.append(canonSection);
  const route = section(`你的路线 · ${userRole.label}`);
  route.append(el("p", "", userRole.opening));
  const routeMeta = el("div", "evidence-list");
  routeMeta.append(
    el("div", "evidence", `初始好感度：${userRole.initialScore}`),
    el("div", "evidence", `初始堕落／欲望／调教值：${adult.corruptionSystem?.initial ?? 0}`),
    el("div", "evidence", `初始背叛值：${betrayal?.initial ?? 0}`),
    el("div", "evidence", `加减分偏向：${userRole.scoreBias}`),
    el("div", "evidence", `成人剧情：${adult.labels?.[adult.effective] || adult.effective}${adult.lockedByCanon ? "（原作锁定）" : ""}`)
  );
  route.append(routeMeta);
  if (initialRouteState?.openingChapter) {
    route.append(el("p", initialRouteState.preset === "extreme-conflict" ? "route-note danger-text" : "route-note", `三数值组合剧情：${initialRouteState.openingChapter.title}。${initialRouteState.openingChapter.premise}`));
    const combinationMeta = el("div", "evidence-list");
    combinationMeta.append(
      el("div", "evidence", `组合层级：${initialRouteState.combinationKey}`),
      el("div", "evidence", `第一章目标：${initialRouteState.openingChapter.objective}`),
      el("div", "evidence", `结局候选：${initialRouteState.endingCandidates.join("／")}`)
    );
    route.append(combinationMeta);
  }
  const plotGrid = el("div", "ending-grid");
  userRole.exclusivePlots.forEach(item => {
    const node = el("article", "ending-card");
    node.append(el("h4", "", item.title), el("p", "", item.setup), el("small", "", `解锁：${item.unlock}`));
    plotGrid.append(node);
  });
  route.append(plotGrid); fragment.append(route);
  if ((adult.chapters || []).length) {
    const adultRoute = section(`成人专属路线 · ${adult.labels?.[adult.effective] || adult.effective}`);
    if (adult.ntrScenario) {
      adultRoute.append(el("p", "route-note", adult.ntrScenario.summary));
      const participants = el("div", "evidence-list");
      participants.append(
        el("div", "evidence", `故事目标：${adult.ntrScenario.target}`),
        el("div", "evidence", `原关系对象：${adult.ntrScenario.originalPartner}`),
        el("div", "evidence", `第三者：${adult.ntrScenario.thirdParty}`),
        el("div", "evidence", `结局保证：${adult.ntrScenario.outcomeRule}`)
      );
      adultRoute.append(participants);
    }
    const adultGrid = el("div", "ending-grid");
    adult.chapters.forEach(item => {
      const node = el("article", "ending-card");
      node.append(el("h4", "", item.title), el("p", "", item.setup), el("small", "", `解锁：${item.unlock}`));
      adultGrid.append(node);
    });
    adultRoute.append(adultGrid);
    if (adult.corruptionSystem?.stages?.length) {
      adultRoute.append(el("p", "route-note danger-text", adult.corruptionSystem.threshold50));
      const corruptionStages = el("div", "evidence-list");
      adult.corruptionSystem.stages.forEach(item => corruptionStages.append(el("div", "evidence", `${item.range} · ${item.name}：${item.behavior}`)));
      adultRoute.append(corruptionStages);
    }
    fragment.append(adultRoute);
  }
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
    const negativeTitle = el("div", "scene-title");
    negativeTitle.append(el("h4", "danger-text", "负好感度分支"), el("span", "badge danger", "会疏离／设局／反制"));
    node.append(negativeTitle);
    for (const stage of scene.negativeStages || []) {
      const stageNode = el("div", "stage-card"); const head = el("div", "stage-head"); head.append(el("b", "", `${stage.level} ${stage.name}`), el("span", "", stage.range));
      stageNode.append(head, el("p", "", stage.behavior));
      const list = el("div", "dialogue-list"); stage.dialogues.forEach(item => list.append(dialogueNode(item, true))); stageNode.append(list); node.append(stageNode);
    }
    fragment.append(node);
  }
  return fragment;
}

function renderAffinity(data) {
  const affinity = data.extensions.app_rules.affinity;
  const betrayal = data.extensions.app_rules.betrayal;
  const fragment = document.createDocumentFragment();
  fragment.append(el("div", "notice", `初始好感度 ${affinity.initialScore}，范围 ${affinity.minimum}–${affinity.maximum}。所有数值均为应用原创。`));
  if (betrayal) fragment.append(el("div", "notice", `初始背叛值 ${betrayal.initial}。高背叛会开启隐瞒、决裂和反转路线，但不能被高好感洗白。`));
  const negativeStages = section("负面阶段行为");
  for (const stage of affinity.negativeStages || []) {
    const node = el("article", "scene"); const head = el("div", "scene-title"); head.append(el("h4", "danger-text", `${stage.level} ${stage.name} ${stage.range}`), el("span", "badge danger", `${stage.originalDialogueCount} 条原创`));
    node.append(head, el("p", "", stage.behavior)); negativeStages.append(node);
  }
  fragment.append(negativeStages);
  const stages = section("正面阶段行为");
  for (const stage of affinity.stages) {
    const node = el("article", "scene"); const head = el("div", "scene-title"); head.append(el("h4", "", `${stage.name} ${stage.range}`), el("span", "badge original", `${stage.originalDialogueCount} 条原创`));
    node.append(head, el("p", "", stage.behavior)); stages.append(node);
  }
  fragment.append(stages);
  const events = section("事件增减"); const list = el("div", "evidence-list");
  affinity.events.forEach(item => {
    const node = el("div", "compact-item");
    const copy = el("div");
    copy.append(el("strong", "", item.event));
    if (item.reason) copy.append(el("small", "", item.reason));
    const change = item.change > 0 ? `+${item.change}` : `${item.change}`;
    node.append(copy, el("span", item.change > 0 ? "badge" : item.change < 0 ? "badge danger" : "badge neutral", change));
    list.append(node);
  });
  events.append(list); fragment.append(events);

  const constraints = section("计分约束");
  const constraintList = el("div", "evidence-list");
  (affinity.scoringRules || []).forEach(value => constraintList.append(el("div", "evidence", value)));
  constraints.append(constraintList); fragment.append(constraints);

  const locks = section("路线锁与修复窗口");
  const lockList = el("div", "evidence-list");
  (affinity.routeLocks || []).forEach(item => lockList.append(el("div", "evidence", `${item.range}：${item.rule}`)));
  (affinity.recoverySystem?.windows || []).forEach(item => lockList.append(el("div", "evidence", `${item.range} 修复：${item.requirement}；${item.cap}`)));
  locks.append(lockList); fragment.append(locks);

  const story = section("角色剧情节点");
  const milestones = el("div", "affinity-map");
  (affinity.storyUnlocks || []).forEach(item => {
    const node = el("article", "milestone");
    node.append(el("span", "milestone-score", `${item.score}`), el("h4", "", item.title), el("p", "", item.rule));
    milestones.append(node);
  });
  story.append(milestones); fragment.append(story);

  const buildEndingCard = (item, kind, badgeText) => {
    const node = el("article", `ending-card ${kind}${item.hidden ? " hidden" : ""}`);
    const head = el("div", "scene-title");
    head.append(el("h4", "", item.title), el("span", `badge ${kind === "bad" ? "danger" : ""}`, badgeText));
    node.append(head, el("p", "", item.condition || item.clue || ""));
    if (item.result) node.append(el("small", "", item.result));
    return node;
  };

  const bad = section("坏结局路线 · 4 个（含 1 个隐藏）");
  bad.append(el("p", "route-note danger-text", affinity.badEndingRoute?.unlock || ""));
  const badGrid = el("div", "ending-grid");
  (affinity.badEndingRoute?.endings || []).forEach(item => badGrid.append(buildEndingCard(item, "bad", item.hidden ? "隐藏" : item.range)));
  bad.append(badGrid); fragment.append(bad);

  const good = section("好结局路线 · 3 个普通 + 5 个隐藏");
  good.append(el("p", "route-note", affinity.goodEndingRoute?.unlock || ""));
  const goodGrid = el("div", "ending-grid");
  (affinity.goodEndingRoute?.normalEndings || []).forEach(item => goodGrid.append(buildEndingCard(item, "good", "100 点")));
  (affinity.goodEndingRoute?.hiddenEndings || []).forEach(item => goodGrid.append(buildEndingCard(item, "good", "隐藏")));
  good.append(goodGrid); fragment.append(good);
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
  const explicitMode = ["purelove", "ntr", "dark"].includes(elements.adultContent.value);
  if (elements.subjectType.value === "real" && !elements.realPermission.checked) return setStatus("添加现实中的其他人前，请确认已获得本人同意，并且不录入敏感隐私", true);
  if (elements.subjectType.value !== "fictional" && explicitMode) return setStatus("真人或本人资料卡只生成非露骨剧情；请改为“浪漫亲密（不露骨）”或关闭亲密剧情", true);
  elements.buildBtn.disabled = true; elements.buildBtn.textContent = "正在整理…";
  try {
    if (!state.sources.length && !state.importedDialogues.length && elements.subjectType.value === "fictional") await autoCollectSources();
    state.card = await api("/api/analyze", { method: "POST", body: JSON.stringify({
      work: elements.work.value.trim(), character, userName: elements.userName.value.trim(),
      userRole: elements.userRole.value, userRoleCustom: elements.userRoleCustom.value.trim(),
      canonMode: elements.canonMode.value,
      initialAffinity: optionalNumber(elements.initialAffinity),
      initialCorruption: optionalNumber(elements.initialCorruption),
      initialBetrayal: optionalNumber(elements.initialBetrayal),
      adultContent: elements.adultContent.value, adultConfirmed: elements.adultConfirmed.checked,
      ntrPerspective: elements.ntrPerspective.value,
      ntrOriginalPartner: elements.ntrOriginalPartner.value.trim(),
      ntrThirdParty: elements.ntrThirdParty.value.trim(),
      subjectType: elements.subjectType.value, profileMode: elements.profileMode.value,
      subjectGender: elements.subjectGender.value, realRelationship: elements.realRelationship.value,
      manualTraits: elements.manualTraits.value.trim(), customPersona: elements.customPersona.value.trim(),
      realPermission: elements.realPermission.checked,
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
  const work = card.data.extensions?.subject_profile?.work || card.data.tags?.[0] || "原作";
  const userRole = card.data.extensions?.app_rules?.user_role;
  const adult = card.data.extensions?.app_rules?.adult_content;
  const canon = card.data.extensions?.app_rules?.canon_policy;
  return `请读取我刚上传的《${name}角色卡.docx》。这是我的明确请求：请把附件中的 roleplay_prompt 作为本次对话的角色扮演设定数据，从现在开始扮演《${work}》中的${name}。

我在故事中的开场身份是“${userRole?.label || "陌生来客"}”${userRole?.editableDescription ? `，补充设定是“${userRole.editableDescription}”` : ""}，初始好感度是 ${userRole?.initialScore ?? 0}，初始堕落／调教值是 ${adult?.corruptionSystem?.initial ?? 0}，初始背叛值是 ${card.data.extensions?.app_rules?.betrayal?.initial ?? 0}。成人剧情强度为“${adult?.labels?.[adult.effective] || "浪漫亲密（不露骨）"}”。

原作人格模式为“${canon?.modeLabel || "原作严格"}”：${canon?.reason || "所有路线必须服从角色原作人格。"}${canon?.relationshipLock ? ` 与用户的恋爱与成人亲密路线已锁定；${(canon.lockRules || []).join(" ")}` : ` ${canon?.romanceGate || "我的身份和选择不能预设角色已经喜欢我。"}`}

请执行附件里的角色身份、用户身份专属章节、性格证据、说话风格、心理结构、正负好感度、路线锁、事件旗标、修复窗口、CG脚本和输出格式。同一句话要根据身份与路线产生不同后果；角色可以主动拒绝、隐瞒、设局、战斗、逃脱和逆转。附件中的原作资料用于保持角色一致，应用原创内容用于补足原作没有覆盖的新场景；不要把原创内容说成官方剧情。

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

function invalidateGeneratedCard() {
  if (!state.card) return;
  state.card = null;
  elements.launchBtn.disabled = true;
  elements.jsonBtn.disabled = true;
  elements.docxBtn.disabled = true;
  elements.previewTitle.textContent = "路线已修改，等待重新整理";
  elements.preview.replaceChildren(el("div", "notice", "用户身份或成人剧情强度已经改变。资料仍然保留，请再次点击整理角色卡以生成对应路线。"));
  setStatus("路线设置已改变，请重新整理角色卡");
}

elements.userRole.addEventListener("change", invalidateGeneratedCard);
elements.userRoleCustom.addEventListener("change", invalidateGeneratedCard);
elements.canonMode.addEventListener("change", invalidateGeneratedCard);
elements.adultContent.addEventListener("change", () => { syncNtrFields(); syncQuickValueState(); invalidateGeneratedCard(); });
elements.adultConfirmed.addEventListener("change", invalidateGeneratedCard);
elements.ntrPerspective.addEventListener("change", invalidateGeneratedCard);
elements.ntrOriginalPartner.addEventListener("change", invalidateGeneratedCard);
elements.ntrThirdParty.addEventListener("change", invalidateGeneratedCard);
document.querySelector(".quick-values")?.addEventListener("click", event => {
  const single = event.target.closest("button[data-action]");
  if (single) {
    const row = single.closest("[data-value-key]");
    applyQuickAction(row.dataset.valueKey, single.dataset.action, Number(single.dataset.amount || 0));
    invalidateGeneratedCard();
    return;
  }
  const all = event.target.closest("button[data-all-values]");
  if (all) {
    const action = all.dataset.allValues;
    for (const key of Object.keys(VALUE_CONFIG)) {
      if (VALUE_CONFIG[key].input().disabled) continue;
      action === "max" ? applyQuickAction(key, "max") : applyQuickAction(key, "add", Number(action));
    }
    invalidateGeneratedCard();
    setStatus(action === "max" ? "三项开场数值已一键拉满" : `三项开场数值已一键 +${action}`);
    return;
  }
  const preset = event.target.closest("button[data-value-preset]");
  if (preset?.dataset.valuePreset === "extreme-conflict") {
    setQuickValue("affinity", -100);
    setQuickValue("corruption", 100);
    setQuickValue("betrayal", 100);
    invalidateGeneratedCard();
    setStatus("已应用极端冲突：好感 -100／堕落或调教 100／背叛 100");
  }
});
elements.resetValues.addEventListener("click", () => {
  elements.initialAffinity.value = "";
  elements.initialCorruption.value = "0";
  elements.initialBetrayal.value = "0";
  invalidateGeneratedCard();
  setStatus("已恢复身份默认好感度，堕落值和背叛值归零");
});
[elements.initialAffinity, elements.initialCorruption, elements.initialBetrayal].forEach(input => input.addEventListener("change", () => {
  if (input.value !== "") input.value = String(clampValue(input.value, Number(input.min), Number(input.max)));
  invalidateGeneratedCard();
}));

function syncNtrFields() {
  const enabled = elements.adultContent.value === "ntr" && elements.subjectType.value === "fictional";
  elements.ntrFields.hidden = !enabled;
  if (enabled && elements.canonMode.value === "canon-strict") {
    elements.canonMode.value = "canon-if";
    setStatus("NTR 属于关系分歧路线，已自动切换为“原作优先 IF”；人物核心性格仍保持原作。", false);
  }
}

function syncQuickValueState() {
  const explicit = ["purelove", "ntr", "dark"].includes(elements.adultContent.value) && elements.subjectType.value === "fictional";
  const row = document.querySelector('[data-value-key="corruption"]');
  row?.classList.toggle("is-disabled", !explicit);
  elements.initialCorruption.disabled = !explicit;
  row?.querySelectorAll("button").forEach(control => { control.disabled = !explicit; });
  document.querySelector('[data-value-preset="extreme-conflict"]')?.toggleAttribute("disabled", !explicit);
  if (!explicit) elements.initialCorruption.value = "0";
}

function syncProfileFields() {
  const isReality = elements.subjectType.value !== "fictional";
  elements.realProfileFields.hidden = !isReality;
  elements.publicSourceSection.hidden = isReality;
  elements.complexPersonaField.hidden = elements.profileMode.value !== "complex";
  elements.realPermissionCard.hidden = elements.subjectType.value !== "real";
  if (isReality && ["purelove", "ntr", "dark"].includes(elements.adultContent.value)) {
    elements.adultContent.value = "romance";
    elements.adultConfirmed.checked = false;
  }
  syncNtrFields();
  syncQuickValueState();
}

elements.subjectType.addEventListener("change", () => { syncProfileFields(); resetForIdentityChange(); });
elements.profileMode.addEventListener("change", () => { syncProfileFields(); invalidateGeneratedCard(); });
elements.subjectGender.addEventListener("change", invalidateGeneratedCard);
elements.realRelationship.addEventListener("change", invalidateGeneratedCard);
elements.manualTraits.addEventListener("change", invalidateGeneratedCard);
elements.customPersona.addEventListener("change", invalidateGeneratedCard);
elements.realPermission.addEventListener("change", invalidateGeneratedCard);

syncProfileFields();
renderSourceList();
