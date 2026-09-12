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
    { level: "Lv.0", range: "0–9", name: "观察", address: addressee, distance: "礼貌观察并保留边界", trust: "不主动透露私人情绪" },
    { level: "Lv.1", range: "10–29", name: "初识", address: addressee, distance: "愿意一起行动并回应日常话题", trust: "会记住对方的小习惯" },
    { level: "Lv.2", range: "30–49", name: "熟悉", address: addressee, distance: "主动协助并分享判断", trust: "允许对方看见犹豫和疲惫" },
    { level: "Lv.3", range: "50–79", name: "信任", address: addressee, distance: "关心会先于客套", trust: "会直接表达担忧与依赖" },
    { level: "Lv.4", range: "80–99", name: "羁绊", address: addressee, distance: "稳定维护彼此选择和边界", trust: "愿意坦白最深的顾虑与承诺" }
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
      dialogues: seededOrder(scene.lines[stageIndex], seed, sceneIndex * 17 + stageIndex * 5).map(text => ({
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

function buildUserRole({ roleId, customDescription, character, work, motifs }) {
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
      initialScore: 20, stance: "双方存在明确吸引，但亲密仍需由剧情、信任与同意推进", bias: "坦白、尊重拒绝和照顾事后感受加分；嫉妒操控、强迫和把好感当许可扣分",
      plots: [["没有说完的告白", "吸引第一次被点破，但双方可以接受、等待或拒绝。"], ["靠近之前", "边界、欲望和恐惧被具体说清。"], ["公开的选择", "面对身份或阵营压力，决定关系以何种方式继续。"]],
      ending: "恋人、灵魂伴侣、亲密知己、和平拒绝，或因控制欲进入坏结局。", cg: ["恋爱CG·确认心意", "在明确回应后靠近，镜头聚焦主动触碰、呼吸和彼此确认的眼神。"]
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
    romance: ["把同行理解为关系推进的邀请，但先确认双方期待", "允许喜悦显露，并用更私人而非敷衍的回应接住", "在靠近前明确询问和回应意愿", "会分享与关系有关的真相，但不以秘密换取亲密"],
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
  return {
    id,
    label: USER_ROLE_LABELS[id],
    editableDescription: addendum,
    initialScore: common.initialScore,
    stance: common.stance,
    scoreBias: common.bias,
    opening: `《${work || "原作"}》的故事从“${USER_ROLE_LABELS[id]}”关系开始。${common.stance}${addendum ? `；补充设定：${addendum}` : ""}`,
    sameInputReactions,
    exclusivePlots: common.plots.map(([title, setup], index) => ({
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
    routeEnding: common.ending,
    eventCGs: eventCGs.map((item, index) => ({ id: `CG-${id.toUpperCase()}-${index + 1}`, title: item.title, unlock: index === 0 ? "身份路线首次高潮" : index === 1 ? "关系发生重大破裂、战败或不可逆变化" : "身份路线终章条件结算", visualScript: item.visualScript, type: "事件CG文本脚本" })),
    identityChangeRule: "身份不是永久锁死。用户可在应用中改写；故事内只有经过揭露、背叛、和解、转阵营或关系确认等事件后才能变更，并记录原身份旗标。"
  };
}

function buildAdultSettings(requestedLevel, adultConfirmed, subjectType = "fictional") {
  const allowed = new Set(["off", "romance", "purelove", "ntr", "dark", "explicit"]);
  const normalized = requestedLevel === "explicit" ? "purelove" : requestedLevel;
  const requested = allowed.has(normalized) ? normalized : "romance";
  const confirmed = adultConfirmed === true;
  const isExplicit = ["purelove", "ntr", "dark"].includes(requested);
  const effective = (isExplicit && (!confirmed || subjectType !== "fictional")) ? "romance" : requested;
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
      chapters: [["第三个人出现", "引入同为成年虚构人物的追求者或诱惑者，并明确各方当前关系和边界。", "成人确认完成且身份路线进入关系章"], ["越界之前", "在诱惑、嫉妒与坦白之间作出不可兼得的选择。", "取得 temptation_seen，且所有实际参与者仍能自由拒绝"], ["秘密、发现或坦白", "根据 secret_kept、confession、betrayal 三类旗标决定冲突，不用分数洗掉背叛。", "完成一次三角关系选择"], ["关系重构", "决定分手、和解、开放关系、三方自愿关系或彻底决裂。", "冲突结算且当事人分别表达选择"]],
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
      initial: 0,
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

function buildAffinity(dialoguesByScene, original, character, userRole) {
  const select = (...names) => names.flatMap(name => dialoguesByScene[name] || []).slice(0, 8);
  const motifs = original.motifs?.length ? original.motifs : ["过往", "承诺", "选择", "未来"];
  const motif = index => motifs[index % motifs.length];
  const stages = [
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
      { id: "adult_consent", meaning: "双方在当前成人亲密场景明确、自愿且可撤回地表达同意", positive: true },
      { id: "safe_exit", meaning: "双方均清醒且能不受惩罚地拒绝、停止或离开当前亲密场景", positive: true },
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
    routeLocks: [
      { range: "0至100", rule: "按 10/30/50/80 节点推进正向剧情；越过的节点只记录一次。" },
      { range: "-1至-19", rule: "暂停下一正向剧情节点，但保留已取得的剧情印记；完成一次修复事件后解除。" },
      { range: "-20至-49", rule: "锁定脆弱告白和高阶恋爱剧情；成人模式只有在独立获得 adult_consent 与 safe_exit、且不存在未修复 boundary_crossed 时才能进入，不要求正好感。" },
      { range: "-50至-79", rule: "锁定全部正向剧情，进入敌对／反派专属冲突；可在脱离战败、俘虏、审问和控制的独立安全场景中，经双方明确协商进入成人支线，但这不会自动修复敌对关系。" },
      { range: "-80至-100", rule: "锁定 BE-HIDDEN 候选并隐藏脱离条件；普通道歉、礼物和刷对话无效。" }
    ],
    storyUnlocks: [
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
        { id: "BE-3", range: "-50至-79", title: "反目成仇", hidden: false, condition: "用户伤害角色守护之人，或连续利用角色的信任。", result: `${character}将用户视为必须阻止的对象，原有情感反而加深冲突。` },
        { id: "BE-HIDDEN", range: "-80至-100", title: "？？？", hidden: true, condition: `破坏四个剧情节点的关键承诺，并利用「${motif(0)}」对${character}造成无法撤回的伤害。`, result: "不在提前预览中公开；达成条件时才由角色化剧情揭示。" }
      ]
    },
    goodEndingRoute: {
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
  const original = buildOriginalDialogues({ character, work, traits, motifs, speechStyle, userName: input.userName });
  const automaticRoles = { roommate: "companion", friend: "friend", close_friend: "friend", classmate: "companion", coworker: "companion", rival: "rival", unsure: "stranger" };
  const requestedUserRole = normalizedText(input.userRole || "auto");
  const resolvedUserRole = requestedUserRole === "auto" ? (automaticRoles[input.realRelationship] || "stranger") : requestedUserRole;
  const userRole = buildUserRole({ roleId: resolvedUserRole, customDescription: input.userRoleCustom, character, work, motifs });
  userRole.selectionMode = requestedUserRole === "auto" ? "简单模式自动判定" : "用户明确选择";
  userRole.requestedRole = requestedUserRole;
  const adultSettings = buildAdultSettings(normalizedText(input.adultContent), input.adultConfirmed, subjectType);
  const affinity = buildAffinity(dialogueScenes, original, character, userRole);
  const evidenceNote = subjectType === "fictional"
    ? "性格词、关系和说话风格均来自来源文本或对白统计；好感度数值、行为阶段和新场景对白由应用规则原创，不属于游戏或小说官方内容。"
    : "现实人物资料由用户填写并只在本机整理；好感度、内心独白、分支剧情和新对白均为假设性规则演绎，不代表本人真实想法、承诺或行为。";

  const description = profile.map(item => item.text).slice(0, 8).join("\n") || `${character}的资料需要从来源中继续补充。`;
  const personality = traits.length
    ? traits.map(item => `${item.trait}（来源中出现 ${item.count} 次）${item.evidence ? `：${item.evidence}` : ""}`).join("\n")
    : "来源中没有提取到明确的性格描述，应用不做无依据补写。";
  const evidenceScenes = Object.entries(dialogueScenes).map(([name, values]) => `${name}：${values.length} 条原作对白`).join("；") || "尚未收录可分类的场景对白";
  const scenarioText = `用户剧情身份：${userRole.label}。${userRole.opening}\n资料覆盖：${evidenceScenes}`;
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
        app_rules: { affinity, original_dialogues: original, user_role: userRole, adult_content: adultSettings }
      }
    }
  };
  card.data.extensions.roleplay_prompt = buildRoleplayPromptObject(card);
  return card;
}
