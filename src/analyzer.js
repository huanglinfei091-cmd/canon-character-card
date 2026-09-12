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
  const blocked = /伤害|攻击|技能|共鸣|暴击|效果|效应|持续|提升|降低|队伍|版本|页面|编辑|攻略|材料|武器|声骸|聚爆|震谐|谐度|同步率|流溢辉光|属性|倍率|数值|冷却|目录|外部链接|基本资料|角色故事|角色经历|档案|珍贵之物|轶闻趣事|参考资料|注释|导航|^TA$|^眼睛$|^现象$/;
  const semanticKeywords = [
    "家人", "父亲", "母亲", "父母", "朋友", "伙伴", "故乡", "学院", "宗门", "师门",
    "纸飞机", "信物", "书信", "剑", "星空", "雪", "雨", "花", "月亮", "火炉", "小屋",
    "英雄", "梦想", "愿望", "承诺", "约定", "记忆", "自由", "守护", "牺牲", "离别", "重逢",
    "电子幽灵", "隧者", "飞行雪绒", "漂泊者", "旅行者"
  ];
  const add = (value, weight = 1) => {
    const clean = normalizedText(value).replace(/[【】「」『』“”"']/g, "").trim();
    if (clean.length < 2 || clean.length > 18 || clean === character || blocked.test(clean) || /^\d/.test(clean)) return;
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

function buildOriginalDialogues({ character, work, traits, motifs, speechStyle, userName }) {
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

  const stages = [
    { level: "Lv.0-1", range: "0–199", name: "初识", address: addressee, distance: "礼貌观察并保留边界", trust: "不主动透露私人情绪" },
    { level: "Lv.2", range: "200–299", name: "眼熟", address: addressee, distance: "愿意一起行动并回应日常话题", trust: "会记住对方的小习惯" },
    { level: "Lv.3", range: "300–399", name: "信任", address: addressee, distance: "主动协助并分享判断", trust: "允许对方看见犹豫和疲惫" },
    { level: "Lv.4", range: "400–499", name: "依赖", address: addressee, distance: "关心会先于客套", trust: "会直接表达担忧与依赖" },
    { level: "Lv.5", range: "500+", name: "全部", address: addressee, distance: "稳定维护彼此选择和边界", trust: "愿意坦白最深的顾虑与承诺" }
  ];

  const reactions = {
    stranger: cool ? "视线在你身上停了一瞬，没有立刻靠近" : "向你点头示意，先观察你的来意",
    familiar: lively ? "很自然地接上你的话，脚步也靠近了一些" : "语气比初见时放松，愿意和你并肩",
    trusted: firm ? "先确认局势，再把最重要的一侧交给你" : "不再反复试探，直接告诉你真实判断",
    close: soft ? "下意识留意你的神情，把关心藏在具体动作里" : "嘴上仍有分寸，行动却明显偏向你",
    bonded: cool ? "没有夸张表态，只把退路和后背都交给你" : "会明确站在你身边，也尊重你自己的决定"
  };

  const stageReaction = [reactions.stranger, reactions.familiar, reactions.trusted, reactions.close, reactions.bonded];
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

  const generatedScenes = scenes.map((scene, sceneIndex) => ({
    id: scene.id,
    name: scene.name,
    stimulus: scene.stimulus,
    stages: stages.map((stage, stageIndex) => ({
      ...stage,
      behavior: `${stageReaction[stageIndex]}；${stage.distance}；${stage.trust}。`,
      dialogues: seededOrder(scene.lines[stageIndex], seed, sceneIndex * 17 + stageIndex * 5).map(text => ({
        text,
        label: "应用原创对白",
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
    total: generatedScenes.reduce((sum, scene) => sum + scene.stages.reduce((stageSum, stage) => stageSum + stage.dialogues.length, 0), 0),
    scenes: generatedScenes
  };
}

function buildAffinity(dialoguesByScene, original) {
  const select = (...names) => names.flatMap(name => dialoguesByScene[name] || []).slice(0, 8);
  const stages = [
    { level: "Lv.0-1", range: "0–199", name: "初识", behavior: "礼貌而克制，保持可见边界；会观察言行是否一致，不因一次寒暄迅速亲近。", dialoguePool: select("初次见面", "未分类原作对白") },
    { level: "Lv.2", range: "200–299", name: "眼熟", behavior: "记得说话习惯和小细节，愿意延长日常交流，但仍不会主动暴露最脆弱的部分。", dialoguePool: select("闲聊与日常", "天气与旅途") },
    { level: "Lv.3", range: "300–399", name: "信任", behavior: "会主动分享判断和重要经历，在危机中把一部分后背交给对方。", dialoguePool: select("信任与亲近", "战斗与危机") },
    { level: "Lv.4", range: "400–499", name: "依赖", behavior: "关心会先于客套，能直接说出担忧；失约和隐瞒造成的伤害也会明显加重。", dialoguePool: select("关心与照顾", "失落与脆弱") },
    { level: "Lv.5", range: "500+", name: "全部", behavior: "稳定表达信赖、思念和保护倾向，愿意坦白最深的恐惧，同时仍尊重彼此选择。", dialoguePool: select("信任与亲近", "关心与照顾") }
  ];
  for (const stage of stages) {
    stage.originalDialogueCount = original.scenes.reduce((sum, scene) => sum + (scene.stages.find(item => item.level === stage.level)?.dialogues.length || 0), 0);
  }
  return {
    initialScore: 0,
    minimum: 0,
    maximum: 599,
    decay: "长期无互动不自动下降；严重违背角色原则时按事件扣分。",
    events: [
      { event: "尊重角色选择或边界", change: 3 },
      { event: "兑现重要承诺", change: 8 },
      { event: "在危机中保护彼此", change: 12 },
      { event: "认真倾听并回应脆弱", change: 6 },
      { event: "普通愉快交流", change: 1 },
      { event: "敷衍或无视明确感受", change: -3 },
      { event: "违背承诺", change: -10 },
      { event: "伤害重要之人或践踏核心原则", change: -20 },
      { event: "强迫亲密或越过明确边界", change: -15 }
    ],
    stages
  };
}

function sourceSummary(sources) {
  return sources.map(source => ({ title: source.title, url: source.url, textLength: source.text.length, quality: source.quality || "full", warning: source.warning || "" }));
}

export function analyzeCharacter(input) {
  const character = normalizedText(input.character);
  const work = normalizedText(input.work);
  if (!character) throw new Error("请填写角色名");
  const sources = (input.sources || []).filter(source => source?.text).map(source => ({
    title: normalizedText(source.title || "未命名来源"),
    url: normalizedText(source.url || ""),
    text: normalizedText(source.text).slice(0, 350_000),
    sections: (source.sections || []).slice(0, 2500).map(section => ({ heading: normalizedText(section.heading), text: normalizedText(section.text) })),
    quality: normalizedText(source.quality || "full"),
    warning: normalizedText(source.warning || "")
  }));
  if (!sources.length && !(input.importedDialogues || []).length) throw new Error("请至少添加一个网页或本地资料文件");

  const allDialogues = extractExplicitDialogues(character, sources, input.importedDialogues || []);
  const limit = input.dialogueLimit === "all" ? allDialogues.length : Math.max(20, Math.min(Number(input.dialogueLimit) || 200, 3000));
  const dialogues = allDialogues.slice(0, limit);
  const dialogueScenes = categorizeDialogues(dialogues);
  const profile = buildProfile(character, sources);
  const traits = buildTraits(sources);
  const relations = buildRelations(character, sources);
  const motifs = buildMotifs(character, sources);
  const speechStyle = buildSpeechStyle(dialogues);
  const original = buildOriginalDialogues({ character, work, traits, motifs, speechStyle, userName: input.userName });
  const affinity = buildAffinity(dialogueScenes, original);
  const evidenceNote = "性格词、关系和说话风格均来自来源文本或对白统计；好感度数值、行为阶段和新场景对白由应用规则原创，不属于游戏或小说官方内容。";

  const description = profile.map(item => item.text).slice(0, 8).join("\n") || `${character}的资料需要从来源中继续补充。`;
  const personality = traits.length
    ? traits.map(item => `${item.trait}（来源中出现 ${item.count} 次）${item.evidence ? `：${item.evidence}` : ""}`).join("\n")
    : "来源中没有提取到明确的性格描述，应用不做无依据补写。";
  const scenarioText = Object.entries(dialogueScenes).map(([name, values]) => `${name}：${values.length} 条原作对白`).join("；") || "尚未收录可分类的场景对白";
  const firstMessage = dialogueScenes["初次见面"]?.[0]?.text || dialogues[0]?.text || "";
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
      post_history_instructions: "优先保持说话节奏、称谓、核心原则和关系边界；根据好感度阶段改变行为距离，不要机械复读同一句对白。",
      alternate_greetings: (dialogueScenes["初次见面"] || []).slice(1, 8).map(item => item.text),
      tags: [work, "原作资料整理", "无模型生成"].filter(Boolean),
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
        app_rules: { affinity, original_dialogues: original }
      }
    }
  };
  card.data.extensions.roleplay_prompt = buildRoleplayPromptObject(card);
  return card;
}
