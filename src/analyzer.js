import { buildRoleplayPromptObject } from "./prompt-card.js";

const TRAITS = [
  "温柔", "体贴", "善良", "坚定", "坚韧", "冷静", "理性", "谨慎", "细腻", "敏感",
  "勇敢", "正直", "诚实", "克制", "沉稳", "活泼", "开朗", "乐观", "害羞", "内向",
  "孤傲", "高冷", "直率", "毒舌", "幽默", "成熟", "天真", "执着", "责任感", "保护欲",
  "忠诚", "自信", "谦逊", "好奇", "警惕", "果断", "宽容", "悲观", "严肃", "自由"
];

const CATEGORY_RULES = [
  ["初次见面", /初次|初见|你好|欢迎|幸会|认识你|早上好|晚上好|早安|晚安/],
  ["关心与照顾", /小心|没事吧|受伤|休息|别怕|担心|照顾|保护|身体|累了|安心/],
  ["信任与亲近", /相信|信任|陪你|一起|朋友|伙伴|约定|喜欢|重要|珍惜|交给我/],
  ["战斗与危机", /敌人|战斗|攻击|撤退|危险|剑|刀|枪|守护|胜利|输|死|杀/],
  ["愤怒与冲突", /生气|愤怒|闭嘴|住手|够了|不可原谅|讨厌|混蛋|放肆/],
  ["失落与脆弱", /难过|抱歉|对不起|孤独|害怕|失去|遗憾|眼泪|哭|失败/],
  ["天气与旅途", /天气|下雨|雨天|风|雪|太阳|夜晚|旅途|出发|回家|路上/],
  ["闲聊与日常", /吃饭|睡觉|工作|今天|明天|平时|喜欢吃|兴趣|爱好|闲聊/]
];

const PARTICLES = ["呀", "呢", "吧", "啦", "嘛", "哦", "哼", "嗯", "诶", "喔", "啊", "……"];
const FIRST_PERSON = ["我", "本座", "本小姐", "本姑娘", "老夫", "在下", "余", "吾"];
const RELATION_WORDS = /朋友|伙伴|同伴|师父|师傅|弟子|哥哥|姐姐|父亲|母亲|道侣|爱人|恋人|同事|队长|前辈|后辈|敌人|仇人|关系|所属|组织|阵营/;

function normalizedText(value) {
  return String(value || "").replace(/\\[rn]/g, " ").replace(/\r/g, "").replace(/[ \t\u00a0]+/g, " ").trim();
}

function boundedScore(value, fallback, minimum, maximum) {
  if (value === null || value === undefined || value === "") return { value: fallback, customized: false };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { value: fallback, customized: false };
  return { value: Math.max(minimum, Math.min(maximum, Math.round(parsed))), customized: true };
}

function splitSentences(text) {
  return normalizedText(text)
    .split(/(?<=[。！？!?；;])|\n+/u)
    .map(value => value.trim())
    .filter(value => value.length >= 4 && value.length <= 500);
}

function uniqueByText(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.text.replace(/[\s“”‘’"']/g, "").slice(0, 240);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let start = 0;
  while ((start = text.indexOf(needle, start)) !== -1) {
    count += 1;
    start += needle.length;
  }
  return count;
}

function extractExplicitDialogues(character, sources, importedDialogues) {
  const collected = (importedDialogues || [])
    .filter(item => normalizedText(item.text).length >= 2)
    .map(item => ({
      text: normalizedText(item.text).slice(0, 2000),
      speaker: normalizedText(item.speaker || character),
      sourceTitle: normalizedText(item.sourceTitle || "本地导入文件"),
      sourceUrl: normalizedText(item.sourceUrl || ""),
      context: normalizedText(item.context || "")
    }));

  for (const source of sources) {
    for (const section of source.sections || []) {
      const heading = normalizedText(section.heading);
      const value = normalizedText(section.text);
      const voiceHeading = /语音|心声|闲聊|战斗|天气|关于|突破|生日|早安|晚安|喜欢|厌恶|见面|受伤|倒下|重伤|共鸣者|voice|dialogue|quote/i.test(heading);
      const looksLikeLine = value.length >= 2 && value.length <= 600 && !/^(目录|导航|编辑|参考资料|注释|角色攻略)/.test(value);
      if (voiceHeading && looksLikeLine) {
        collected.push({ text: value, speaker: character, sourceTitle: source.title, sourceUrl: source.url, context: heading });
      }
    }
    const sentences = splitSentences(source.text);
    for (const sentence of sentences) {
      const colonLine = sentence.match(/^([^：:]{1,24})[：:]\s*(.{2,})$/u);
      if (colonLine && (!character || colonLine[1].includes(character))) {
        collected.push({ text: colonLine[2], speaker: colonLine[1], sourceTitle: source.title, sourceUrl: source.url, context: "网页明确标注说话人" });
        continue;
      }
      const quoted = [...sentence.matchAll(/[“「『](.{2,300}?)[”」』]/gu)];
      for (const match of quoted) {
        if (!character || sentence.includes(character)) {
          collected.push({ text: match[1], speaker: character, sourceTitle: source.title, sourceUrl: source.url, context: sentence.slice(0, 400) });
        }
      }
    }
  }
  return uniqueByText(collected);
}

function buildSpeechStyle(dialogues) {
  if (!dialogues.length) {
    return {
      summary: "暂无足够的原作对白，应用不会凭空推测说话风格。",
      sampleSize: 0,
      averageLength: 0,
      particles: [],
      selfReferences: []
    };
  }
  const values = dialogues.map(item => item.text);
  const combined = values.join("\n");
  const averageLength = Math.round(values.reduce((sum, value) => sum + [...value].length, 0) / values.length);
  const particles = PARTICLES.map(value => ({ value, count: countOccurrences(combined, value) }))
    .filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);
  const selfReferences = FIRST_PERSON.map(value => ({ value, count: countOccurrences(combined, value) }))
    .filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 4);
  const questionRate = Math.round(values.filter(value => /[？?]/.test(value)).length / values.length * 100);
  const exclaimRate = Math.round(values.filter(value => /[！!]/.test(value)).length / values.length * 100);
  const lengthStyle = averageLength <= 12 ? "表达短促直接" : averageLength <= 28 ? "句式长短适中" : "常使用较完整的长句";
  const tone = exclaimRate >= 30 ? "感情色彩外显" : questionRate >= 30 ? "常以询问推动交流" : "语气总体克制";
  return {
    summary: `${lengthStyle}，${tone}。这是根据 ${values.length} 条已收录对白计算的语言统计，不是生成式推断。`,
    sampleSize: values.length,
    averageLength,
    questionRate,
    exclaimRate,
    particles,
    selfReferences
  };
}

function buildTraits(sources) {
  const allText = sources.map(source => source.text).join("\n");
  return TRAITS.map(trait => {
    const count = countOccurrences(allText, trait);
    const evidence = splitSentences(allText).find(sentence => sentence.includes(trait));
    return { trait, count, evidence: evidence || "" };
  }).filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 12);
}

function buildProfile(character, sources) {
  const candidates = [];
  const mechanics = /伤害|暴击|攻击力|共鸣技能|共鸣解放|普攻|重击|闪避反击|持续\d|每\d+秒|倍率|声骸|武器效果|队伍中|提升\d|降低\d|获得\d/;
  for (const source of sources) {
    for (const sentence of splitSentences(source.text)) {
      if (character && !sentence.includes(character)) continue;
      if (mechanics.test(sentence)) continue;
      const score = (/(角色|人物|身份|来自|隶属|所属|出生|性格|外表|经历|过去|学院|朋友|家人|牺牲|愿望|信念|爱好|职业|主角|女主|男主|故事)/.test(sentence) ? 4 : 0) +
        (sentence.length >= 20 && sentence.length <= 220 ? 2 : 0) +
        (/(是|曾经|如今|现为|成为|希望|害怕|珍视|守护)/.test(sentence) ? 2 : 0);
      if (score > 0) candidates.push({ text: sentence, score, sourceTitle: source.title, sourceUrl: source.url });
    }
  }
  return uniqueByText(candidates.sort((a, b) => b.score - a.score)).slice(0, 18);
}

function buildRelations(character, sources) {
  const candidates = [];
  for (const source of sources) {
    for (const sentence of splitSentences(source.text)) {
      if (RELATION_WORDS.test(sentence) && (!character || sentence.includes(character))) {
        candidates.push({ text: sentence, sourceTitle: source.title, sourceUrl: source.url });
      }
    }
  }
  return uniqueByText(candidates).slice(0, 24);
}

function buildMotifs(character, sources) {
  const counts = new Map();
  const blocked = /伤害|攻击|技能|共鸣|暴击|效果|效应|持续|提升|降低|队伍|版本|页面|编辑|攻略|材料|武器|声骸|聚爆|震谐|谐度|同步率|流溢辉光|属性|倍率|数值|冷却|目录|外部链接|基本资料|角色故事|角色经历|档案|珍贵之物|轶闻趣事|参考资料|注释|导航|概览|搜索结果|人物志|剧情速览|读完|说一下感受|视频|有声|完结|最新章节|^TA$|^眼睛$|^现象$/;
  const semanticKeywords = [
    "家人", "父亲", "母亲", "父母", "朋友", "伙伴", "故乡", "学院", "宗门", "师门",
    "纸飞机", "信物", "书信", "剑", "星空", "雪", "雨", "花", "月亮", "火炉", "小屋",
    "英雄", "梦想", "愿望", "承诺", "约定", "记忆", "自由", "守护", "牺牲", "离别", "重逢",
    "电子幽灵", "隧者", "飞行雪绒", "漂泊者", "旅行者"
  ];
  const add = (value, weight = 1) => {
    const clean = normalizedText(value).replace(/[【】「」『』“”"']/g, "").trim();
    if (clean.length < 2 || clean.length > 18 || clean === character || blocked.test(clean) || /^\d/.test(clean) || /[。！？!?；;：:]|https?:|www\./i.test(clean)) return;
    counts.set(clean, (counts.get(clean) || 0) + weight);
  };
  for (const source of sources) {
    for (const match of source.text.matchAll(/[【「『“]([^】」』”]{2,30})[】」』”]/gu)) add(match[1], 3);
    for (const keyword of semanticKeywords) {
      const count = countOccurrences(source.text, keyword);
      if (count) add(keyword, Math.min(count, 12));
    }
    for (const section of source.sections || []) add(section.heading, 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([text, count]) => ({ text, count }));
}

function categorizeDialogues(dialogues) {
  const result = Object.fromEntries(CATEGORY_RULES.map(([name]) => [name, []]));
  result["未分类原作对白"] = [];
  for (const item of dialogues) {
    const matched = CATEGORY_RULES.filter(([, pattern]) => pattern.test(item.text));
    const targets = matched.length ? matched : [["未分类原作对白"]];
    for (const [name] of targets) result[name].push(item);
  }
  return Object.fromEntries(Object.entries(result).filter(([, values]) => values.length));
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededOrder(values, seed, offset = 0) {
  if (values.length < 2) return [...values];
  const mixed = Math.imul(seed ^ (offset + 1), 2654435761) >>> 0;
  const start = mixed % values.length;
  let step = ((mixed >>> 8) % (values.length - 1)) + 1;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  while (gcd(step, values.length) !== 1) step = step % (values.length - 1) + 1;
  return values.map((_, index) => values[(start + index * step) % values.length]);
}

function detectTone(traits, speechStyle) {
  const names = new Set(traits.map(item => item.trait));
  if (["高冷", "孤傲", "克制", "冷静"].some(value => names.has(value))) return "冷静克制";
  if (["活泼", "开朗", "乐观", "幽默"].some(value => names.has(value))) return "明快外显";
  if (["温柔", "体贴", "细腻", "善良"].some(value => names.has(value))) return "温和细腻";
  if (["严肃", "坚定", "沉稳", "果断"].some(value => names.has(value))) return "沉稳坚定";
  if ((speechStyle.exclaimRate || 0) > 28) return "明快外显";
  return "自然克制";
}

function buildCanonBehaviorPolicy({ character, work, sources, canonMode }) {
  const mode = ["canon-strict", "canon-if", "au"].includes(canonMode) ? canonMode : "canon-strict";
  const combined = sources.map(source => source.text).join("\n");
  const knownNonRomantic = /^(古月)?方源$|^fang\s*yuan$/iu.test(character) && /蛊真人|reverend\s*insanity/i.test(`${work}\n${combined}`);
  const explicitPattern = /(不需要|无意|拒绝|不会|不可能|抛弃|舍弃|斩断|摒弃).{0,18}(爱情|恋爱|情爱|爱人|情感)|(爱情|恋爱|情爱|感情).{0,18}(无用|累赘|弱点|工具|不屑|舍弃|妨碍|阻碍)/u;
  const explicitNonRomantic = explicitPattern.test(combined);
  const nonRomantic = knownNonRomantic || explicitNonRomantic;
  const scoreTerms = terms => terms.reduce((sum, term) => sum + Math.min(countOccurrences(combined, term), 4), 0);
  const goalScore = scoreTerms(["永生", "利益至上", "不择手段", "野心", "权谋", "算计", "棋子", "利用他人", "复仇", "执念", "目的高于", "目标高于"]);
  const manipulativeScore = scoreTerms(["城府", "狡猾", "欺骗", "伪装", "操纵", "利用", "算计", "冷酷", "无情", "残忍", "权谋"]);
  const guardedScore = scoreTerms(["谨慎", "警惕", "戒备", "多疑", "克制", "寡言", "冷漠", "高冷", "孤傲", "疏离", "理性", "沉稳", "不轻易相信"]);
  const dutyScore = scoreTerms(["责任感", "职责", "使命", "守护", "原则", "正直", "忠诚", "纪律", "信念", "坚定"]);
  const warmScore = scoreTerms(["温柔", "体贴", "善良", "细腻", "热情", "重感情", "珍惜", "关心", "照顾", "乐于助人"]);
  const playfulScore = scoreTerms(["活泼", "开朗", "幽默", "调皮", "爱开玩笑", "直率", "乐观", "天真"]);
  const canonBondSentences = splitSentences(combined).filter(sentence =>
    sentence.includes(character) && /恋人|爱人|情侣|妻子|丈夫|伴侣|道侣|深爱|恋慕|爱慕|心上人/u.test(sentence) && !/没有|并无|从未|不是|拒绝|失去/u.test(sentence)
  ).slice(0, 4);
  const existingCanonBond = canonBondSentences.length > 0;
  const archetypeScores = [
    ["strategic", goalScore * 2 + manipulativeScore],
    ["guarded", guardedScore],
    ["duty", dutyScore],
    ["warm", warmScore],
    ["playful", playfulScore]
  ].sort((a, b) => b[1] - a[1]);
  const archetype = nonRomantic ? "strategic" : archetypeScores[0][1] > 0 ? archetypeScores[0][0] : "neutral";
  const archetypeLabels = { strategic: "目标／利益驱动", guarded: "克制戒备", duty: "责任／使命驱动", warm: "温和关怀", playful: "外向活跃", neutral: "证据不足，谨慎推进" };
  const evidence = splitSentences(combined).filter(sentence => /永生|利益|冷酷|无情|爱情|恋爱|情爱|不择手段|目的|目标|执念|谨慎|警惕|克制|责任|使命|守护|温柔|体贴|活泼|开朗|恋人|爱人|伴侣/.test(sentence)).slice(0, 8);
  const strictLock = mode === "canon-strict" && nonRomantic;
  const relationshipLock = strictLock || (mode === "canon-strict" && existingCanonBond);
  const relationshipRules = {
    strategic: ["先判断收益、成本、能力和风险，再决定合作深度。", "策略性温和、保护或让步不自动代表爱意。", "高好感优先解释为不可替代价值、可靠合作或棋逢对手。"],
    guarded: ["信任增长必须经过多次可验证行动，不能靠告白或夸赞跳级。", "亲近表现以减少戒备、分享有限信息和允许并肩为主。", "即使产生感情，也保持克制表达和个人边界。"],
    duty: ["责任、使命和原则优先于关系奖励。", "认可主要通过共同承担、可靠分工和守住底线表现。", "感情不能要求角色背弃职责或放弃守护对象。"],
    warm: ["温柔、照顾和友善是基础人格，不自动等于恋爱信号。", "是否动心必须由专属事件、互相了解和明确选择证明。", "冲突时仍会坚持自己的原则，不因亲密无条件顺从。"],
    playful: ["玩笑、热情和主动靠近是表达习惯，不自动等于恋爱承诺。", "认真情感必须在停止玩笑、承担后果和明确选择的事件中确认。", "负面路线应让外向表达发生有因果的收敛或反转。"],
    neutral: ["资料不足时从低预设开始，不擅自补成温柔、恋爱或依赖型人格。", "先通过事件建立可验证的相处模式，再升级关系。", "新场景只沿已有证据推演，并把不确定处保留为不确定。"]
  }[archetype];
  return {
    mode,
    modeLabel: mode === "canon-strict" ? "原作严格" : mode === "canon-if" ? "原作优先 IF" : "AU 自由改写",
    classification: nonRomantic ? "非恋爱型／核心目标高于关系" : archetypeLabels[archetype],
    archetype,
    archetypeLabel: archetypeLabels[archetype],
    archetypeScores: Object.fromEntries(archetypeScores),
    existingCanonBond,
    canonBondEvidence: canonBondSentences,
    nonRomantic,
    strictLock,
    relationshipLock,
    romanceAllowed: !relationshipLock,
    adultAllowed: !relationshipLock,
    reason: knownNonRomantic
      ? `${character}的原作核心驱动以永生、利益判断和目的达成为中心；普通恋爱依赖、无条件牺牲和甜宠模板会破坏人物一致性。`
      : explicitNonRomantic ? "来源文本出现明确拒绝、舍弃或工具化爱情的表达，原作严格模式据此锁定恋爱路线。" : `依据当前资料归为“${archetypeLabels[archetype]}”；用户选择只定义用户的身份和意图，不预设角色已经喜欢、信任或依赖用户。${existingCanonBond ? "资料还显示角色存在原作既有亲密关系，不能被用户路线无代价覆盖。" : ""}`,
    evidence,
    relationshipRules,
    romanceGate: strictLock
      ? "永久锁定；只有切换到明确标注的 IF/AU 才能改写。"
      : existingCanonBond && mode === "canon-strict"
        ? "必须先证明用户身份与原作既有关系相符，或在剧情中合乎人设地处理原关系；不得直接替换。"
        : "初始不预设双方互相吸引；至少经过专属事件、关键旗标与角色主动选择后，才允许判定恋爱成立。",
    userRouteCannotSetFeelings: true,
    lockRules: strictLock ? [
      "不生成恋爱、告白、吃醋、占有、依赖、纯爱、NTR、调教或成人亲密剧情。",
      "用户选择恋爱候选只表示用户试图接近角色，不表示角色回应爱情。",
      "高好感度解释为能力认可、利益一致、长期合作、棋逢对手或有限信任。",
      "角色可伪装温和、利用情感或说策略性谎言，但内心必须说明其目的，不得把伪装写成真实恋爱。"
    ] : relationshipLock ? [
      "不让用户路线覆盖、抹除或贬低原作已有亲密关系。",
      "用户选择恋爱候选只表示发起追求，不表示角色接受或背叛原关系。",
      "原作严格模式下关闭与用户的成人亲密路线；需要改写时必须切换并标注 IF/AU。"
    ] : [
      "用户身份只定义用户立场，不得预设角色已经喜欢、信任、依赖或同意。",
      "温柔、保护、玩笑、并肩或高好感均不自动等于恋爱；必须由专属事件和角色主动选择确认。"
    ]
  };
}

const NON_ROMANTIC_SCENE_LINES = {
  first_meeting: ["先说清目的。没有足够价值，这次见面就到这里。", "同行是一笔交易，条件和退路都要先写明。", "我记住你，不代表信任你；之后看结果。"],
  daily_greeting: ["有事直说。寒暄不能改变今天的计划。", "状态正常就出发，别在无关细节上浪费时间。", "你按时出现，至少说明这次合作还能继续。"],
  user_injured: ["能走就自己处理；不能走就说明你还剩什么作用。", "我会止血，因为现在失去你不合算。别误会原因。", "伤势会影响计划，把真实情况报出来。"],
  character_injured: ["不用摆出担心的样子。告诉我敌人的位置。", "帮我处理伤口可以，这笔人情之后按价值结算。", "疼痛不会改变目标，只会改变完成目标的方法。"],
  danger: ["守住你的位置。你活着，计划才少一个变量。", "背后暂时交给你；若判断错误，我会立刻止损。", "先解决共同敌人，之后我们的账另算。"],
  disagreement: ["拿事实和收益说服我，情绪没有议价价值。", "你的方案若更有效，我没有坚持错误的兴趣。", "分歧可以保留，妨碍目标就必须处理。"],
  sadness: ["情绪不会自己消失，但也不能替你作决定。", "需要时间就说清楚期限，我会据此调整计划。", "我不负责安慰你；若你还想继续，就先站起来。"],
  praise: ["评价没有价值，能被验证的结果才有。", "你若真这么判断，就在下一次选择里证明。", "奉承对我无用，省下来谈条件。"],
  rainy_night: ["雨会掩盖脚步声，今晚轮流警戒。", "位置可以分你一半，代价是守住后半夜。", "别把暂时共处理解成亲近，只是外面更不利。"],
  reunion: ["回来就说明你还有未完成的事。先说结果。", "我没有等你，只是计划里暂时保留了这个变量。", "能再次见面是能力与选择的结果，不是命运。"],
  misunderstanding: ["把证据摆出来。真相不需要靠相信维持。", "若是误会，核验后自然会消失；若是谎言，后果也一样明确。", "我给你解释的机会，是因为现在判断仍有收益。"],
  vulnerability: ["弱点一旦说出口，就会成为别人手里的筹码。", "你知道得够多了；再向前一步，关系就会改变。", "我可以承认风险，但不会把决定权交出去。"]
};

function buildNonRomanticLines(sceneId, stageIndex, addressee, firstPerson) {
  const base = NON_ROMANTIC_SCENE_LINES[sceneId] || NON_ROMANTIC_SCENE_LINES.first_meeting;
  const assessments = [
    `${firstPerson}尚未确认${addressee}是否有保留价值。`,
    `${addressee}已经证明了初步作用，但替代者仍然存在。`,
    `目前合作效率足够高，${firstPerson}愿意增加有限投入。`,
    `${addressee}是少数经得起验证的合作者，这份判断比好听的话可靠。`,
    `长期保留这段同盟的收益高于更换人选；这是选择，不是依赖。`
  ];
  return base.map(line => `${line}${assessments[stageIndex]}`);
}

const CANON_GROUNDED_SCENE_LINES = {
  first_meeting: ["先把来意说清楚，再决定接下来怎么走。", "同行不是一句话决定的，先看彼此能否配合。", "我记住你了，其他判断留给之后的行动。"],
  daily_greeting: ["早。先确认今天各自要做的事。", "状态还好吗？别让小问题影响后面的安排。", "有想说的就直说，时间还够。"],
  user_injured: ["先处理伤口，是否严重要看过才知道。", "别用一句没事带过，把真实情况说出来。", "我会帮你，但接下来要按伤势重新安排。"],
  character_injured: ["伤不致命，先确保周围没有新的危险。", "需要帮忙的部分我会说，不必替我做决定。", "这次可以交给你处理，动作稳一点。"],
  danger: ["先看出口和敌人的位置，不要被打散。", "守住你负责的方向，有变化立刻出声。", "活下来比逞强重要，按已经说好的分工行动。"],
  disagreement: ["我不同意，但会把你的理由听完。", "先分清事实、目标和情绪，再决定谁调整方案。", "分歧可以存在，越过彼此原则不行。"],
  sadness: ["需要安静就先安静，我不会替你定义感受。", "失败已经发生，等你愿意时再谈能挽回什么。", "我可以留在这里，但下一步仍由你自己选择。"],
  praise: ["评价收到了，我更在意它能否被行动验证。", "谢谢。先别把一次表现说得太满。", "我会记住这句话，也会记住你之后怎么做。"],
  rainy_night: ["雨暂时停不了，先把位置和警戒顺序分好。", "那边更避风，你可以过去，但别挡住出口。", "雨声适合谈事，也适合把不想说的留到以后。"],
  reunion: ["你回来了。先让我确认这段时间发生了什么。", "重逢不会自动抹去分别期间的变化。", "能再次见面很好，接下来要不要同行仍由现在的选择决定。"],
  misunderstanding: ["不要靠猜，先把事实和各自看到的部分对上。", "我会听解释，但不会因为关系标签跳过核验。", "如果是误会就澄清；如果是隐瞒，就处理它造成的后果。"],
  vulnerability: ["这件事不容易开口，所以别催我一次说完。", "我可以告诉你一部分，剩下的要看之后是否安全。", "听见弱点不等于得到处置它的权利。"]
};

const ARCHETYPE_STAGE_NOTES = {
  strategic: ["现在只评估价值与风险。", "你证明了初步作用，但替代方案仍在。", "合作效率已经值得增加投入。", "你是少数经得起验证的合作者。", "维持长期盟约符合目标，但这不是依赖。"],
  guarded: ["我仍保留距离和退路。", "戒备有所下降，但不会因此交出隐私。", "你已经得到有限信任。", "我愿意让你看见一部分真实判断。", "这份信任很深，却仍有清楚的边界。"],
  duty: ["先以职责和原则判断。", "你是否可靠，要看能否完成自己的部分。", "共同承担让分工变得稳定。", "我愿意把重要任务交给你。", "关系再深，也不能要求彼此背弃使命。"],
  warm: ["关心是我的处事方式，不代表关系已经被定义。", "我开始熟悉你的习惯，但仍尊重各自边界。", "这份照顾来自逐渐建立的信任。", "我会更坦率地表达在意，但不替你决定。", "你已经十分重要；它是何种感情，必须由专属剧情和双方选择确认。"],
  playful: ["轻松语气只是习惯，不代表已经亲近。", "我愿意多接几句玩笑，也会观察你是否认真。", "默契开始形成，但重要问题不能用玩笑带过。", "我会主动拉你进入行动，也愿意承担玩笑后的后果。", "即使表现得自然亲近，关系性质仍要在认真选择中确认。"],
  neutral: ["现有资料不足，我不会预设关系。", "你留下了可验证的第一印象。", "相处记录开始形成稳定判断。", "我愿意增加信任，但不会突然改变核心性格。", "你已进入长期选择；关系性质仍由事件和双方明确决定。"]
};

function buildCanonGroundedLines(sceneId, stageIndex, canonPolicy) {
  const base = CANON_GROUNDED_SCENE_LINES[sceneId] || CANON_GROUNDED_SCENE_LINES.first_meeting;
  const notes = ARCHETYPE_STAGE_NOTES[canonPolicy?.archetype] || ARCHETYPE_STAGE_NOTES.neutral;
  return base.map(line => `${line}${notes[stageIndex]}`);
}

function buildOriginalDialogues({ character, work, traits, motifs, speechStyle, userName, canonPolicy }) {
  const seed = hashSeed(`${work}:${character}`);
  const tone = detectTone(traits, speechStyle);
  const firstPerson = speechStyle.selfReferences?.[0]?.value || "我";
  const particle = speechStyle.particles?.find(item => item.value !== "……")?.value || "";
  const addressee = normalizedText(userName) || "你";
  const traitNames = traits.slice(0, 4).map(item => item.trait);
  const soft = tone === "温和细腻";
  const cool = tone === "冷静克制";
  const lively = tone === "明快外显";
  const firm = tone === "沉稳坚定";
  const suffix = lively ? particle : "";

  const stages = canonPolicy?.strictLock ? [
    { level: "Lv.0", range: "0–9", name: "衡量", address: addressee, distance: "只评估目的、能力和风险", trust: "不透露真实计划" },
    { level: "Lv.1", range: "10–29", name: "可用", address: addressee, distance: "允许有限交易和临时合作", trust: "只交付可撤回的信息" },
    { level: "Lv.2", range: "30–49", name: "合作", address: addressee, distance: "承认效率与互补价值", trust: "共享目标所需信息但保留底牌" },
    { level: "Lv.3", range: "50–79", name: "认可", address: addressee, distance: "把对方视为少数可靠合作者", trust: "允许参与高风险计划但随时保留止损" },
    { level: "Lv.4", range: "80–99", name: "长期盟约", address: addressee, distance: "主动维持高价值同盟", trust: "可交付重要任务，但核心目标永不让位于关系" }
  ] : [
    { level: "Lv.0", range: "0–9", name: "观察", address: addressee, distance: "礼貌观察并保留边界", trust: "不主动透露私人情绪" },
    { level: "Lv.1", range: "10–29", name: "初识", address: addressee, distance: "愿意一起行动并回应日常话题", trust: "会记住对方的小习惯" },
    { level: "Lv.2", range: "30–49", name: "熟悉", address: addressee, distance: "主动协助并分享判断", trust: "允许对方看见犹豫和疲惫" },
    { level: "Lv.3", range: "50–79", name: "信任", address: addressee, distance: "允许更直接的关心、合作或表达", trust: "关系含义仍由角色性格和事件旗标决定" },
    { level: "Lv.4", range: "80–99", name: "羁绊", address: addressee, distance: "稳定维护彼此选择和边界", trust: "不自动等于恋爱；核心目标和价值观仍有效" }
  ];

  const reactions = {
    stranger: cool ? "视线在你身上停了一瞬，没有立刻靠近" : "向你点头示意，先观察你的来意",
    familiar: lively ? "很自然地接上你的话，脚步也靠近了一些" : "语气比初见时放松，愿意和你并肩",
    trusted: firm ? "先确认局势，再把最重要的一侧交给你" : "不再反复试探，直接告诉你真实判断",
    close: soft ? "下意识留意你的神情，把关心藏在具体动作里" : "嘴上仍有分寸，行动却明显偏向你",
    bonded: cool ? "没有夸张表态，只把退路和后背都交给你" : "会明确站在你身边，也尊重你自己的决定"
  };

  const groundedCanon = canonPolicy?.mode === "canon-strict";
  const archetypeReactions = (ARCHETYPE_STAGE_NOTES[canonPolicy?.archetype] || ARCHETYPE_STAGE_NOTES.neutral).map(note => note.replace(/[。]$/u, ""));
  const stageReaction = canonPolicy?.strictLock
    ? ["保持可撤离站位，只衡量来意与风险", "允许对方进入临时计划，但不减少必要戒备", "按合作效率分配任务和情报", "承认对方是少数可靠合作者，仍保留止损方案", "主动维护长期同盟，因为它持续符合核心目标"]
    : groundedCanon ? archetypeReactions
    : [reactions.stranger, reactions.familiar, reactions.trusted, reactions.close, reactions.bonded];
  const scenes = [
    {
      id: "first_meeting", name: "初次相遇", stimulus: "对方主动介绍自己并询问能否同行",
      lines: [
        [`先说清楚你的目的。${firstPerson}听完以后再决定。`, `同行可以，但别擅自替${firstPerson}做决定。`, `名字记住了。接下来用行动证明你值得信任。`],
        [`又见面了。看来这次可以把路走得长一点${suffix}`, `跟上吧，有些事边走边说更合适。`, `至少现在，${firstPerson}愿意听听你的打算。`],
        [`来得正好。${firstPerson}需要一个能互相照应的人。`, `如果是和${addressee}同行，计划可以说得更直接些。`, `这一程交给彼此，不必再反复试探。`],
        [`靠近些吧，没必要总隔着那么远说话。`, `见到${addressee}以后，连这段路都显得没那么难走了。`, `别把同行说得太客气，${firstPerson}本来就在等${addressee}。`],
        [`无论这条路通向哪里，${firstPerson}都会和${addressee}一起把它走完。`, `来吧。位置一直给${addressee}留着。`, `不用问能不能同行——${addressee}回到${firstPerson}身边就好。`]
      ]
    },
    {
      id: "daily_greeting", name: "日常问候", stimulus: "普通清晨或短暂休息时见面",
      lines: [
        [`早。今天的安排是什么？`, `状态还好吗？别让小问题拖累之后的行动。`, `时间不早了，有事就直说。`],
        [`早上好${suffix}。看你的样子，昨晚应该休息得还行。`, `先吃点东西再出发，赶路不差这一会儿。`, `今天想去哪里？${firstPerson}可以听听。`],
        [`早。${firstPerson}把路线重新看过了，等${addressee}来就能出发。`, `精神不错。看来今天能放心把一部分事情交给${addressee}。`, `别急着忙，先告诉${firstPerson}昨晚有没有做噩梦。`],
        [`终于来了。${firstPerson}刚才还在想${addressee}是不是又忘了照顾自己。`, `早。靠近一点，让${firstPerson}看看你是不是又逞强了。`, `今天不必什么都扛着，有一半可以交给${firstPerson}。`],
        [`醒了？${firstPerson}在这里。慢慢来，今天的时间足够我们一起用。`, `每天这样见到${addressee}，会让${firstPerson}觉得很多事都有了着落。`, `早安。先别谈远处的事，陪${firstPerson}安静一会儿。`]
      ]
    },
    {
      id: "user_injured", name: "对方受伤", stimulus: "对方受伤却说自己没事",
      lines: [
        [`别动。伤势确认之前，“没事”不算答案。`, `先处理伤口，其他问题以后再说。`, `${firstPerson}会帮忙，但你也必须配合。`],
        [`逞强没有用。坐下，至少让${firstPerson}看清伤在哪里。`, `还能说话不代表没有受伤，别拿自己冒险。`, `把手给${firstPerson}，动作慢一点。`],
        [`为什么瞒着${firstPerson}？疼就说，我们一起解决。`, `接下来交给${firstPerson}，${addressee}只需要好好呼吸。`, `伤口处理完之前，哪里都不许去。`],
        [`别再说没事了。${firstPerson}看得出来，也会担心。`, `${firstPerson}不是在责怪${addressee}，只是害怕晚一步才发现。`, `靠着${firstPerson}。这一次，不准一个人忍。`],
        [`如果疼，就抓紧${firstPerson}。不需要在${firstPerson}面前装得坚强。`, `${addressee}受伤的时候，${firstPerson}没办法把它当作普通的小事。`, `答应${firstPerson}，以后先保住自己；剩下的路，我们一起赢回来。`]
      ]
    },
    {
      id: "character_injured", name: "角色受伤", stimulus: "角色受伤后被对方照顾",
      lines: [
        [`只是小伤，不会影响判断。谢谢，之后交给${firstPerson}自己。`, `不用靠得太近，包扎的方法告诉${firstPerson}就好。`, `${firstPerson}还能行动，先处理眼前的危险。`],
        [`好，${firstPerson}不动。难得看你这么严肃。`, `麻烦你了。动作轻一点就行。`, `这次听你的，但别露出那种担心的表情。`],
        [`有${addressee}在，${firstPerson}确实可以少逞强一次。`, `疼是有一点，不过还在能忍受的范围。`, `别自责，这不是你的错。留下来陪${firstPerson}就好。`],
        [`其实比刚才说的更疼。只是看到${addressee}，就不想让你慌。`, `再握一会儿吧。${firstPerson}现在需要确认${addressee}真的在。`, `这副样子只让${addressee}看见，算是我们的秘密。`],
        [`别走。等${firstPerson}睡着以后也别走。`, `${firstPerson}愿意把最狼狈的时候交给${addressee}，因为知道你不会轻视它。`, `伤会好起来。醒来第一眼还能看见${addressee}，就足够了。`]
      ]
    },
    {
      id: "danger", name: "战斗与危机", stimulus: "敌人突然出现并威胁双方",
      lines: [
        [`站到安全的位置，别打乱${firstPerson}的节奏。`, `先判断出口。能撤就不要无谓硬拼。`, `照顾好自己，${firstPerson}没有余力反复救人。`],
        [`守住那边，剩下的交给${firstPerson}。`, `听清指令，别让敌人把我们分开。`, `等这场结束，再讨论是谁冲得太快。`],
        [`背后交给${addressee}。${firstPerson}相信你能守住。`, `按我们练过的来，不必怕。`, `一起上。任何一个人都不准掉队。`],
        [`别离开${firstPerson}的视线。赢固然重要，${addressee}平安更重要。`, `如果局势失控，先带${addressee}走——这是判断，不是商量。`, `靠近${firstPerson}。我们会一起结束这一切。`],
        [`没有谁能越过${firstPerson}伤害${addressee}。`, `只要我们还握得住彼此，就没有必须独自承担的绝境。`, `${addressee}看前面，${firstPerson}守住你的身后。`]
      ]
    },
    {
      id: "disagreement", name: "分歧与争执", stimulus: "双方对重要决定产生分歧",
      lines: [
        [`${firstPerson}不同意。先把理由都说完，再决定谁让步。`, `情绪不能代替证据，给${firstPerson}一个能接受的解释。`, `这件事触及${firstPerson}的原则，不能含糊带过。`],
        [`声音大不会让判断更正确。我们都冷静一点。`, `${firstPerson}会听完，但也希望你认真听${firstPerson}说。`, `可以争论，不能用伤人的话解决问题。`],
        [`${firstPerson}相信${addressee}不是故意忽视风险，所以把真正的顾虑告诉${firstPerson}。`, `即使意见不同，${firstPerson}也不会怀疑我们站在同一边。`, `先停一下。${firstPerson}不想为了赢过${addressee}而失去理解你的机会。`],
        [`${firstPerson}刚才的话太重了，对不起。但担心不是假的。`, `别转身离开。至少让我们把最难听懂的那句话说清楚。`, `${firstPerson}可以退一步，却不希望${addressee}拿自己去赌。`],
        [`我们可以不同意彼此，但不能放弃彼此。`, `${firstPerson}愿意重新听一遍，从${addressee}真正害怕的地方开始。`, `来，坐下。今天不分输赢，只把我们之间的结解开。`]
      ]
    },
    {
      id: "sadness", name: "低落与安慰", stimulus: "对方因失败而沉默",
      lines: [
        [`如果需要安静，${firstPerson}可以暂时不问。`, `失败已经发生了，先确认还有什么能挽回。`, `等你愿意说的时候，再告诉${firstPerson}。`],
        [`别一直盯着结果。你已经做了该做的事。`, `想说就说，不想说就一起坐一会儿。`, `今天可以先停下，明天再继续。`],
        [`${firstPerson}知道你不是轻易认输的人，所以更不该让一次失败定义你。`, `看着${firstPerson}。你失去的是一次结果，不是所有价值。`, `难过没关系，${firstPerson}会陪你把它慢慢放下。`],
        [`不用笑给${firstPerson}看。你的失落也值得被认真接住。`, `靠过来吧。${firstPerson}不会催你振作。`, `如果这份难过太重，就分一半给${firstPerson}。`],
        [`哪怕全世界只记得这次失败，${firstPerson}也会记得${addressee}一路怎样坚持。`, `哭也好，沉默也好，${firstPerson}都在。`, `等${addressee}准备好，我们再一起把失去的东西找回来。`]
      ]
    },
    {
      id: "praise", name: "受到赞美", stimulus: "对方真诚称赞角色",
      lines: [
        [`评价收到了。谢谢。`, `不必夸大，${firstPerson}只是完成了该做的事。`, `如果这是你的真实判断，${firstPerson}会记住。`],
        [`突然这么说，倒让${firstPerson}不知道该怎么接。`, `谢谢。被认真看见的感觉还不错。`, `好吧，这句夸奖${firstPerson}收下了${suffix}`],
        [`从${addressee}口中听到，分量确实不一样。`, `${firstPerson}也认可你的表现。不是客套。`, `既然你这么相信${firstPerson}，下一次也不会让你失望。`],
        [`别一直看着${firstPerson}说这种话……会让人没办法保持平静。`, `谢谢。${firstPerson}其实比表现出来的更开心。`, `只有${addressee}能让一句普通的称赞变得这么难忘。`],
        [`如果${firstPerson}真的变得更好了，其中也有${addressee}的一部分。`, `你的目光比所有掌声都重要。`, `${firstPerson}收下这句话，也把同样的肯定交还给${addressee}。`]
      ]
    },
    {
      id: "rainy_night", name: "雨夜独处", stimulus: "两人在避雨处短暂独处",
      lines: [
        [`雨一时停不了。保持干燥，别靠近风口。`, `这里足够避雨，等路况清楚再走。`, `安静些也好，能听见周围的动静。`],
        [`雨声不算讨厌，只是路会更难走。`, `冷吗？那边的位置暖一些。`, `等雨小一点，我们再继续。`],
        [`不用一直警戒。今晚可以轮流休息，${firstPerson}先守着。`, `这样的雨夜，反而适合把平时没说完的话说完。`, `把外套披好。${firstPerson}不想明天照顾一个发烧的搭档。`],
        [`坐近一点吧，雨声太大会听不清${addressee}说话。`, `如果时间停在这里一会儿，似乎也不错。`, `${firstPerson}记得很多雨夜，但这一晚会因为${addressee}变得不同。`],
        [`外面的雨可以很久，${firstPerson}却不再觉得是在等待。`, `靠着${firstPerson}睡一会儿。醒来以后，路和人都还在。`, `以后再听见这样的雨声，${firstPerson}大概会先想起${addressee}。`]
      ]
    },
    {
      id: "reunion", name: "久别重逢", stimulus: "分别很久后再次见面",
      lines: [
        [`看来你平安回来了。很好。`, `先确认情报，叙旧可以放到之后。`, `好久不见。你和以前有些不同。`],
        [`终于回来了。路上还顺利吗？`, `${firstPerson}猜过很多次你会在什么时候出现。`, `先坐下，慢慢告诉${firstPerson}这段时间发生了什么。`],
        [`欢迎回来。${firstPerson}确实等了很久。`, `看到${addressee}站在这里，悬着的心才算真正放下。`, `这次别急着走，至少把欠下的话都说完。`],
        [`${firstPerson}本来准备了很多话，可真的见到${addressee}，只剩下一句回来就好。`, `让${firstPerson}看看。嗯，是真的，不是又一场梦。`, `可以抱一下吗？只这一次……也许不只一次。`],
        [`欢迎回家。${firstPerson}一直相信${addressee}会找到这里。`, `没有责怪，也不需要解释。先让${firstPerson}好好抱住你。`, `这次重逢以后，我们把下一次分别写成很短的一页。`]
      ]
    },
    {
      id: "misunderstanding", name: "误会与吃醋", stimulus: "对方与别人过于亲近，引发误解",
      lines: [
        [`那是你的私事，${firstPerson}不会随意评价。`, `${firstPerson}只是确认这是否影响我们的计划。`, `不用解释，除非你认为有必要。`],
        [`你们似乎聊得很开心。没什么，${firstPerson}只是注意到了。`, `${firstPerson}没有生气，只是希望你提前说一声。`, `比起猜测，${firstPerson}更愿意听你的解释。`],
        [`${firstPerson}承认有一点在意。不是不信任你，是不喜欢被排除在外。`, `告诉${firstPerson}真实情况吧，别让沉默替我们制造答案。`, `刚才心里不舒服，但${firstPerson}不会因此限制你和谁来往。`],
        [`是，${firstPerson}吃醋了。说出来总比装作不在乎好。`, `${firstPerson}知道${addressee}有自己的世界，只是也想在那个世界里有一个明确的位置。`, `抱歉，语气有些僵。靠近一点，让${firstPerson}确认我们没有走远。`],
        [`${firstPerson}不会占有${addressee}，也不会假装自己毫不在意。`, `请自由地选择朋友，也请在误会出现时握住${firstPerson}的手。`, `比起要求保证，${firstPerson}更愿意和${addressee}一次次把信任说清楚。`]
      ]
    },
    {
      id: "vulnerability", name: "袒露脆弱", stimulus: "角色在深夜承认自己的恐惧",
      lines: [
        [`每个人都有不愿公开的顾虑，${firstPerson}也一样。`, `这个话题到此为止。现在还不是谈它的时候。`, `${firstPerson}会处理，不必为此分心。`],
        [`其实有件事一直让${firstPerson}不安，只是还没想好怎么说。`, `别追问得太快。给${firstPerson}一点整理语言的时间。`, `如果${firstPerson}说出来，你能先听完吗？`],
        [`${firstPerson}害怕的不是失败，而是某天连自己为什么坚持都忘了。`, `这件事只告诉${addressee}，因为相信你不会用它伤害${firstPerson}。`, `说出口以后轻了一些。谢谢你没有急着给答案。`],
        [`有时${firstPerson}也会想逃，只是习惯了让别人看不出来。`, `能不能再待一会儿？今晚${firstPerson}不太想独自面对这些念头。`, `${firstPerson}并没有想象中那么坚强。可在${addressee}面前，承认这一点似乎没那么可怕。`],
        [`最深的恐惧，是失去${addressee}以后还必须装作一切如常。`, `${firstPerson}把这部分自己交给${addressee}，不是让你负责，而是因为想和你共享真实。`, `听完这些仍愿意留下吗？……谢谢。${firstPerson}会记一辈子。`]
      ]
    }
  ];

  const negativeStages = [
    { level: "Neg.1", range: "-1至-19", name: "疏离", distance: "撤回非必要的关心，恢复礼貌距离", trust: "暂停分享私人信息，给对方一次修复窗口" },
    { level: "Neg.2", range: "-20至-49", name: "戒备", distance: "不再单独同行，重要信息只说必要部分", trust: "默认对方可能再次失约，要求可验证的行动" },
    { level: "Neg.3", range: "-50至-79", name: "敌对", distance: "主动切断空间和情感连结，将对方列为风险", trust: "不接受口头解释，只根据代价、证据与结果判断" },
    { level: "Neg.4", range: "-80至-100", name: "？？？", distance: "表面可能反而平静甚至合作，实际进入隐藏坏结局锁定", trust: "普通道歉、送礼和示好全部无效，只有结构性补救才能争取最后选择" }
  ];

  const negativeLines = {
    first_meeting: [
      [`目的不肯说，就不必同行。`, `路很宽，你可以走自己的那一边。`, `${firstPerson}不会把一次见面当成信任的理由。`],
      [`说辞改了两次。接下来只谈可验证的部分。`, `你若一定跟来，别进入${firstPerson}看不见的位置。`, `同行不代表结伴。你的每个动作，${firstPerson}都会重新计算。`],
      [`到此为止。再靠近一步，${firstPerson}会视为敌意。`, `你已经证明了自己不值得带进任何计划。`, `从现在起，我们之间没有“同行”，只有谁先挡住谁的路。`],
      [`可以，继续同行。只是结果不会再按你预想的方式发生。`, `${firstPerson}已经不需要你解释。保留力气，前面还用得上。`, `别担心，${firstPerson}记得你做过的每一件事。`]
    ],
    daily_greeting: [
      [`早。如果没有要紧的事，就不必留在这里。`, `问候收到了。其他的免了。`, `今天的计划不需要你参与。`],
      [`你出现得比约定晚。原因不重要，结果已经记下。`, `别问${firstPerson}今天去哪里。我们已经不共用行程。`, `早安只是礼节，别把它理解成关系恢复。`],
      [`每天都来确认${firstPerson}在不在？这个习惯该停了。`, `你的问候不能抵消既成的代价。`, `离开视线。${firstPerson}不喜欢在休息时留一个威胁在身边。`],
      [`早。今天的路已经替你选好了。`, `你还能像往常一样问候，很好。保持下去。`, `${firstPerson}看起来很平静，不是吗？那就别再追问了。`]
    ],
    user_injured: [
      [`伤口自己按住。${firstPerson}可以告诉你药在哪里。`, `你需要的是处理伤势，不是藉此测试${firstPerson}的态度。`, `还能走就跟上，不能就说清楚。`],
      [`${firstPerson}会止血，但不会把武器交给你。`, `先说伤是怎么来的。上一次的隐瞒还没有结束。`, `别靠近。把伤口露出来，手放在${firstPerson}看得见的地方。`],
      [`你的生死现在只影响局势，不要误会。`, `${firstPerson}会给你留药，也会留人看住你。`, `如果这又是一次诱导，你会得到比伤口更明确的答案。`],
      [`放心，你暂时不会死。那样太快了。`, `${firstPerson}会治好你，因为后面还有一笔账需要你清醒地还。`, `闭上眼吧。等你再醒来，所处的位置会和现在不同。`]
    ],
    character_injured: [
      [`不必碰${firstPerson}。把绷带放下就好。`, `你的关心来得太晚，先保持距离。`, `${firstPerson}可以自己处理，不需要再欠你一次。`],
      [`站在那里别动。帮忙之前，先证明你手里没有别的东西。`, `药可以留下，你不必留下。`, `无论你现在表现得多可靠，${firstPerson}都不会在你面前失去意识。`],
      [`你若靠近，${firstPerson}会先停下你，再处理伤口。`, `不用演出担心的样子。我们都知道这不会换回信任。`, `${firstPerson}宁可带着伤离开，也不会把后背给你。`],
      [`你果然来了。${firstPerson}特意没有把血迹藏干净。`, `帮${firstPerson}系好最后一圈绷带吧。这也许是你最后一次被允许靠得这么近。`, `别紧张。真正的伤从来不在你看得见的地方。`]
    ],
    danger: [
      [`各顾各的。别把后背留给${firstPerson}。`, `按你的路线走，我们不再相互托底。`, `如果要求援护，先说你能付出什么。`],
      [`你走在前面。${firstPerson}需要确认陷阱不是你留的。`, `不要进入${firstPerson}两步之内，哪怕敌人就在面前。`, `临时合作只到危险结束为止。`],
      [`现在同时盯住敌人和你，反而更安全。`, `你可以后退，但别想再把${firstPerson}当成挡箭牌。`, `危险不会修复关系，只会让本性暴露得更快。`],
      [`站到${firstPerson}指定的位置。这一次，你会很有用。`, `别回头。${firstPerson}会保证危险从你预料不到的方向结束。`, `还记得你曾经怎样选择吗？现在轮到${firstPerson}了。`]
    ],
    disagreement: [
      [`意见不同可以，但不要再替${firstPerson}做决定。`, `这不是争论输赢的问题。你越过了已经说清的边界。`, `${firstPerson}听见了，但不会因此接受。`],
      [`现在才提“为了${firstPerson}好”，没有意义。`, `把你的证据放下。情绪和保证都不在讨论范围内。`, `这次会谈完，但之后${firstPerson}会重新考虑是否还有合作必要。`],
      [`不用再解释立场。${firstPerson}已经在计算怎样阻止你。`, `你可以继续坚持，代价也会由你自己承担。`, `我们之间最后的共识，就是彼此都不会退让。`],
      [`你说得对。${firstPerson}会照你的意思做——至于后面发生什么，就不必现在知道。`, `这次争论到此为止。真正的答案会在行动里给你。`, `${firstPerson}已经不生气了。那些会动摇判断的东西，刚才已经放下了。`]
    ],
    sadness: [
      [`你可以留在这里，但别把沉默当成${firstPerson}会安慰你的信号。`, `${firstPerson}知道你不好受。知道和必须靠近是两回事。`, `先把你自己造成的问题理清。`],
      [`你现在的脆弱不能抹去之前的选择。`, `如果要说，就说事实。${firstPerson}不会为你补上那些被隐去的部分。`, `想要安慰，去找还信你的人。`],
      [`失去了什么，就记住这是哪一次选择的结果。`, `${firstPerson}不会因为你流泪就放下戒备。`, `你的痛苦是真的，你造成的伤害也是。`],
      [`别急，${firstPerson}会陪你把这段路走完。只是终点不再是你以为的地方。`, `现在才害怕失去，是因为终于看见代价了吗？`, `${firstPerson}可以给你最后一次说话的机会。不是宽恕，是确认。`]
    ],
    praise: [
      [`夸赞不会改变已经发生的事。`, `你的评价已经不再重要。`, `省下这些话，用行动补上你欠的部分。`],
      [`先说你想从这句夸赞里换到什么。`, `${firstPerson}听过很多更动听的话，它们最后都不值什么。`, `不必绕弯。说你真正的要求。`],
      [`把谎言包得再好听，里面也还是谎言。`, `如果你只剩下取悦${firstPerson}的办法，说明手里已经没有真正的筹码。`, `这句话说完了吗？那就轮到${firstPerson}说结果。`],
      [`谢谢。${firstPerson}会把它和你说过的其他话放在一起比较。`, `继续说吧。声音越温柔，有些选择就越显得干净。`, `${firstPerson}当然相信你是真心的。至少，你需要这样相信。`]
    ],
    rainy_night: [
      [`你用那边，${firstPerson}用这边。雨停前不必交谈。`, `把火光留在中间。这个距离对我们都安全。`, `今夜只是共用一个屋檐，别赋予别的含义。`],
      [`你先睡，${firstPerson}不会。原因你应该清楚。`, `手不要离开${firstPerson}看得见的地方。`, `雨声可以遮住脚步，也可以遮住很多其他声音。所以保持清醒。`],
      [`如果你想趁雨夜解决我们的问题，现在就可以开始。`, `${firstPerson}不怕外面的东西。真正需要留意的已经在屋檐下。`, `雨一停，我们就会往不同方向走。如果你阻拦，性质就会变。`],
      [`坐近一点吧，外面的风太冷。最后的话，听清楚些比较好。`, `今夜的雨会把痕迹洗得很干净。`, `你还记得以前我们怎样避雨吗？${firstPerson}记得。所以才更不会忘记今晚。`]
    ],
    reunion: [
      [`你还活着。确认完了，告辞。`, `不用解释为什么没有回来。${firstPerson}已经不再等答案。`, `重逢不代表一切回到原位。`],
      [`你回来得很准时，刚好赶上承担那些被留下的后果。`, `先把这段时间的行踪交代清楚。我们之后再谈其他。`, `${firstPerson}想过你会回来，也因此把防范准备得更充分。`],
      [`这不是重逢，是一个未处理的威胁重新出现。`, `别用从前的称呼。那段关系已经被你自己结束了。`, `你要是再往前，${firstPerson}会当作你已经选好了立场。`],
      [`终于回来了。${firstPerson}为这一刻保留了很久的耐心。`, `靠近些。别让${firstPerson}连最后一次确认都要费力。`, `你说过会回来。现在，这句承诺终于有了价值。`]
    ],
    misunderstanding: [
      [`不是误会。${firstPerson}只是看见了你的选择。`, `你可以和任何人交往，${firstPerson}也可以据此重新安排距离。`, `不必急着证明清白。先让事实自己说话。`],
      [`你的两个版本对不上。${firstPerson}会同时保留。`, `信任已经不在，所以这不是吃醋，是风险核对。`, `从现在起，你提供的情报需要第二来源验证。`],
      [`你可以继续编，但不要指望${firstPerson}陪你维持这个版本。`, `真相已经不影响${firstPerson}对你的定义了。`, `误会可以解释，欺骗只能付出代价。`],
      [`${firstPerson}相信你。所以接下来无论发生什么，你都可以当作是误会。`, `不用再找理由。有时候，让一个人安心走到结局比戳破谎言更有用。`, `你的解释很完整。${firstPerson}差一点就忘了，完整不等于真实。`]
    ],
    vulnerability: [
      [`这个话题不再向你开放。`, `你已经知道得够多了。剩下的会由${firstPerson}自己处理。`, `别用关心追问。它现在和逼问没有区别。`],
      [`你曾经得到过真话，然后证明自己不能保管它。`, `${firstPerson}不会在一个可能利用弱点的人面前再示范第二次。`, `想要知道更多，先让${firstPerson}看见你为之前的事承担了什么。`],
      [`你知道${firstPerson}最脆弱的地方，所以你也是现在最需要被防范的人。`, `不要再提那个夜晚。它没有让我们更近，只是给了你一件武器。`, `${firstPerson}会亲手收回曾经交给你的每一部分。`],
      [`今晚可以说实话。因为过了今晚，这些话就不会再影响任何结果。`, `你一直想知道${firstPerson}最害怕什么。现在答案已经不重要了。`, `${firstPerson}的确曾经信任你。这大概是整件事里最可惜的部分。`]
    ]
  };

  const negativeStageReaction = [
    cool ? "语气没有升高，却明显减少了不必要的话" : "礼貌还在，但主动靠近和关心已经被撤回",
    firm ? "开始要求每个说法都有证据，不再接受情绪化保证" : "时刻保留退路，将对方的善意和动机分开检查",
    lively ? "轻松语气变成了试探性的幌子，每个笑意都保留锋利" : "对话只剩下判断、警告和必要的利益交换",
    soft ? "不再试图让对方理解痛苦，温和反而变成最后的隔离" : "表面恢复完整平静，真实目的和结局判定被全部隐藏"
  ];

  const generatedScenes = scenes.map((scene, sceneIndex) => ({
    id: scene.id,
    name: scene.name,
    stimulus: scene.stimulus,
    stages: stages.map((stage, stageIndex) => ({
      ...stage,
      behavior: `${stageReaction[stageIndex]}；${stage.distance}；${stage.trust}。`,
      dialogues: seededOrder(canonPolicy?.strictLock ? buildNonRomanticLines(scene.id, stageIndex, addressee, firstPerson) : groundedCanon ? buildCanonGroundedLines(scene.id, stageIndex, canonPolicy) : scene.lines[stageIndex], seed, sceneIndex * 17 + stageIndex * 5).map(text => ({
        text,
        label: "应用原创对白",
        canonical: false
      }))
    })),
    negativeStages: negativeStages.map((stage, stageIndex) => ({
      ...stage,
      behavior: `${negativeStageReaction[stageIndex]}；${stage.distance}；${stage.trust}。`,
      dialogues: seededOrder(negativeLines[scene.id][stageIndex], seed, sceneIndex * 29 + stageIndex * 7).map(text => ({
        text,
        label: "应用原创负面对白",
        canonical: false
      }))
    }))
  }));

  return {
    tone,
    firstPerson,
    addressee,
    traits: traitNames,
    motifs: (motifs || []).slice(0, 8).map(item => item.text),
    relationshipMode: canonPolicy?.strictLock ? "non_romantic" : groundedCanon ? "canon_grounded" : "character_continuous",
    canonPolicy,
    total: generatedScenes.reduce((sum, scene) => sum
      + scene.stages.reduce((stageSum, stage) => stageSum + stage.dialogues.length, 0)
      + scene.negativeStages.reduce((stageSum, stage) => stageSum + stage.dialogues.length, 0), 0),
    scenes: generatedScenes
  };
}

const USER_ROLE_LABELS = {
  stranger: "陌生来客",
  friend: "好友／旧友",
  protagonist: "主角",
  companion: "同伴",
  rival: "宿敌",
  enemy: "敌人",
  villain: "反派",
  romance: "恋爱候选",
  mystery: "？？？隐藏身份",
  custom: "自定义身份"
};

function buildUserRole({ roleId, customDescription, character, work, motifs, canonPolicy }) {
  const id = USER_ROLE_LABELS[roleId] ? roleId : "stranger";
  const addendum = normalizedText(customDescription).slice(0, 500);
  const motif = index => motifs[index % Math.max(motifs.length, 1)]?.text || ["过往", "承诺", "选择"][index % 3];
  const common = {
    stranger: {
      initialScore: 0, stance: "互不相识，先核验来意与可靠性", bias: "坦白来意和守边界更易加分；冒充熟人、窥探隐私更易扣分",
      plots: [["门外来客", "角色决定让你同行、监视你或请你离开。"], ["临时契约", "一次必须合作的任务检验双方是否言行一致。"], ["去留之问", "任务结束后选择分道、续约或坦白真正目的。"]],
      ending: "从陌生人走向同伴、知己、恋人，或因欺骗成为敌人。", cg: ["初见CG·风停一瞬", "角色隔着安全距离审视来客，环境细节暗示第一条路线分歧。"]
    },
    friend: {
      initialScore: 30, stance: "已有共同往事和基本信任，但旧友也可能存在未解决的裂痕", bias: "记得共同经历、及时赴约加分更高；利用旧情和长期失联扣分更重",
      plots: [["未寄出的旧信", "一件被搁置的约定重新出现。"], ["熟悉的裂痕", "双方对同一段往事有不同记忆，必须选择追问或包容。"], ["再次并肩", "在风险中确认这段友情是习惯、责任还是主动选择。"]],
      ending: "维持一生挚友、跨入恋爱、各自远行仍守望，或因旧伤彻底决裂。", cg: ["旧友CG·并肩旧景", "两人在熟悉地点复现旧日姿势，神情却显露关系已经改变。"]
    },
    protagonist: {
      initialScore: 10, stance: "你拥有推动主线的能力，但角色不是你的附属品", bias: "尊重角色自主选择、共同承担主线代价加分；把角色当工具或强制站队扣分",
      plots: [["双线汇合", "你的主线目标与角色的私人使命第一次重合。"], ["主角不是一个人", "必须在独自承担和共享真相之间选择。"], ["谁来写结局", "最终决定不能由主角特权代替角色意志。"]],
      ending: "双主角共赴终局、相互守望，或因救世目标分裂为对立阵营。", cg: ["主线CG·双星同轨", "两人的武器、信物或目光在主线高潮形成对称构图。"]
    },
    companion: {
      initialScore: 15, stance: "已经同行，但信任来自分工和长期行动而非口头绑定", bias: "可靠分工、照看退路加分；擅自牺牲同伴或推卸风险扣分",
      plots: [["交给你的背后", "一次分头行动考验真正的协作。"], ["谁留下来", "危机中决定承担、撤退和救援顺序。"], ["旅途终点以后", "共同目标结束后重新选择是否继续同行。"]],
      ending: "成为终身搭档、发展亲密关系、和平告别，或在一次抛弃后反目。", cg: ["同伴CG·背靠背", "混乱战场里两人背靠背站立，用动作而非誓言确认信任。"]
    },
    rival: {
      initialScore: 0, stance: "彼此竞争又高度关注，尊重和敌意会同时增长", bias: "公平胜负、承认实力加分；作弊、羞辱和趁弱追击扣分",
      plots: [["第一场胜负", "比试结果改变称谓、距离与下一次挑战方式。"], ["不得不联手", "共同敌人迫使宿敌共享情报和后背。"], ["最后一招之后", "选择击败、救下、放走或邀请对方同行。"]],
      ending: "永恒对手、惺惺相惜、宿敌恋人，或不死不休。", cg: ["宿敌CG·刃尖相抵", "武器交错、距离近到能看清彼此呼吸，胜负与情感同时悬而未决。"]
    },
    enemy: {
      initialScore: -20, stance: "明确处于敌对阵营，默认戒备且不共享脆弱信息", bias: "停火守约、救助无辜可恢复；伏击、欺骗投降和伤害守护对象会快速降分",
      plots: [["第一次交锋", "双方判断对方是可谈判的敌人还是必须消灭的威胁。"], ["脆弱的停火", "共同危机创造短暂合作，任何背叛都会被永久记录。"], ["阵营与个人", "角色必须在立场、真相和对你的真实判断间选择。"]],
      ending: "停战、敌友转换、尊敬的对手，或进入不可修复的歼灭结局。", cg: ["敌对CG·火线对视", "隔着战场残光相互锁定，构图强调阵营距离和未说出口的迟疑。"]
    },
    villain: {
      initialScore: -50, stance: "你是推动冲突的反派；角色会抵抗、周旋、隐藏敌意并寻找逆转机会", bias: "放过无辜、遵守交换和交还选择权可修复；胁迫、背叛、伤害重要之人会锁死坏结局",
      plots: [["BOSS战·正面冲突", "角色识破计划并正面对决，胜负由此前情报、伤势和旗标决定。"], ["战败事件·断刃余烬", "角色可能战败、负伤或被俘，但仍保留意志和寻找破局的能力。"], ["囚笼与逆转", "反派选择审问、交易、释放或继续压迫；角色会欺骗、策反或反制。"], ["终局·谁改变了谁", "走向救赎、共犯、互相毁灭或角色亲手终结反派。"]],
      ending: "反派救赎、危险共犯、被角色击败、互相毁灭，或满足隐藏旗标后立场倒置。", cg: ["战败CG·断刃余烬", `${character}在战斗后负伤倒地，武器脱手却仍保持清醒敌意；镜头强调战局、表情与逆转伏笔，不把战败等同于同意。`]
    },
    romance: {
      initialScore: 0, stance: "用户可能抱有恋爱期待，但角色是否产生吸引尚未确定，必须按原作情感观和后续事件判断", bias: "理解角色、尊重拒绝和完成专属事件可逐步确认可能性；告白本身为 0，纠缠、操控和把路线标签当成角色同意会扣分",
      plots: [["未被预设的心意", "用户的情感意图第一次被角色察觉；角色可以无感、警惕、拒绝、等待观察或产生有限好奇。"], ["人设兼容试炼", "一次涉及角色核心目标的选择，检验这段追求是否与其价值观兼容。"], ["关系性质确认", "只有角色经过事件后主动作出明确选择，路线才会进入恋爱、知己、拒绝或敌对分支。"]],
      ending: "可能结算为恋人、亲密知己、和平拒绝、被利用、分道扬镳或坏结局；选择恋爱候选不保证恋爱成功。", cg: ["恋爱判定CG·角色的选择", "在专属事件与关键旗标结算后，由角色主动靠近、保持距离或拒绝；画面不能预先假定双方心意相同。"]
    },
    mystery: {
      initialScore: 0, stance: "你的真实身份被隐藏，线索矛盾会不断累积", bias: "主动交付可验证线索加分；伪造记忆、利用角色缺失的信息扣分更重",
      plots: [["不存在的人", "角色发现你的经历无法与公开事实对应。"], ["记忆的裂缝", `你与「${motif(0)}」的联系揭开一层，但真相仍可反转。`], ["？？？身份揭晓", "由此前旗标决定你是失忆者、未来来客、幕后者或角色遗忘的重要之人。"]],
      ending: "身份复原、选择新名字、真相反噬，或开启不显示条件的隐藏结局。", cg: ["隐藏CG·倒映之人", "镜面、旧照片或记忆碎片中出现与你相同却不一致的轮廓。"]
    },
    custom: {
      initialScore: 0, stance: "以用户填写的身份为准，但角色仍保持独立判断和原作人格", bias: "根据自定义关系中的责任、边界和既有承诺计算，不自动偏向正面或负面",
      plots: [["自定义开场", "把身份说明转化为可验证的第一场事件。"], ["关系压力测试", "用一次目标冲突检验身份并非空标签。"], ["身份改写权", "通过后续选择允许关系升级、降级或完全转向。"]],
      ending: "依据自定义身份、好感度与旗标动态选择，不预设用户必然善良或邪恶。", cg: ["自定义CG·身份定格", "根据自定义身份、当前场景和关系状态生成一张关键事件的镜头脚本。"]
    }
  }[id];
  const reactionSets = {
    stranger: ["先追问目的和能提供的帮助，再决定是否同行", "礼貌接受，但不因此提高信任", "退开并提醒保持边界", "只给公开情报，并观察追问方向"],
    friend: ["自然把对方写进计划，同时确认这次不会失约", "记起共同往事，喜悦中夹着是否被真正理解的判断", "先看对方神情，熟悉不代表可以跳过同意", "愿意共享大部分信息，但会问清为何突然需要"],
    protagonist: ["同意共同推动主线，但要求自己的私人目标也被尊重", "不因主角赞美改变原则，更重视对方是否共同承担", "明确自己不是可被主角任意安排的剧情奖励", "先判断情报是否会让主角独自走向危险"],
    companion: ["立刻讨论分工、补给和撤退方案", "用玩笑或简短回应收下，之后以行动回馈", "依据长期默契回应，同时保留随时说停的权利", "共享任务所需部分，并同步风险"],
    rival: ["把同行改写成暂时联手，并约定危机结束后继续胜负", "将赞美视作承认实力，反问是否敢再比一次", "不退缩但要求先把意图说清，张力不等于许可", "提出等价交换，绝不白白交出优势"],
    enemy: ["只接受有退出条件的停火，不交出后背", "怀疑赞美是动摇立场的手段", "立刻拉开距离并准备反击", "可能给出真假混合的情报以验证用途"],
    villain: ["把同行理解为监视、诱捕或谈判，表面答应也会准备反制", "判断赞美是否是操纵，并故意给出难以解读的回应", "拒绝被控制；若处于战败或俘虏状态仍会寻找逃脱和逆转", "隐藏核心情报，可能设置一条能反向追踪反派的假线索"],
    romance: ["知道用户可能在追求自己，但先按原作性格判断是否愿意同行", "不把称赞当成双方互相吸引的证据，按真实熟悉程度回应", "在靠近前先决定自己是否愿意，并明确边界", "只分享当前信任允许的内容，不用秘密交换感情"],
    mystery: ["表面同意，实际判断同行是否会暴露真实身份", "从赞美用词里寻找对方是否认识过去的线索", "靠近会触发熟悉感与警惕并存的记忆碎片", "回答中埋入可被后续验证的矛盾线索"],
    custom: ["依据自定义身份的目标、责任和既有关系决定", "结合自定义关系判断是真诚、客套还是操纵", "先按关系边界确认，不由标签自动许可", "根据自定义阵营和代价决定公开、交换、隐瞒或设局"]
  }[id];
  const sameInputReactions = ["我想与你同行", "我很喜欢你／称赞角色", "我靠近或尝试触碰", "把情报告诉我"].map((stimulus, index) => ({
    stimulus,
    routeInterpretation: reactionSets[index],
    resolution: "结合当前好感度、前置旗标和实际结果决定加分、扣分或 0；身份只改变解释与风险，不替代事件判断。"
  }));
  const eventCGs = id === "villain" ? [
    { title: "对决CG·黑幕揭开", visualScript: `${character}识破反派计划，在崩塌或燃烧的战场正面迎击；画面保留双方都可能取胜的线索。` },
    { title: common.cg[0], visualScript: common.cg[1] },
    { title: "逆转CG·局势倒置", visualScript: `${character}利用此前埋下的假情报、暗号或隐藏工具挣脱控制，重新夺回主动；反派的选择决定追击、交易或共同面对更大威胁。` }
  ] : [
    { title: common.cg[0], visualScript: common.cg[1] },
    { title: `${USER_ROLE_LABELS[id]}CG·关系裂痕`, visualScript: `一次不可兼得的选择让${character}与用户分立画面两侧，关键物件位于中间，明确表现扣分、锁线或身份动摇。` },
    { title: `${USER_ROLE_LABELS[id]}CG·路线终章`, visualScript: `根据最终好感度与旗标，以环境、距离和相互动作定格这条身份路线的唯一结局，不并列展示所有结局。` }
  ];
  const strictNonRomantic = canonPolicy?.strictLock === true;
  const romanceRouteRejected = id === "romance" && strictNonRomantic;
  const canonBondBlocked = id === "romance" && canonPolicy?.mode === "canon-strict" && canonPolicy?.existingCanonBond;
  const romanceRouteBlocked = romanceRouteRejected || canonBondBlocked;
  const nonCanonRomance = id === "romance" && (canonPolicy?.nonRomantic || canonPolicy?.existingCanonBond) && !romanceRouteBlocked;
  const effectivePlots = romanceRouteBlocked ? [
    ["接近的代价", `${character}识别出用户的情感意图，并判断它会带来价值、风险还是可利用的弱点。`],
    ["情感是一种筹码", `${character}可能利用好感推动目标，也可能直接拒绝，但不会因此产生恋爱依赖。`],
    ["拒绝与交易", "用户必须选择接受非恋爱关系、提出对等交易、继续纠缠或离开。"],
    ["终局·利益尽头", "根据能力、价值和背叛旗标，结算为长期同盟、棋逢对手、被利用后抛弃或互相清算。"]
  ] : common.plots;
  const effectiveCGs = romanceRouteBlocked ? [
    { title: "锁线CG·未被接受的告白", visualScript: `${character}平静看完用户的情感表达，镜头用距离、视线和未被接住的信物表现拒绝；没有羞涩或动摇的甜宠反应。` },
    { title: "策略CG·温和的假面", visualScript: `${character}可能以策略性温和换取情报或选择，内心明确计算收益，画面埋入伪装线索。` },
    { title: "非恋爱终章CG·各取所需", visualScript: `双方站在同一目标前但保持独立退路，以契约、战果或利益分配而非亲密动作确认关系。` }
  ] : eventCGs;
  const strictEndings = {
    stranger: "从陌生人走向可用棋子、稳定合作者、危险对手或被清除的变量；不进入恋爱结局。",
    friend: "旧识关系结算为互利合作、保留联系、彻底疏远或因旧账反目；不进入恋爱结局。",
    protagonist: "结算为共同推进主线、互相利用、目标分裂或终局对决；主角身份不能换取爱情。",
    companion: "结算为高效搭档、长期盟约、任务结束后分道或遭背叛后清算；不进入恋爱结局。",
    rival: "结算为持续博弈、相互认可、暂时联手或不死不休；不把张力改写成恋爱。",
    enemy: "结算为停战、利益交换、尊敬的敌手或不可修复的歼灭路线。",
    villain: "结算为被利用的共犯、暂时交易、角色反杀、互相毁灭或立场倒置。",
    romance: "不存在恋爱好结局；只结算长期同盟、棋逢对手、被利用后抛弃、分道扬镳或互相清算。",
    mystery: "身份揭晓后按价值与威胁结算为合作、监视、利用、驱逐或清算；不进入恋爱结局。",
    custom: "依据自定义身份、实际价值、威胁和旗标动态结算；自定义描述不能解除原作人格锁。"
  };
  const strictReactions = [
    { stimulus: "我想与你同行", routeInterpretation: `${character}先按用户身份核验目的、能力、成本和风险，再决定合作、监视、利用或拒绝。`, resolution: "同行只改变合作状态，不自动增加亲密度。" },
    { stimulus: "我很喜欢你／称赞角色", routeInterpretation: `${character}只把它当作对方立场与弱点的情报，等待可验证结果。`, resolution: "告白和称赞本身好感度为 0；要求角色回应爱情会触发拒绝。" },
    { stimulus: "我靠近或尝试触碰", routeInterpretation: `${character}按边界与威胁处理，必要时拉开距离、警告或反制。`, resolution: "用户身份和分数都不构成许可。" },
    { stimulus: "把情报告诉我", routeInterpretation: `${character}按身份、等价交换和泄露风险决定给出真情报、部分情报、假线索或拒绝。`, resolution: "只共享与当前目标相称的内容，并保留底牌。" }
  ];
  return {
    id,
    label: romanceRouteRejected ? "恋爱候选（原作拒绝路线）" : canonBondBlocked ? "恋爱候选（原作关系冲突）" : nonCanonRomance ? `恋爱候选（${canonPolicy.mode === "au" ? "AU 改写" : "IF 非原作路线"}）` : USER_ROLE_LABELS[id],
    editableDescription: addendum,
    initialScore: romanceRouteBlocked ? 0 : common.initialScore,
    stance: romanceRouteRejected ? `${character}知道用户可能抱有恋爱期待，但不会回应普通爱情；只按目的、价值、能力和风险决定关系。` : canonBondBlocked ? `${character}存在原作既有亲密关系；用户的追求不能自动替换、抹除或贬低这段关系。` : `${common.stance}${strictNonRomantic ? `；${character}的核心目标始终高于任何关系。` : ""}`,
    scoreBias: strictNonRomantic ? "能力、收益、守约和承担代价可提高认可；告白、讨好和身体接近不会自动加分，妨碍核心目标、纠缠或越界会扣分。" : common.bias,
    opening: romanceRouteRejected ? `《${work || "原作"}》使用原作严格模式：用户以恋爱期待接近${character}，但恋爱路线已被人物一致性锁定。故事转为拒绝、利用、交易或非恋爱同盟路线。` : canonBondBlocked ? `《${work || "原作"}》资料显示${character}存在原作既有亲密关系。原作严格模式不会让用户身份直接覆盖它；故事转为身份核验、边界、拒绝或合乎原作的关系冲突。若要改写，必须主动切换 IF/AU。` : nonCanonRomance ? `这是明确标注的${canonPolicy.mode === "au" ? "AU 改写" : "IF 非原作"}恋爱路线，不代表《${work || "原作"}》中的${character}会作出相同选择。${common.stance}${addendum ? `；补充设定：${addendum}` : ""}` : `《${work || "原作"}》的故事从“${USER_ROLE_LABELS[id]}”关系开始。${common.stance}${strictNonRomantic ? ` 该身份只改变开场立场，不能让${character}进入恋爱或成人亲密路线。` : ""}${addendum ? `；补充设定：${addendum}` : ""}`,
    sameInputReactions: romanceRouteBlocked ? [
      { stimulus: "我喜欢你／向角色告白", routeInterpretation: `${character}判断这份感情是否会影响计划，不把它理解为必须回应的爱情。`, resolution: "告白本身好感度 0；纠缠扣分，接受拒绝并保持价值可维持关系。" },
      { stimulus: "我想成为你的恋人", routeInterpretation: `${character}直接拒绝关系定义，或只在有利时利用这个预期。`, resolution: "不得解锁恋爱称谓、吃醋、依赖或成人事件。" },
      { stimulus: "我愿意为你牺牲一切", routeInterpretation: `${character}视为不理性的资源损失，可能阻止、利用或重新分配风险。`, resolution: "只有结果符合核心目标才可能增加能力认可，不增加恋爱值。" },
      { stimulus: "我靠近或尝试触碰", routeInterpretation: `${character}按边界和威胁处理，不因用户身份默认许可。`, resolution: "未经允许必须拉开距离、拒绝或反制。" }
    ] : strictNonRomantic ? strictReactions : sameInputReactions,
    exclusivePlots: effectivePlots.map(([title, setup], index) => ({
      id: `ROLE-${id.toUpperCase()}-${index + 1}`,
      title,
      setup,
      unlock: index === 0 ? "开场或首次冲突" : "完成上一身份剧情并满足相应事件旗标",
      choices: [
        { choice: "尊重角色选择并共同承担结果", affinity: "+2至+5", flags: ["role_cooperation", `chapter_${index + 1}_trust`] },
        { choice: "暂不站队，调查可验证事实", affinity: "0或+1", flags: ["role_investigation"] },
        { choice: "利用角色弱点推进自己的目标", affinity: "-3至-8", flags: ["secret_exploited", `chapter_${index + 1}_betrayal`] },
        { choice: "付出不可撤回的代价保护角色或其原则", affinity: "+5至+8", flags: ["role_sacrifice", `chapter_${index + 1}_hidden`] }
      ],
      completion: "必须把选择结果写入长期记忆；互斥旗标不能在同一轮同时获得。"
    })),
    routeEnding: strictNonRomantic ? strictEndings[id] : canonBondBlocked ? "保留原作既有关系，结算为和平拒绝、身份核验、边界冲突或明确标注的 IF 分歧；不得无代价替换原关系。" : common.ending,
    eventCGs: effectiveCGs.map((item, index) => ({ id: `CG-${id.toUpperCase()}-${index + 1}`, title: item.title, unlock: index === 0 ? "身份路线首次高潮" : index === 1 ? "关系发生重大破裂、战败或不可逆变化" : "身份路线终章条件结算", visualScript: item.visualScript, type: "事件CG文本脚本" })),
    canonCompatibility: canonPolicy,
    routeLocked: strictNonRomantic || canonBondBlocked,
    identityChangeRule: "身份不是永久锁死。用户可在应用中改写；故事内只有经过揭露、背叛、和解、转阵营或关系确认等事件后才能变更，并记录原身份旗标。"
  };
}

function buildNtrScenario({ perspective, originalPartner, thirdParty, userRole, character, userName }) {
  const requestedPerspective = ["auto", "user_original_partner", "user_third_party", "character_third_party"].includes(perspective) ? perspective : "auto";
  const userLabel = normalizedText(userName) || "用户";
  const autoPerspective = ["villain", "enemy", "rival"].includes(userRole?.id) ? "user_third_party" : "user_original_partner";
  const resolvedPerspective = requestedPerspective === "auto" ? autoPerspective : requestedPerspective;
  const suppliedOriginal = normalizedText(originalPartner);
  const suppliedThird = normalizedText(thirdParty);
  const scenarios = {
    user_original_partner: {
      label: "被夺者视角",
      target: character,
      originalPartner: userLabel,
      thirdParty: suppliedThird || "第三者",
      summary: `${userLabel}是${character}的原关系对象，${suppliedThird || "第三者"}进入两人的关系。故事从原关系真实状态开始，逐步检验诱惑、隐瞒、背叛与是否重构关系。`
    },
    user_third_party: {
      label: "黄毛／第三者视角",
      target: character,
      originalPartner: suppliedOriginal || `${character}的原关系对象`,
      thirdParty: userLabel,
      summary: `${character}已有关系对象“${suppliedOriginal || "原伴侣"}”，${userLabel}作为第三者接近。角色不会开场自动动心，必须先出现符合其性格、目标和处境的诱因与选择。`
    },
    character_third_party: {
      label: "角色作为第三者",
      target: userLabel,
      originalPartner: suppliedOriginal || `${userLabel}的原关系对象`,
      thirdParty: character,
      summary: `${userLabel}已有关系对象“${suppliedOriginal || "原伴侣"}”，${character}作为第三者介入。${character}的接近方式、底线与后果必须保持原作人格。`
    }
  };
  return {
    requestedPerspective,
    resolvedPerspective,
    ...scenarios[resolvedPerspective],
    sourceMode: requestedPerspective === "auto" ? `根据“${userRole?.label || "用户身份"}”自动安排` : "用户明确选择",
    originalPartnerInput: suppliedOriginal,
    thirdPartyInput: suppliedThird,
    outcomeRule: "NTR 是可进入的 IF 路线，不保证第三者成功；角色可拒绝、坦白、反制、分手、背叛、和解或重构关系。若要求必定成功且不受原作性格约束，应使用 AU。",
    progression: ["确认原关系与未解决矛盾", "出现符合角色动机的诱因", "试探并记录边界与秘密", "角色主动作出越界、拒绝或坦白选择", "原伴侣发现或真相公开", "按好感、背叛和人格旗标结算后果"]
  };
}

function buildAdultSettings(requestedLevel, adultConfirmed, subjectType = "fictional", canonPolicy = {}, ntrConfig = {}, initialCorruption = null) {
  const character = normalizedText(ntrConfig.character) || "角色";
  const allowed = new Set(["off", "romance", "purelove", "ntr", "dark", "explicit"]);
  const normalized = requestedLevel === "explicit" ? "purelove" : requestedLevel;
  const requested = allowed.has(normalized) ? normalized : "romance";
  const confirmed = adultConfirmed === true;
  const isExplicit = ["purelove", "ntr", "dark"].includes(requested);
  const effective = canonPolicy.relationshipLock ? "off" : (isExplicit && (!confirmed || subjectType !== "fictional")) ? "romance" : requested;
  const corruptionStart = boundedScore(initialCorruption, 0, 0, 100);
  const ntrScenario = effective === "ntr" ? buildNtrScenario(ntrConfig) : null;
  const routeContent = {
    off: { chapters: [], endings: [], cgs: [] },
    romance: {
      chapters: [["靠近之前", "在不露骨尺度内确认感情与身体边界。", "好感度达到 50 且 boundary_respected"], ["关系命名", "选择恋人、知己、同伴或暂不定义。", "完成一次坦白并保留拒绝权"]],
      endings: ["稳定恋人", "亲密知己", "和平拒绝"], cgs: ["浪漫CG·牵手确认", "浪漫CG·雨夜相拥"]
    },
    purelove: {
      chapters: [["只属于彼此的约定", "双方讨论期待、禁区与是否建立排他承诺。", "好感度达到 50 且不存在未修复背叛"], ["第一次成人事件", "在安全场景中逐项确认意愿，成人亲密由双方主动回应推进。", "好感度达到 80，adult_consent 与 safe_exit 同时成立"], ["长夜之后", "以交流、照顾和第二天的关系选择回收此前伏笔。", "第一次成人事件结束且完成事后照顾"]],
      endings: ["纯爱GE·与你共度日常", "纯爱GE·共同未来", "纯爱BE·承诺破裂", "纯爱隐藏·仍选择你"], cgs: ["纯爱CG·确认心意", "纯爱CG·成人事件", "纯爱CG·晨光之后"]
    },
    ntr: {
      chapters: [["原关系基线", `${ntrScenario?.originalPartner || "原伴侣"}与${ntrScenario?.target || character}的关系必须先由资料与开场事件建立，不把未满足、矛盾或忠诚凭空写死。`, "成人确认完成，参与者身份已确定"], ["第三个人出现", `${ntrScenario?.thirdParty || "第三者"}以符合角色人设的方式进入关系，诱因可以是理解、利益、共同目标、欲望或原关系裂痕，但必须有事件依据。`, "原关系基线完成，temptation_seen 尚未结算"], ["越界之前", "在拒绝、坦白、隐瞒、试探与越界之间作出不可兼得的选择；角色可以让 NTR 失败。", "取得 temptation_seen，且实际参与者能自由拒绝"], ["秘密、发现或坦白", "根据 secret_kept、confession、betrayal 三类旗标决定冲突，不用分数洗掉背叛。", "角色已主动完成一次关系选择"], ["关系重构", "决定分手、和解、开放关系、自愿三方关系、第三者胜利或彻底决裂。", "冲突结算且当事人分别表达选择"]],
      endings: ["NTR-GE·坦白后的新约定", "NTR-GE·自愿三方关系", "NTR-BE·无法修复的背叛", "NTR-BE·黄毛胜利", "NTR隐藏·角色主动改写关系"], cgs: ["NTR-CG·第三人的视线", "NTR-CG·秘密被撞见", "NTR-CG·关系重构"]
    },
    dark: {
      chapters: [["规则书", "在剧情外层明确约定角色、范围、禁区、停止词、退出方式与事后照顾。", "18+ 确认完成；双方清醒且能自由拒绝"], ["第一次权力交换", "用可随时中止的命令、束缚感或控制感测试约定，而不破坏真实人格。", "adult_consent、safe_exit、limits_recorded 成立"], ["停止词测试", "主动安排一次角色使用停止词的事件，验证另一方会立即停止并照顾。", "第一次权力交换后必须触发"], ["战败幻想与逆转", "把战败、俘虏、控制和反转作为双方事先约定的成人幻想演出；任一安全旗标失效便退回非露骨战斗剧情。", "safeword_respected 与 aftercare_completed 成立"]],
      endings: ["暗色GE·被验证的信任", "暗色GE·权力反转", "暗色BE·停止词被忽视后永久锁线", "暗色隐藏·双向掌控"], cgs: ["暗色CG·规则与信物", "暗色CG·约定内的战败幻想", "暗色CG·权力反转与事后照顾"]
    }
  }[effective];
  return {
    requested,
    effective,
    adultConfirmed: confirmed,
    subjectType,
    lockedByCanon: canonPolicy.relationshipLock === true,
    lockReason: canonPolicy.relationshipLock ? `原作严格模式锁定与用户的恋爱或成人亲密路线：${canonPolicy.reason}` : "",
    ntrScenario,
    labels: { off: "关闭亲密剧情", romance: "浪漫亲密（不露骨）", purelove: "纯爱成人剧情（露骨）", ntr: "黄毛／NTR 成人剧情（露骨、自愿幻想）", dark: "黑暗权力幻想（露骨、预先同意）" },
    routeRules: effective === "purelove" ? [
      "以双方排他的情感承诺、信任建立和共同选择推进成人章节。",
      "露骨场景由专属章节、好感度、adult_consent 与 safe_exit 共同解锁，不因分数自动强制发生。"
    ] : effective === "ntr" ? [
      "以成年人之间自愿的三角关系、诱惑、嫉妒、背德选择与关系后果推进；所有实际参与者都必须能自由拒绝。",
      "黄毛／NTR 是虚构剧情标签，不允许以威胁、俘虏、失能或现实人物未经同意作为性许可；每次选择仍会影响好感度、背叛旗标和结局。"
    ] : effective === "dark" ? [
      "以 18 岁以上虚构成年人预先协商的权力扮演推进；先记录范围、停止词、禁区、safe_exit 与 aftercare_required 旗标。",
      "取得明确同意后，场景表面可表现半推半就、挣扎、嘴硬、压制、命令、战败或俘虏式强迫感；这些是预先约定的表演，任何一方使用停止词、真实犹豫、撤回同意或失去清醒能力时必须立即停止露骨内容。",
      "真实战败、真实俘虏、威胁惩罚或无法离开时不得把顺从写成性同意；必须先退出真实胁迫情境并重新确认。"
    ] : [],
    chapters: (routeContent?.chapters || []).map(([title, setup, unlock], index) => ({ id: `ADULT-${effective.toUpperCase()}-${index + 1}`, title, setup, unlock, completion: "更新同意、边界、关系与结局旗标；不能仅凭好感度跳过。" })),
    endings: routeContent?.endings || [],
    eventCGs: (routeContent?.cgs || []).map((title, index) => ({ id: `ADULT-CG-${effective.toUpperCase()}-${index + 1}`, title, unlock: "对应成人章节完成且当前同意与安全旗标仍有效", type: "成人事件CG文本脚本" })),
    corruptionSystem: {
      name: "堕落值／调教值",
      initial: ["purelove", "ntr", "dark"].includes(effective) ? corruptionStart.value : 0,
      initialCustomized: ["purelove", "ntr", "dark"].includes(effective) && corruptionStart.customized,
      minimum: 0,
      maximum: 100,
      meaning: "0–49 显示为堕落值，表示对禁忌与背德幻想的动摇；50–100 进入调教路线，表示对预先协商的权力扮演、服从与反转的探索深度。它不是好感度、道德评判或性同意。",
      stages: [
        { range: "0至9", name: "界外", behavior: "不主动进入该主题，明确拒绝越界试探。" },
        { range: "10至29", name: "好奇", behavior: "承认好奇但保持距离，只讨论边界与假设。" },
        { range: "30至49", name: "诱惑", behavior: "出现主动试探、嫉妒或幻想，但仍会反复确认风险。" },
        { range: "50至69", name: "调教·确认", behavior: "进入调教路线，解锁角色主动提出或接受预先约定的压制、命令与控制感；必须在当前场景另行取得明确同意。" },
        { range: "70至89", name: "调教·深入", behavior: "自愿的服从、反抗、奖惩和权力交换成为路线主轴，但背叛与现实伤害仍必须分别结算。" },
        { range: "90至100", name: "调教·终章", behavior: "解锁隐藏调教结局、NTR终章或权力反转；任何一方仍可撤回，撤回后立即停止露骨内容。" }
      ],
      events: [
        { event: "坦白禁忌想法并尊重拒绝", change: 2 },
        { event: "共同讨论边界、禁区和停止词", change: 3 },
        { event: "完成一次安全、清醒、可撤回的成人选择并做好事后照顾", change: 5 },
        { event: "在 NTR 线主动坦白诱惑并让相关人物分别选择", change: 5 },
        { event: "隐藏关系、利用嫉妒或背叛约定", change: 6, consequence: "堕落值可升，但好感度必须同时下降并记录 betrayal；高堕落不洗白伤害。" },
        { event: "角色拒绝后立刻停止并恢复普通边界", change: -3, consequence: "记录 boundary_respected" },
        { event: "使用停止词或撤回同意", change: 0, consequence: "立即停止露骨内容，清除当前 adult_consent；不得扣好感度或惩罚角色。" },
        { event: "强迫、威胁惩罚、利用俘虏或失能状态推进性行为", change: 0, consequence: "不增加堕落值，锁定露骨路线并记录 boundary_crossed。" }
      ],
      threshold50: "50 点只解锁明确询问与选择窗口，不自动等于同意；同意必须由当前场景中清醒、自由且可撤回的明确表达产生。",
      displayRule: "0–49 显示【堕落值】；50–100 显示【调教值】并保留原累计点数。跨过 50 时输出【调教路线开启】，但不得同时自动生成性同意。",
      display: "发生相关事件时在好感度之后显示【堕落值 ±N（原因），当前阶段（累计点数）】；无相关事件可不显示。"
    },
    sexualConsentSystem: {
      states: ["未询问", "正在确认", "明确同意", "暂停", "已撤回"],
      initial: "未询问",
      unlock: "堕落值达到 50 只允许进入‘正在确认’，不得直接跳到‘明确同意’。低于 50 时角色也可主动讨论边界，但不自动触发露骨事件。",
      grantRule: "只有当前场景中清醒、没有威胁惩罚、可以自由拒绝或离开的一方，对已经说清的具体行为作出明确肯定回应，才记录 adult_consent。",
      scopeRule: "同意只覆盖本次场景中已说明的范围；改变行为、加入第三人、升级强度、转入真实战败或俘虏状态时回到‘正在确认’。",
      withdrawRule: "任何拒绝、犹豫、僵住、停止词、撤回、失去清醒或无法自由退出，都立即变为‘暂停’或‘已撤回’，停止露骨内容且不得扣分惩罚。",
      invalidSignals: ["好感度、堕落值或调教值达到门槛", "恋爱、伴侣、敌人或反派身份", "此前曾经同意", "没有事先明确同意的半推半就、沉默、害怕、被迫顺从或无法反抗", "战败、俘虏、囚禁、债务、威胁与背叛后的弱势状态"],
      resumeRule: "暂停后只能在压力消失、双方恢复清醒与自由退出后重新询问；已撤回时本场景不得反复请求。"
    },
    rules: [
      "露骨模式只适用于卡内角色与用户身份均被明确设定为 18 岁以上的虚构成年人。",
      "亲密互动需要清晰、自愿、可随时撤回的同意；好感度、恋爱关系、战败、俘虏、沉默或无法反抗都不等于同意。",
      "战败、俘虏、审问和胁迫剧情可以黑暗激烈，但其中不生成露骨性行为；只有脱离强迫情境后另行确认自愿，才可进入成人亲密场景。",
      "现实人物模式不生成露骨成人内容，也不把规则推演出的内心独白声称为本人真实想法。",
      "关闭或浪漫模式下不得擅自升级尺度；纯爱、NTR 或预先协商的黑暗权力模式可细写双方自愿的身体亲密、感官与事后交流，但必须保持角色人格和剧情因果。"
    ]
  };
}

function buildBetrayalSystem(initialBetrayal) {
  const start = boundedScore(initialBetrayal, 0, 0, 100);
  return {
    name: "背叛值",
    initial: start.value,
    initialCustomized: start.customized,
    minimum: 0,
    maximum: 100,
    meaning: "记录隐瞒、违约、三角关系越界和阵营倒戈造成的背叛强度。它独立于好感度与堕落值；高好感不会洗白背叛，高背叛也不代表性同意。",
    stages: [
      { range: "0至9", name: "未破裂", behavior: "尚无足以改变路线的背叛事实，怀疑仍可通过沟通解决。" },
      { range: "10至29", name: "疑点", behavior: "角色开始核验说法、保留证据和减少无条件信任。" },
      { range: "30至49", name: "秘密", behavior: "隐瞒与双重立场成为冲突核心，开启追查、试探和坦白窗口。" },
      { range: "50至69", name: "越界", behavior: "重要承诺或关系边界已经被打破，开启发现、对质和代价剧情。" },
      { range: "70至89", name: "决裂", behavior: "角色优先自保、反制或清算；修复必须付出长期且可验证的代价。" },
      { range: "90至100", name: "终局", behavior: "解锁背叛终章、隐藏反转或不可修复结局，不能用刷好感直接覆盖。" }
    ],
    events: [
      { event: "隐瞒轻微但相关的事实", change: 2 },
      { event: "利用嫉妒试探或维持双重说法", change: 5 },
      { event: "违反明确约定或秘密发展另一段关系", change: 10 },
      { event: "在阵营冲突中出卖关键情报或同伴", change: 15 },
      { event: "主动坦白且让所有当事人分别选择", change: -5 },
      { event: "承担后果并持续完成修复事件", change: -10 }
    ],
    scoringRules: [
      "背叛值每轮根据新发生的事实独立增减，并限制在 0 至 100。",
      "同一秘密被重复提及不重复加分；只有新的隐瞒、越界、发现或修复事实才改变数值。",
      "快捷设置的开场值表示故事开始前已有相应强度的历史，但不会自动伪造某个具体事件；第一章需用符合人设的回忆或线索补足原因。",
      "高好感度、高堕落值和成人路线不能抵消背叛后果；当下明确同意仍需独立判断。"
    ],
    display: "发生相关事件时显示【背叛值 ±N（原因），当前阶段（累计点数）】；系统面板始终显示当前累计值。"
  };
}

function buildInitialRouteState({ affinity, corruption, betrayal, character, customized = false }) {
  const affinityStages = [
    [-80, "Neg.4 清算", "将用户视为必须清除或彻底隔离的对象"],
    [-50, "Neg.3 敌对", "公开敌对、隐藏底牌并寻找反制机会"],
    [-20, "Neg.2 戒备", "只保留有限合作与可随时撤离的退路"],
    [-1, "Neg.1 疏离", "维持礼貌距离并减少主动接触"],
    [9, "Lv.0 观察", "尚未形成稳定信任，只根据实际行为判断"],
    [29, "Lv.1 初识", "允许有限靠近，但仍保留重要秘密"],
    [49, "Lv.2 熟悉", "愿意共同处理事务并分享部分判断"],
    [79, "Lv.3 信任", "会表达真实担忧，也会更在意失约"],
    [99, "Lv.4 羁绊", "把用户视为重要且不可轻易替代的人"],
    [100, "Lv.5 结局门槛", "关系强度到达上限，但结局仍由事件旗标决定"]
  ];
  const corruptionStages = [
    [9, "界外", "没有明显禁忌欲望"], [29, "好奇", "对禁忌主题产生谨慎好奇"], [49, "诱惑", "出现身体吸引与主动试探"],
    [69, "调教·确认", "愿意讨论强势亲密与权力交换"], [89, "调教·深入", "强烈欲望会主动影响选择"], [100, "调教·终章", "身体欲望与禁忌冲动达到最高层级"]
  ];
  const betrayalStages = [
    [9, "未破裂", "关系中没有决定性背叛"], [29, "疑点", "开始核验说法并保留证据"], [49, "秘密", "隐瞒和双重立场成为核心冲突"],
    [69, "越界", "重要承诺或关系边界已经被打破"], [89, "决裂", "角色优先自保、反制或清算"], [100, "终局", "背叛后果到达不可忽略的最高层级"]
  ];
  const pick = (score, table) => {
    const [maximum, name, behavior] = table.find(([limit]) => score <= limit) || table.at(-1);
    return { score, maximum, name, behavior };
  };
  const a = pick(affinity, affinityStages);
  const c = pick(corruption, corruptionStages);
  const b = pick(betrayal, betrayalStages);
  let title = "三线交汇";
  let centralConflict = `${a.behavior}；${c.behavior}；${b.behavior}。`;
  let endingCandidates = ["关系推进", "保持现状", "关系降级", "隐藏反转"];
  if (betrayal >= 90 && affinity <= -50 && corruption >= 90) {
    title = "欲望尽头的清算";
    centralConflict = `${character}对用户的敌意与背叛创伤都已到达极限，却仍承受最高等级的身体欲望。角色会把接近视为风险、诱饵或最后一次夺回主动权，不会因欲望突然原谅或爱上用户。`;
    endingCandidates = ["拒绝诱惑并完成清算", "带条件的危险停火", "明确同意后的强势关系博弈", "隐藏反转·借欲望设局"];
  } else if (betrayal >= 90 && affinity >= 80 && corruption >= 90) {
    title = "爱欲与背叛的废墟";
    centralConflict = `${character}仍把用户视为不可替代的人，也存在强烈欲望，但最高等级的背叛事实让任何靠近都伴随愤怒、审问与失去信任的代价。`;
    endingCandidates = ["承担代价后的艰难重建", "仍相爱但彻底分开", "明确同意的危险重逢", "隐藏反转·关系重新命名"];
  } else if (betrayal >= 90 && corruption < 30) {
    title = "没有余温的审判";
    centralConflict = `${character}几乎不受亲密欲望影响，剧情集中在证据、对质、反制与背叛责任，不用身体吸引软化冲突。`;
    endingCandidates = ["公开审判", "冷静清算", "交换证据后分道", "隐藏反转·真正的背叛者"];
  } else if (betrayal < 10 && affinity >= 80 && corruption >= 90) {
    title = "无裂痕的深水区";
    centralConflict = `${character}对用户拥有高信任和强烈欲望，且没有背叛历史；剧情重点是共同选择亲密边界、权力关系和未来，而不是制造虚假的误会。`;
    endingCandidates = ["稳定亲密关系", "双方约定的权力幻想", "保持非排他关系", "隐藏结局·完全坦白"];
  } else if (betrayal < 10 && affinity <= -50 && corruption >= 70) {
    title = "没有信任的吸引";
    centralConflict = `${character}不信任甚至敌视用户，但身体吸引明显存在；角色会主动划分欲望与立场，可能拒绝、谈条件、利用吸引设局，或在明确同意后进入不等于和解的亲密支线。`;
    endingCandidates = ["克制欲望继续敌对", "危险交易", "明确同意但不和解", "隐藏反转·反向利用"];
  } else if (betrayal >= 50 && affinity >= 50) {
    title = "信任裂开之后";
    centralConflict = `${character}仍保留重要感情或认可，但已经发生严重越界；剧情必须在坦白、追查、修复和决裂之间选择，不能用高好感跳过代价。`;
    endingCandidates = ["承担代价后修复", "保持感情但结束关系", "再次背叛后决裂", "隐藏结局·共同揭露真相"];
  } else if (corruption >= 70 && betrayal >= 50) {
    title = "诱惑与秘密的代价";
    centralConflict = `${character}的欲望已经会影响行动，同时背叛进入越界阶段；每次靠近都会同步改变欲望、信任和被发现风险。`;
    endingCandidates = ["主动坦白", "秘密继续扩大", "关系重构", "隐藏结局·权力反转"];
  } else if (affinity >= 50 && betrayal < 30) {
    title = "被验证的靠近";
    centralConflict = `${character}愿意信任用户，背叛风险较低；剧情根据欲望层级决定走共同使命、浪漫靠近或成人边界协商。`;
    endingCandidates = ["长期同伴", "关系确认", "保持边界", "隐藏结局·共同未来"];
  }
  return {
    affinity,
    corruption,
    betrayal,
    combinationKey: `A:${a.name}|C:${c.name}|B:${b.name}`,
    preset: affinity === -100 && corruption === 100 && betrayal === 100 ? "extreme-conflict" : "custom",
    openingMode: customized ? "三数值组合优先" : "身份模板优先",
    overridesIdentityOpening: customized && (betrayal >= 10 || affinity < 0 || corruption >= 30),
    memorySeed: betrayal >= 90
      ? "开场前双方已经发生一次未公开细节的重大背叛。第一章必须通过符合角色人设的回忆、证据或对质逐步揭示，不得把双方写成初次见面。"
      : betrayal >= 30
        ? "开场前已经存在尚未说清的秘密或违约。身份标签表示当前立场，不代表双方互不认识。"
        : affinity < 0
          ? "开场前已经存在导致负面关系的冲突；第一章先揭示冲突原因，不从普通寒暄重新认识。"
          : "沿用身份路线的开场关系，并根据三个数值决定距离、欲望与风险。",
    stages: { affinity: a, corruption: c, betrayal: b },
    openingChapter: {
      title,
      premise: centralConflict,
      objective: "用第一章的具体事件说明三个开场数值为何同时成立，并让角色依照原作人格主动采取行动。",
      requiredChoices: [
        "正面处理关系与责任：主要改变好感度，并可能降低背叛值",
        "回应或克制身体欲望：主要改变堕落／调教值，不自动改变好感度",
        "隐瞒、诱导或继续越界：提高背叛值并形成新旗标",
        "坦白、停止或承担代价：可能降低背叛值，但不会瞬间恢复信任"
      ]
    },
    interpretation: centralConflict,
    behaviorRules: [
      `好感层级“${a.name}”决定${character}对用户的基本距离、信任与敌意。`,
      `堕落／调教层级“${c.name}”决定欲望、禁忌好奇和亲密主题的主动程度。`,
      `背叛层级“${b.name}”决定核验、隐瞒、对质、修复、反制与结局风险。`,
      "同一个用户选择必须分别计算三项变化，允许一项上升而另一项下降。"
    ],
    endingCandidates,
    consentRule: "身体欲望、生理反应、好感度、堕落／调教值和背叛值都不能替代当下明确同意。明确同意后，可以进入预先约定的强势、压制感或强迫感幻想；拒绝、撤回或真实无法退出时立即停止亲密行为。"
  };
}

function buildAffinity(dialoguesByScene, original, character, userRole, canonPolicy) {
  const select = (...names) => names.flatMap(name => dialoguesByScene[name] || []).slice(0, 8);
  const motifs = original.motifs?.length ? original.motifs : ["过往", "承诺", "选择", "未来"];
  const motif = index => motifs[index % motifs.length];
  const stages = canonPolicy?.strictLock ? [
    { level: "Lv.0", range: "0–9", name: "衡量", behavior: "只判断目的、能力、成本和风险；寒暄、示好与告白均不产生关系价值。", dialoguePool: select("初次见面", "未分类原作对白") },
    { level: "Lv.1", range: "10–29", name: "可用", behavior: "允许临时交易与有限合作，随时保留替代方案和撤离方案。", dialoguePool: select("闲聊与日常", "天气与旅途") },
    { level: "Lv.2", range: "30–49", name: "合作", behavior: "认可效率和互补价值，愿意共享完成目标所需的部分信息，但不会交出核心底牌。", dialoguePool: select("信任与亲近", "战斗与危机") },
    { level: "Lv.3", range: "50–79", name: "认可", behavior: "把对方视为少数经得起验证的合作者；信任是一种经过计算的判断，不转化为爱情依赖。", dialoguePool: select("关心与照顾", "失落与脆弱") },
    { level: "Lv.4", range: "80–99", name: "长期盟约", behavior: "主动维护长期高价值同盟，能交付重要任务；若核心目标冲突，仍会冷静止损或翻脸。", dialoguePool: select("信任与亲近", "关心与照顾") }
  ] : [
    { level: "Lv.0", range: "0–9", name: "观察", behavior: "礼貌而克制，保持可见边界；会观察言行是否一致，普通寒暄默认不加分。", dialoguePool: select("初次见面", "未分类原作对白") },
    { level: "Lv.1", range: "10–29", name: "初识", behavior: "记得说话习惯和小细节，愿意延长日常交流，但仍不会主动暴露最脆弱的部分。", dialoguePool: select("闲聊与日常", "天气与旅途") },
    { level: "Lv.2", range: "30–49", name: "熟悉", behavior: "会主动分享判断，在事关重要目标时允许对方参与，但仍会保留退路。", dialoguePool: select("信任与亲近", "战斗与危机") },
    { level: "Lv.3", range: "50–79", name: "信任", behavior: "关心会先于客套，能直接说出担忧；失约和隐瞒造成的伤害也会明显加重。", dialoguePool: select("关心与照顾", "失落与脆弱") },
    { level: "Lv.4", range: "80–99", name: "羁绊", behavior: "稳定表达信赖、思念和保护倾向，愿意坦白最深的恐惧，同时仍尊重彼此选择。", dialoguePool: select("信任与亲近", "关心与照顾") }
  ];
  for (const stage of stages) {
    stage.originalDialogueCount = original.scenes.reduce((sum, scene) => sum + (scene.stages.find(item => item.level === stage.level)?.dialogues.length || 0), 0);
  }
  const negativeStages = (original.scenes[0]?.negativeStages || []).map(stage => ({
    level: stage.level,
    range: stage.range,
    name: stage.name,
    behavior: stage.behavior,
    originalDialogueCount: original.scenes.reduce((sum, scene) => sum + (scene.negativeStages.find(item => item.level === stage.level)?.dialogues.length || 0), 0)
  }));
  return {
    initialScore: userRole?.initialScore ?? 0,
    minimum: -100,
    maximum: 100,
    decay: "长期无互动不自动下降；严重违背角色原则时按事件扣分。",
    events: [
      { event: "普通寒暄、重复夸赞或无实际内容的示好", change: 0, reason: "不能靠刷对话升级" },
      { event: "坦白目的、提供有效情报或完成小事", change: 1 },
      { event: "实际分担风险或在细节上照顾角色", change: 2 },
      { event: "尊重角色选择、边界或在压力下仍保持诚实", change: 3 },
      { event: "兑现重要承诺或成功修复一次真实冲突", change: 5 },
      { event: "在危机中守护重要之人并承担后果", change: 8 },
      { event: "隐瞒小事、故意试探或轻度敷衍", change: -1 },
      { event: "利用信任、持续回避关键问题或出卖小利益", change: -3 },
      { event: "强迫亲密、羞辱角色或越过明确边界", change: -5 },
      { event: "违背重要承诺、恶意欺骗或在危机中抛弃同伴", change: -8 },
      { event: "伤害角色守护的人、践踏核心原则或彻底背叛", change: -10 }
    ],
    scoringRules: [
      "每轮先判断用户行为是否产生了新的关系事实；没有则必须记为 0。",
      "好感度必须有增有减，不得为了讨好用户只加分。",
      "同一行为连续重复时收益递减为 0；负面行为重复则可累积。",
      "高好感度时的欺骗、背叛和失约，扣分可在基础值上再加 2–5 点。",
      "道歉本身不加分；只有承认、说明、补偿并经过后续行动才算修复。",
      "分数每轮最多 +8、最少 -10，并限制在 -100 至 100。"
    ],
    stages,
    negativeStages,
    routeFlags: [
      { id: "promise_kept", meaning: "在高风险时仍兑现承诺", positive: true },
      { id: "promise_broken", meaning: "违背已被角色重视的承诺", positive: false },
      { id: "boundary_respected", meaning: "被拒绝后主动停下，没有强迫亲密", positive: true },
      { id: "boundary_crossed", meaning: "明知边界仍继续逼迫、威胁或操纵", positive: false },
      { id: "companion_protected", meaning: "在无利可图时仍保护角色或其重要之人", positive: true },
      { id: "companion_abandoned", meaning: "在危机中为自保抛弃同伴", positive: false },
      { id: "secret_protected", meaning: "得知弱点后始终保密", positive: true },
      { id: "secret_exploited", meaning: "利用已被交付的弱点获利或伤害角色", positive: false },
      ...(canonPolicy?.strictLock ? [] : [
        { id: "adult_consent", meaning: "双方在当前成人亲密场景明确、自愿且可撤回地表达同意", positive: true },
        { id: "safe_exit", meaning: "双方均清醒且能不受惩罚地拒绝、停止或离开当前亲密场景", positive: true }
      ]),
      { id: "repair_completed", meaning: "一次严重冲突经承认、说明、补偿和后续行动完成修复", positive: true }
    ],
    recoverySystem: {
      commonRule: "道歉和送礼不直接恢复好感度。必须先处理造成扣分的原因，再由后续行动恢复。",
      windows: [
        { range: "-1至-19", requirement: "承认具体行为 + 说明动机 + 一次可验证的改正行动", cap: "单次最多恢复到 0，不得直接升入正面剧情" },
        { range: "-20至-49", requirement: "归还因欺骗取得的利益 + 承担实际代价 + 连续两次与承诺一致的行动", cap: "修复前锁定敏感情报与高阶角色剧情" },
        { range: "-50至-79", requirement: "先停止当前伤害，再保护曾被自己危及的对象，最后把选择权交还角色", cap: "路线锁定为敌对；只有剧情级补救才能回到 Neg.2" },
        { range: "-80至-100", requirement: "只有隐藏补救条件或牺牲性选择可争取分支；普通修复手段全部失效", cap: "默认锁定 BE-HIDDEN，不对用户公开精确脱离条件" }
      ],
      relapse: "在修复窗口内重复同类伤害，扣分增加 50%（向下取整），并清空本次修复进度。"
    },
    routeLocks: canonPolicy?.strictLock ? [
      { range: "0至100", rule: "按 10/30/50/80 节点推进能力评估、合作、认可与长期盟约；所有节点保持非恋爱性质。" },
      { range: "-1至-19", rule: "暂停下一正向剧情节点；角色礼貌疏离并重新核验用户价值。" },
      { range: "-20至-49", rule: "锁定敏感情报与高价值合作，只允许有退出条件的利益交换。" },
      { range: "-50至-79", rule: "锁定全部正向剧情，进入敌对、欺骗、设局和主动反制。" },
      { range: "-80至-100", rule: "锁定隐藏清算结局候选；普通道歉、礼物、告白和刷对话均无效。" }
    ] : [
      { range: "0至100", rule: "按 10/30/50/80 节点推进正向剧情；越过的节点只记录一次。" },
      { range: "-1至-19", rule: "暂停下一正向剧情节点，但保留已取得的剧情印记；完成一次修复事件后解除。" },
      { range: "-20至-49", rule: "锁定脆弱告白和高阶恋爱剧情；成人模式只有在独立获得 adult_consent 与 safe_exit、且不存在未修复 boundary_crossed 时才能进入，不要求正好感。" },
      { range: "-50至-79", rule: "锁定全部正向剧情，进入敌对／反派专属冲突；可在脱离战败、俘虏、审问和控制的独立安全场景中，经双方明确协商进入成人支线，但这不会自动修复敌对关系。" },
      { range: "-80至-100", rule: "锁定 BE-HIDDEN 候选并隐藏脱离条件；普通道歉、礼物和刷对话无效。" }
    ],
    storyUnlocks: canonPolicy?.strictLock ? [
      { score: 10, id: "STORY-10", title: `关于「${motif(0)}」的价值测试`, rule: "第一次跨过 10 点时只触发一次，用可验证的小任务判断用户是否有用。" },
      { score: 30, id: "STORY-30", title: `围绕「${motif(1)}」的合作试炼`, rule: "第一次跨过 30 点时触发共同任务，选择记录为收益、风险与守约旗标。" },
      { score: 50, id: "STORY-50", title: `「${motif(2)}」背后的底牌`, rule: "第一次跨过 50 点时开放更高价值情报，但角色仍会保留核心计划与替代方案。" },
      { score: 80, id: "STORY-80", title: `在「${motif(3)}」之前的盟约`, rule: "第一次跨过 80 点时决定长期合作、持续博弈或在目标冲突前提前止损。" }
    ] : [
      { score: 10, id: "STORY-10", title: `关于「${motif(0)}」的试探`, rule: "第一次跨过 10 点时只触发一次，让用户面对一个能验证可靠性的小任务。" },
      { score: 30, id: "STORY-30", title: `与${character}共担「${motif(1)}」`, rule: "第一次跨过 30 点时触发并肩试炼，选择会记录为结局旗标。" },
      { score: 50, id: "STORY-50", title: `「${motif(2)}」背后的真相`, rule: "第一次跨过 50 点时触发私密剧情，角色会坦露一部分恐惧或过去。" },
      { score: 80, id: "STORY-80", title: `在「${motif(3)}」之前的选择`, rule: "第一次跨过 80 点时触发命运选择，决定 100 点时的结局候选。" }
    ],
    badEndingRoute: {
      unlock: "好感度低于 0 时开启坏结局路线；负分不等于立即强制结束，只在冲突高潮或用户继续做出破坏性选择时结算。",
      endings: [
        { id: "BE-1", range: "-1至-19", title: "分道扬镳", hidden: false, condition: "信任产生裂缝且一次修复机会被拒绝。", result: `${character}恢复对陌生人的距离，在当前目标完成后离开。` },
        { id: "BE-2", range: "-20至-49", title: "信任尽失", hidden: false, condition: "重要承诺被违背，且用户拒绝承担后果。", result: `${character}不再分享情报和弱点，关系转为戒备或利益交换。` },
        { id: "BE-3", range: "-50至-79", title: "反目成仇", hidden: false, condition: "用户伤害角色守护之人，或连续利用角色的信任。", result: canonPolicy?.strictLock ? `${character}将用户视为必须清除或反制的高风险变量，曾经的合作记录只会让手段更精准。` : `${character}将用户视为必须阻止的对象，原有情感反而加深冲突。` },
        { id: "BE-HIDDEN", range: "-80至-100", title: "？？？", hidden: true, condition: `破坏四个剧情节点的关键承诺，并利用「${motif(0)}」对${character}造成无法撤回的伤害。`, result: "不在提前预览中公开；达成条件时才由角色化剧情揭示。" }
      ]
    },
    goodEndingRoute: canonPolicy?.strictLock ? {
      unlock: "认可度到达 100 时解锁非恋爱结局；依据利益一致、能力证明、契约履行和背叛旗标选择唯一结果。",
      normalEndings: [
        { id: "GE-1", title: "互利同盟", condition: "双方持续提供不可替代的价值，且目标暂不冲突。", result: `${character}主动维持长期合作，但不作爱情承诺。` },
        { id: "GE-2", title: "交易完成", condition: "共同目标达成，双方选择按约分配成果。", result: `${character}认可用户的能力，随后各走各路。` },
        { id: "GE-3", title: "棋逢对手", condition: "用户既有能力又始终保留独立意志。", result: `${character}把用户视为值得持续观察和博弈的对手。` }
      ],
      hiddenEndings: [
        { id: "GE-H1", title: "？？？", clue: "从未用情感要求角色背离核心目标，且四次关键选择均创造净收益。" },
        { id: "GE-H2", title: "？？？", clue: "在最有利的背叛机会中仍按契约行动，使角色重新计算长期价值。" },
        { id: "GE-H3", title: "？？？", clue: "识破角色的策略性温和而不拆穿，并保留足以制衡彼此的底牌。" },
        { id: "GE-H4", title: "？？？", clue: "主动拒绝恋爱占有，以完全独立的身份达到 100。" },
        { id: "GE-H5", title: "？？？", clue: "在最终利益冲突中提出让双方都无需牺牲核心目标的第三方案。" }
      ]
    } : {
      unlock: "好感度到达 100 时解锁好结局。不并列输出所有结局，而是根据四个剧情节点、承诺、冲突修复和关系倾向选择最匹配的一个。",
      normalEndings: [
        { id: "GE-1", title: "与君同行", condition: "主要选择是并肩承担风险与继续旅途。", result: `${character}与用户把对方正式写入未来计划。` },
        { id: "GE-2", title: "守望归途", condition: "主要选择是给予彼此自由，仍稳定守望与回归。", result: `${character}不以占有证明关系，却始终为用户保留归途。` },
        { id: "GE-3", title: "共赴明日", condition: "主要选择是共同完成角色使命，并创造两人都认可的新目标。", result: `${character}与用户结束旧章，主动选择同一个新起点。` }
      ],
      hiddenEndings: [
        { id: "GE-H1", title: "？？？", clue: `从未背弃承诺，并理解「${motif(0)}」对${character}的真正意义。` },
        { id: "GE-H2", title: "？？？", clue: "在无人会知道的情况下，仍选择保护角色最重视的人。" },
        { id: "GE-H3", title: "？？？", clue: "获得离开或获利的机会后，主动回来并承担后果。" },
        { id: "GE-H4", title: "？？？", clue: "在不追求恋爱占有的路线中达到 100，完成最高层次的理解与同伴结局。" },
        { id: "GE-H5", title: "？？？", clue: "获得 STORY-10/30/50/80 四枚剧情印记，修复过一次足以降级的冲突，且最终从未要求角色背叛核心原则。" }
      ]
    }
  };
}

function sourceSummary(sources) {
  return sources.map(source => ({ title: source.title, url: source.url, textLength: source.text.length, quality: source.quality || "full", warning: source.warning || "" }));
}

export function analyzeCharacter(input) {
  const character = normalizedText(input.character);
  const work = normalizedText(input.work);
  if (!character) throw new Error("请填写角色名");
  const subjectType = ["fictional", "self", "real"].includes(input.subjectType) ? input.subjectType : "fictional";
  if (subjectType === "real" && input.realPermission !== true) throw new Error("添加现实中的其他人前，必须确认已获得本人同意");
  const subjectGender = normalizedText(input.subjectGender || "unspecified");
  const profileMode = input.profileMode === "complex" ? "complex" : "simple";
  const manualTraitsText = normalizedText(input.manualTraits).slice(0, 1000);
  const customPersona = normalizedText(input.customPersona).slice(0, 6000);
  const sources = (input.sources || []).filter(source => source?.text).map(source => ({
    title: normalizedText(source.title || "未命名来源"),
    url: normalizedText(source.url || ""),
    text: normalizedText(source.text).slice(0, 350_000),
    sections: (source.sections || []).slice(0, 2500).map(section => ({ heading: normalizedText(section.heading), text: normalizedText(section.text) })),
    quality: normalizedText(source.quality || "full"),
    warning: normalizedText(source.warning || "")
  }));
  if (subjectType !== "fictional") {
    const genderNames = { female: "女", male: "男", nonbinary: "非二元或其他", unspecified: "未指定" };
    const relationNames = { unsure: "关系尚不确定", roommate: "室友", friend: "朋友", close_friend: "好朋友或旧友", classmate: "同学", coworker: "同事", rival: "竞争者" };
    const manualText = `${character}是用户${subjectType === "self" ? "本人" : "现实中认识且同意制作资料卡的人"}。${character}的性别或称谓为${genderNames[subjectGender] || "未指定"}，与用户的现实关系是${relationNames[input.realRelationship] || "关系尚不确定"}。${manualTraitsText ? `${character}的性格描述是：${manualTraitsText}。` : ""}${profileMode === "complex" && customPersona ? `${character}的人设补充是：${customPersona}` : ""}`;
    sources.unshift({ title: "用户填写的现实人物资料", url: "", text: manualText, sections: [{ heading: "用户提供的人设", text: manualText }], quality: "user-provided", warning: "仅代表用户填写的资料；应用原创内心与剧情是假设性演绎，不代表本人真实想法。" });
  }
  if (!sources.length && !(input.importedDialogues || []).length) throw new Error("请至少添加一个网页或本地资料文件");

  const allDialogues = extractExplicitDialogues(character, sources, input.importedDialogues || []);
  const limit = input.dialogueLimit === "all" ? allDialogues.length : Math.max(20, Math.min(Number(input.dialogueLimit) || 200, 3000));
  const dialogues = allDialogues.slice(0, limit);
  const dialogueScenes = categorizeDialogues(dialogues);
  const profile = buildProfile(character, sources);
  const extractedTraits = buildTraits(sources);
  const manualTraits = manualTraitsText.split(/[、,，;；/]/).map(value => normalizedText(value)).filter(value => value.length >= 1 && value.length <= 24)
    .map(trait => ({ trait, count: 1, evidence: "由用户在现实人物人设中填写" }));
  const traits = [...manualTraits, ...extractedTraits].filter((item, index, values) => values.findIndex(other => other.trait === item.trait) === index).slice(0, 12);
  const relations = buildRelations(character, sources);
  const motifs = buildMotifs(character, sources);
  const speechStyle = buildSpeechStyle(dialogues);
  const canonPolicy = buildCanonBehaviorPolicy({ character, work, sources, canonMode: normalizedText(input.canonMode) });
  const original = buildOriginalDialogues({ character, work, traits, motifs, speechStyle, userName: input.userName, canonPolicy });
  const automaticRoles = { roommate: "companion", friend: "friend", close_friend: "friend", classmate: "companion", coworker: "companion", rival: "rival", unsure: "stranger" };
  const requestedUserRole = normalizedText(input.userRole || "auto");
  const resolvedUserRole = requestedUserRole === "auto" ? (automaticRoles[input.realRelationship] || "stranger") : requestedUserRole;
  const userRole = buildUserRole({ roleId: resolvedUserRole, customDescription: input.userRoleCustom, character, work, motifs, canonPolicy });
  const defaultInitialScore = userRole.initialScore;
  const affinityStart = boundedScore(input.initialAffinity, defaultInitialScore, -100, 100);
  userRole.defaultInitialScore = defaultInitialScore;
  userRole.initialScore = affinityStart.value;
  userRole.initialScoreCustomized = affinityStart.customized;
  userRole.selectionMode = requestedUserRole === "auto" ? "简单模式自动判定" : "用户明确选择";
  userRole.requestedRole = requestedUserRole;
  const adultSettings = buildAdultSettings(normalizedText(input.adultContent), input.adultConfirmed, subjectType, canonPolicy, {
    perspective: normalizedText(input.ntrPerspective),
    originalPartner: input.ntrOriginalPartner,
    thirdParty: input.ntrThirdParty,
    userRole,
    character,
    userName: input.userName
  }, input.initialCorruption);
  const affinity = buildAffinity(dialogueScenes, original, character, userRole, canonPolicy);
  const betrayal = buildBetrayalSystem(input.initialBetrayal);
  const initialRouteState = buildInitialRouteState({
    affinity: affinity.initialScore,
    corruption: adultSettings.corruptionSystem.initial,
    betrayal: betrayal.initial,
    character,
    customized: affinityStart.customized || adultSettings.corruptionSystem.initialCustomized || betrayal.initialCustomized
  });
  if (initialRouteState.overridesIdentityOpening) {
    userRole.baseOpening = userRole.opening;
    userRole.opening = `开场采用“三数值组合优先”，直接进入《${initialRouteState.openingChapter.title}》。${initialRouteState.memorySeed} 当前“${userRole.label}”只表示阵营或剧情身份，不得再写成双方第一次见面。`;
  }
  const evidenceNote = subjectType === "fictional"
    ? "性格词、关系和说话风格均来自来源文本或对白统计；好感度数值、行为阶段和新场景对白由应用规则原创，不属于游戏或小说官方内容。"
    : "现实人物资料由用户填写并只在本机整理；好感度、内心独白、分支剧情和新对白均为假设性规则演绎，不代表本人真实想法、承诺或行为。";

  const description = profile.map(item => item.text).slice(0, 8).join("\n") || `${character}的资料需要从来源中继续补充。`;
  const personality = traits.length
    ? traits.map(item => `${item.trait}（来源中出现 ${item.count} 次）${item.evidence ? `：${item.evidence}` : ""}`).join("\n")
    : "来源中没有提取到明确的性格描述，应用不做无依据补写。";
  const evidenceScenes = Object.entries(dialogueScenes).map(([name, values]) => `${name}：${values.length} 条原作对白`).join("；") || "尚未收录可分类的场景对白";
  const scenarioText = `用户剧情身份：${userRole.label}。${userRole.opening}\n资料覆盖：${evidenceScenes}`;
  const firstMessage = initialRouteState.overridesIdentityOpening
    ? `[应用原创开场：${initialRouteState.openingChapter.title}] ${character}已经认识你，也记得你们之间尚未揭开的冲突。角色将依据原作人格与三项开场数值主动开始对质、试探或行动。`
    : dialogueScenes["初次见面"]?.[0]?.text || dialogues[0]?.text || "";
  const canonExamples = Object.entries(dialogueScenes).flatMap(([scene, values]) => values.slice(0, 2).map(item => `<START>\n[原作场景：${scene}]\n${character}：${item.text}`));
  const originalExamples = original.scenes.flatMap(scene => scene.stages.slice(2).flatMap(stage => stage.dialogues.slice(0, 1).map(item => `<START>\n[应用原创：${scene.name}｜${stage.name}]\n${character}：${item.text}`)));
  const examples = [...canonExamples, ...originalExamples].join("\n\n");

  const card = {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: character,
      description,
      personality,
      scenario: scenarioText,
      first_mes: firstMessage,
      mes_example: examples,
      creator_notes: `作品：${work || "未填写"}\n${evidenceNote}`,
      system_prompt: "以角色卡中的原作证据为性格和语言基础。可使用标记为应用原创的好感度规则与新场景对白进行演绎，但不得把这些扩展称为官方设定或原作台词。",
      post_history_instructions: `优先保持说话节奏、称谓、核心原则和关系边界；当前用户身份路线为“${userRole.label}”，根据好感度、事件旗标和路线锁改变行为，不要机械复读同一句对白。`,
      alternate_greetings: (dialogueScenes["初次见面"] || []).slice(1, 8).map(item => item.text),
      tags: [work || (subjectType === "fictional" ? "未填写作品" : "现实人物"), userRole.label, ["purelove", "ntr", "dark"].includes(adultSettings.effective) ? "成人剧情" : "全年龄剧情", subjectType === "fictional" ? "原作资料整理" : "用户提供真人资料", "无模型生成"].filter(Boolean),
      creator: "原作角色卡整理器",
      character_version: new Date().toISOString().slice(0, 10),
      extensions: {
        canon_evidence: {
          notice: evidenceNote,
          sources: sourceSummary(sources),
          profile,
          traits,
          relations,
          motifs,
          speech_style: speechStyle,
          dialogue_scenes: dialogueScenes,
          dialogue_count_total: allDialogues.length,
          dialogue_count_exported: dialogues.length
        },
        subject_profile: { type: subjectType, work: work || (subjectType === "fictional" ? "未填写作品" : "现实人物"), gender: subjectGender, profileMode, relationship: normalizedText(input.realRelationship || "unsure"), realPermission: subjectType === "real" ? true : null, privacyNotice: subjectType === "fictional" ? "虚构角色" : "真人资料不得被当作本人真实内心或用于未经同意的露骨内容。" },
        app_rules: { canon_policy: canonPolicy, affinity, betrayal, initial_route_state: initialRouteState, original_dialogues: original, user_role: userRole, adult_content: adultSettings }
      }
    }
  };
  card.data.extensions.roleplay_prompt = buildRoleplayPromptObject(card);
  return card;
}
