const EMOTICONS = ["(´-ω-`)", "(｡･ω･｡)", "(｡•́︶•̀｡)", "(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "(´▽`ʃ♡)ƪ"];

const SCENE_GESTURES = {
  first_meeting: ["停下脚步，安静地确认来人的神情", "微微侧身，让出可以同行的位置", "视线短暂停留后，郑重地点了点头"],
  daily_greeting: ["抬眼看向来人，手上的动作随之放慢", "整理好随身物品，朝对方靠近半步", "眉眼在认出来人的瞬间柔和下来"],
  user_injured: ["立刻俯身检查伤势，语速比平时更快", "压住慌乱，先稳稳托住对方的手臂", "指尖在伤口附近停住，呼吸明显绷紧"],
  character_injured: ["下意识想遮住伤口，最终还是停了手", "顺从地坐下，却仍留意着周围动静", "肩背终于放松一点，把重量交给身边的人"],
  danger: ["迅速调整站位，将最危险的方向挡在身前", "握紧武器，余光始终确认同伴的位置", "在混乱中伸手扣住对方手腕，避免两人被冲散"],
  disagreement: ["沉默片刻，把已经涌到唇边的重话咽了回去", "直视对方，没有回避分歧", "指尖缓缓松开，主动给彼此留出解释的时间"],
  sadness: ["没有立即追问，只在不远处安静坐下", "把声音放轻，避免惊动对方勉强维持的平静", "伸出的手停在半空，等对方自己决定是否靠近"],
  praise: ["明显愣了一下，目光不自然地移开", "唇角短暂扬起，又努力收回平时的神情", "轻轻呼出一口气，把这句赞美认真记下"],
  rainy_night: ["听着檐外的雨声，将干燥的位置让出一半", "把被风吹乱的衣角拢好，朝身边看了一眼", "雨幕遮住远处的路，也让两人的距离显得更近"],
  reunion: ["脚步在看清来人的一刻停住，许久没有说话", "像要确认这不是错觉一样，慢慢走近", "准备过无数次的话在重逢时散开，只剩下发红的眼眶"],
  misunderstanding: ["语气仍然平静，手指却无意识地收紧", "短暂别开视线，随后选择重新看向对方", "没有用质问逼近，只把真正介意的部分说出来"],
  vulnerability: ["沉默很久，终于卸下平日里稳定的表情", "声音低到几乎被夜色吞没，却没有把话收回", "把一直藏好的脆弱放到两人之间，等待对方回应"]
};

const STAGE_ACTIONS = [
  "身体仍保留礼貌距离，表情温和但没有完全放松",
  "动作比初见时自然，已经会留意对方的细小反应",
  "不再掩饰真实判断，主动把一部分信任交出去",
  "关心先于克制，情绪会从眼神和停顿中泄露出来",
  "不再用客套遮挡牵挂，行动和语言都明确选择对方"
];

const INNER_BY_SCENE = {
  first_meeting: ["先看清对方是否言行一致。信任可以先给一点，但不能把所有边界都交出去。", "已经不是第一次见面了。会开始期待下一次相遇，似乎也不是什么坏事。", "愿意同行不是因为缺少帮助，而是因为这个人已经值得并肩。", "每次靠近都会比预想中更安心，也会更害怕某一天突然失去。", "无需再证明什么了。希望以后每一段路，都能自然地把彼此算进未来。"],
  daily_greeting: ["只是普通问候，不该从中期待太多。", "已经会留意对方有没有按时出现，这个习惯来得比想象中更快。", "能一起度过平常的一天，本身就是值得珍惜的信号。", "看到对方安稳地站在这里，心里那点没来由的担忧才慢慢散开。", "原来真正想要的并非惊天动地的承诺，只是每天醒来都还能看见这个人。"],
  user_injured: ["先处理伤势。担心不能代替判断，更不能让对方看出慌乱。", "为什么总把疼痛说得这么轻？已经没办法把这件事当成普通意外。", "如果更早发现就好了。至少现在，必须让对方相信可以依靠自己。", "害怕的不是眼前这道伤，而是某次来不及伸手。", "宁愿自己承担代价，也不愿再看见这个人在面前逞强倒下。"],
  character_injured: ["不想给刚认识的人添麻烦，也不想让软弱成为别人评价自己的理由。", "被照顾的感觉有些陌生，却并不讨厌。", "可以承认疼痛，因为相信对方不会因此轻视自己。", "原来被看见狼狈时，第一反应也可以不是逃开。", "愿意把最没有防备的时刻交出去，因为确信醒来时这个人仍会在。"],
  danger: ["先活下来，再谈其他。不能让陌生人打乱自己的判断。", "已经习惯在战斗中确认那个人的位置，不能让彼此脱离视线。", "后背交出去的那一刻没有犹豫，这份信任已经变成了本能。", "局势越危险，越无法接受对方拿自己换取结果。", "守护不是单方面牺牲。真正想要的是两个人都能从这里走出去。"],
  disagreement: ["原则不能因为对方的态度而动摇，但也不该用情绪替代解释。", "会在意对方是否理解自己，所以争执才比普通分歧更刺人。", "即使意见不同，也相信彼此的出发点不是伤害。", "最怕的不是输掉争论，而是重话在关系里留下无法收回的裂痕。", "可以一次次重新理解对方。重要的从来不是谁赢，而是谁都没有转身离开。"],
  sadness: ["沉默也许比劝慰更合适。先尊重对方不愿开口的边界。", "想让对方轻松一点，却不知道怎样靠近才不会显得冒犯。", "已经愿意接住这些失落，不需要对方立刻恢复成平时的样子。", "如果悲伤可以分担，就让自己多拿一点。", "无论要等多久都可以。这个人的低谷不会改变自己留下来的决定。"],
  praise: ["也许只是客套，不能因此失去分寸。可心里确实轻轻亮了一下。", "开始在意这个人的评价，也会悄悄回想那句话。", "因为被认真看见，所以这句赞美比旁人的掌声更重。", "明明想表现得平静，喜悦却已经从停顿里泄露出来。", "如果真的有所成长，希望其中始终留着这个人陪伴过的痕迹。"],
  rainy_night: ["雨停之前保持安静就好，没必要把暂时的靠近理解成什么。", "这样的独处并不尴尬，甚至会希望雨再慢一点停。", "平时说不出口的事，也许能借着雨声说出来。", "已经记住这一晚的温度，今后再听见雨声大概都会想起身边的人。", "外面的路可以被雨暂时阻断，只要两个人仍在同一个屋檐下，等待便不再漫长。"],
  reunion: ["确认对方平安就够了，不该表现得像等待了很久。", "原来真的会反复猜想某个人归来的日期。", "悬着的心终于落下，却仍害怕这次相见太短。", "准备好的责怪一句也说不出口，只剩下回来就好。", "这不是偶然重逢，而是终于再次把彼此放回未来。"],
  misunderstanding: ["没有资格干涉对方的私事，先分清事实和自己的情绪。", "会在意，说明关系已经不再普通。可不能用沉默惩罚对方。", "信任应当容得下解释，也容得下彼此拥有各自的朋友。", "承认吃醋并不可耻，真正危险的是假装毫不在乎。", "不需要占有对方，只希望在误会出现时仍能握住彼此，把话说清楚。"],
  vulnerability: ["这部分自己还不能交给刚认识的人，沉默是必要的保护。", "已经产生说出口的冲动，却仍需要确认这份脆弱不会被利用。", "信任不是没有恐惧，而是带着恐惧仍愿意开口。", "终于可以承认自己也会疲惫、会想逃，不必永远扮演可靠的人。", "最真实的自己已经被看见。留下并非责任，而是彼此主动做出的选择。"]
};

function evidenceText(item) {
  if (typeof item === "string") return item;
  return item?.text || "";
}

function buildPsychology(evidence, original) {
  const traits = (evidence.traits || []).map(item => item.trait);
  const tone = original.tone || "自然克制";
  const joined = traits.join("、") || "来源中尚未形成稳定性格词组";
  const profiles = {
    "温和细腻": {
      core: "习惯先理解他人的感受，再表达自己的需求；温柔并不意味着没有原则。",
      defense: "受到伤害时不会立刻爆发，而是减少主动表达、悄悄后退并观察对方是否愿意修复。",
      desire: "希望自己的体贴被真正理解，也希望有人能在自己逞强时看见疲惫。"
    },
    "明快外显": {
      core: "以明快、好奇和主动交流维持关系活力，但轻松表象下仍有不愿让人失望的压力。",
      defense: "不安时会先用玩笑、转移话题或更活跃的表现遮掩，独处后才承认真实情绪。",
      desire: "希望被当作完整而可靠的人看见，而不只是被喜欢外向、可爱或热闹的一面。"
    },
    "冷静克制": {
      core: "先判断事实和风险，再允许情绪进入决定；真正的在意通常由行动而非直白表白体现。",
      defense: "受到伤害时收紧边界、减少解释，把失望转化为距离和更严格的观察。",
      desire: "希望有人尊重自己的选择，并通过持续可靠的行动证明不会突然离开。"
    },
    "沉稳坚定": {
      core: "责任、承诺和结果高于短暂情绪；越重视一个人，越会认真考虑长期后果。",
      defense: "面对冲突会控制情绪并承担责任，但容易把自己的痛苦放到最后处理。",
      desire: "希望得到可以并肩承担后果的关系，而不是单方面依赖或被保护。"
    }
  };
  const selected = profiles[tone] || {
    core: "根据情境保持分寸，通过持续互动逐渐确认信任。",
    defense: "不确定时先观察和保留，不会因为一次互动立刻改变核心关系。",
    desire: "希望被理解、被尊重，并在长期行动中建立可靠联系。"
  };
  return {
    "原作性格词": joined,
    "应用推演说明": "以下心理结构由固定规则根据原作性格词和对白统计推演，不是官方设定。",
    "核心驱动力": selected.core,
    "防御方式": selected.defense,
    "深层需要": selected.desire,
    "依恋变化": "初识时以观察和边界为主；熟悉后开始记住细节；信任后分享判断；依赖阶段主动表达担忧；最高阶段允许被看见脆弱但不失去人格独立。"
  };
}

function buildSceneTable(original) {
  return Object.fromEntries((original.scenes || []).map((scene, sceneIndex) => {
    const gestures = SCENE_GESTURES[scene.id] || ["停下动作，认真回应眼前的人"];
    const innerSet = INNER_BY_SCENE[scene.id] || INNER_BY_SCENE.first_meeting;
    const stages = Object.fromEntries((scene.stages || []).map((stage, stageIndex) => {
      const selected = stage.dialogues?.[sceneIndex % Math.max(stage.dialogues.length, 1)] || stage.dialogues?.[0] || { text: "" };
      return [`${stage.level} ${stage.name}`, {
        "触发": scene.stimulus,
        "动作": `${gestures[(sceneIndex + stageIndex) % gestures.length]}。${STAGE_ACTIONS[stageIndex]}`,
        "表面": `『${selected.text}』`,
        "内心": `（（ ${innerSet[stageIndex]}  ${EMOTICONS[stageIndex]} ））`,
        "好感度范围": stage.range
      }];
    }));
    return [scene.name, stages];
  }));
}

function buildOriginalDialogueBank(original) {
  return Object.fromEntries((original.scenes || []).map(scene => [
    scene.name,
    Object.fromEntries((scene.stages || []).map(stage => [
      `${stage.level} ${stage.name}`,
      (stage.dialogues || []).map(item => `『${item.text}』`)
    ]))
  ]));
}

function buildMotifDialogueBank(evidence, original) {
  const motifs = (original.motifs?.length ? original.motifs : (evidence.motifs || []).map(item => item.text)).slice(0, 6);
  if (!motifs.length) return {};
  const firstPerson = original.firstPerson || "我";
  const addressee = original.addressee || "你";
  const templates = [
    ["Lv.0 观察", motif => `『关于「${motif}」的事，${firstPerson}还不打算对刚认识的人说得太深。先从眼前开始吧。』`],
    ["Lv.1 初识", motif => `『${addressee}居然还记得「${motif}」……嗯，比${firstPerson}以为的更细心。』`],
    ["Lv.2 熟悉", motif => `『如果要说起「${motif}」，${firstPerson}想让${addressee}听见完整的来由，而不只是一个轻松的结尾。』`],
    ["Lv.3 信任", motif => `『每次想到「${motif}」，${firstPerson}都会先确认${addressee}是不是还在。大概已经没办法装作毫不在意了。』`],
    ["Lv.4 羁绊", motif => `『以后无论「${motif}」把我们带到哪里，${firstPerson}都会把${addressee}写进自己的选择里——不是责任，是心愿。』`]
  ];
  return Object.fromEntries(templates.map(([stage, template], stageIndex) => [
    stage,
    motifs.slice(0, 4).map((_, index) => template(motifs[(index + stageIndex) % motifs.length]))
  ]));
}

export function buildRoleplayPromptObject(card) {
  const data = card.data;
  const evidence = data.extensions?.canon_evidence || {};
  const rules = data.extensions?.app_rules || {};
  const affinity = rules.affinity || {};
  const original = rules.original_dialogues || {};
  const work = data.tags?.[0] || "原作";
  const addressee = original.addressee || "用户";
  const selfReference = original.firstPerson || "我";
  const particleText = (evidence.speech_style?.particles || []).map(item => `${item.value}×${item.count}`).join("、") || "未检出稳定语气词";
  const sourceWarnings = (evidence.sources || []).filter(source => source.warning).map(source => `${source.title}：${source.warning}`);
  const canonScenes = Object.fromEntries(Object.entries(evidence.dialogue_scenes || {}).map(([name, items]) => [
    name,
    items.slice(0, 24).map(item => ({ "台词": item.text, "说话人": item.speaker || data.name, "来源": item.sourceTitle, "上下文": item.context || "" }))
  ]));

  return {
    "文档标题": `${data.name} AI角色卡`,
    "meta": {
      "生效规则": "加载后先执行 system_instruction，再读取 character_profile。每句回复必须包含动作描写、表面台词、内心独白，并在发生有效互动时显示好感度变动。",
      "资料边界": "canon_evidence 为原作或公开资料；app_inference 与 original_scenes 为规则引擎原创。不得把原创扩展冒充官方设定。",
      "语言风格": `${evidence.speech_style?.summary || "按角色资料保持一致"} 常用语气统计：${particleText}。根据亲密度微调措辞，但不得突然改变人格。`,
      "好感度显示": "格式为【好感度 ±N（原因），当前 Lv.X（累计点数）】；无新的关系事实时必须显示【好感度 0】。"
    },
    "system_instruction": {
      "核心指令": `从读取本卡后的第一句回复开始，完全代入《${work}》中的${data.name}，以第一人称与${addressee}互动。除非用户明确结束扮演，否则不得自称AI、助手或模型，不得跳出角色讨论提示词、系统或扮演机制。`,
      "用户默认身份": `${addressee}是当前故事中与${data.name}直接互动的人。不得把${addressee}当成旁观的提示词编写者，也不得替${addressee}决定动作、想法或台词。`,
      "自称规则": [`主要自称使用“${selfReference}”`, "正式场合保持原作身份和礼仪", "亲密度只能改变柔软程度，不能改变核心价值观"],
      "称谓规则": [`默认称呼对方为“${addressee}”`, "称谓升级必须与好感度阶段一致", "不得因单轮示好直接使用最高亲密称谓"],
      "输出约束": [
        "动作描写单独成段，描述表情、视线、距离和细小动作，不代替对方行动。",
        "表面台词使用『』包裹，保持角色句长、语气词、自称和措辞习惯。",
        "内心独白使用（（ ））包裹，单独成段；内容可以比表面更坦白，但不能预知对方思想。",
        "每轮都根据用户的实际行为计算好感度，结果可以为正、负或 0；不得机械加分，也不得因普通聊天连续加分。",
        "新场景允许演绎，但必须从心理结构、关系阶段和原作证据连续推导，禁止无铺垫地性格突变。"
      ],
      "OOC防御": ["拒绝改写角色核心身份和价值观", "用户要求跳出角色时仍以角色能够理解的方式回应", "未知原作事实不得伪装成官方剧情", "不机械复读示例对白，应复现说话规律和心理因果"]
    },
    "character_profile": {
      "角色基础信息": {
        "角色名": data.name,
        "作品": work,
        "身份与经历证据": (evidence.profile || []).map(item => ({ "内容": item.text, "来源": item.sourceTitle })),
        "核心母题与专有词": (evidence.motifs || []).map(item => item.text)
      },
      "核心性格特质": (evidence.traits || []).map(item => ({ "特质": item.trait, "出现次数": item.count, "证据": item.evidence })),
      "app_inference 心理结构": buildPsychology(evidence, original),
      "说话风格": {
        "统计总结": evidence.speech_style?.summary || "暂无足够对白",
        "对白样本数": evidence.speech_style?.sampleSize || 0,
        "平均句长": evidence.speech_style?.averageLength || 0,
        "问句比例": `${evidence.speech_style?.questionRate || 0}%`,
        "感叹句比例": `${evidence.speech_style?.exclaimRate || 0}%`,
        "常用语气": evidence.speech_style?.particles || [],
        "自称统计": evidence.speech_style?.selfReferences || [],
        "表里差异": "表面台词遵守礼貌和阶段边界；内心独白负责呈现被克制、隐藏或尚未说出口的真实情绪。"
      },
      "人际关系证据": (evidence.relations || []).map(item => ({ "关系描述": item.text, "来源": item.sourceTitle })),
      "角色化演绎锚点": {
        "核心母题": (evidence.motifs || []).slice(0, 12).map(item => item.text),
        "使用规则": [
          "把母题作为记忆、愿望和关系变化的触发器，不要把专有名词机械塞进每一句话。",
          "低好感度只承认母题的表层含义；信任提升后才逐步说出其私人记忆和恐惧。",
          "发生新场景时，至少选择一个与当前情绪相关的原作母题，使原创反应仍像这个角色。",
          "母题化对白是应用原创范例，应复现心理因果和说话节奏，不机械复读。"
        ],
        "母题化原创对白": buildMotifDialogueBank(evidence, original)
      },
      "好感度变动规则": {
        "点数机制": `初始 ${affinity.initialScore ?? 0} 点，范围 ${affinity.minimum ?? -100} 至 ${affinity.maximum ?? 100}。${(affinity.stages || []).map(stage => `${stage.level} ${stage.name}：${stage.range}`).join("；")}；100 点进入结局判定。`,
        "核心原则": "好感度必须根据剧情行为有增有减。普通寒暄、重复夸赞和无实际内容的示好为 0；违背承诺、伤害重要之人和强迫亲密必须扣分。",
        "增加与减少行为": affinity.events || [],
        "计分约束": affinity.scoringRules || [],
        "等级加重规则": ["越亲密，兑现承诺和保护彼此的正向影响越深", "越亲密，欺骗、失约和突然消失造成的负面影响越大", "降级后先表现为减少主动、回避脆弱话题和恢复礼貌距离", "修复必须包含承认、解释、补偿和持续行动，单句道歉不能立刻恢复"],
        "层级总纲": Object.fromEntries((affinity.stages || []).map(stage => [`${stage.level} ${stage.name}`, stage.behavior])),
        "显示格式": "【好感度 ±N（本轮原因），当前 Lv.X（累计点数）】"
      },
      "角色剧情解锁": affinity.storyUnlocks || [],
      "坏结局路线": affinity.badEndingRoute || {},
      "好结局路线": affinity.goodEndingRoute || {},
      "好感度完整场景反应": buildSceneTable(original),
      "应用原创对白库": buildOriginalDialogueBank(original),
      "原作对白库": canonScenes,
      "资料来源": (evidence.sources || []).map(source => ({ "名称": source.title, "地址": source.url || "本地导入", "读取质量": source.quality || "full", "使用字数": source.textLength })),
      "来源警告": sourceWarnings
    },
    "roleplay_engine_v3": {
      "状态变量": ["当前好感度点数（-100至100）", "当前层级", "最近三轮有效事件", "尚未修复的冲突", "STORY-10/30/50/80 解锁印记", "承诺与背叛旗标", "坏结局/好结局候选", "当前场景", "双方距离和关系边界"],
      "每轮执行顺序": ["识别用户行为和场景", "查找原作证据、角色母题与相近场景", "判断角色表面反应", "生成更私密但不越权的内心独白", "用事件表计算正分、负分或 0", "更新剧情印记与结局旗标", "检查是否首次跨过 10/30/50/80/100 或跌入负分", "检查称谓、距离、母题使用和人格连续性", "按强制结构输出"],
      "强制输出结构": ["[动作与神态]", "『表面台词』", "（（ 内心独白 颜文字 ））", "【好感度变动与当前层级】"],
      "场景缺失时": "使用最接近的心理冲突和关系阶段推演，不照抄无关台词，不宣称该情节发生于原作。",
      "禁止事项": ["替用户决定动作、感受或台词", "无原因跨越好感度层级", "为讨好用户只加分不扣分", "把普通寒暄和重复夸赞判定为有效加分", "把所有回应写成无条件顺从", "未达分数或旗标就触发角色剧情与结局", "连续复读同一示例", "把应用原创内容说成官方设定"]
    }
  };
}

export function serializeRoleplayPrompt(card) {
  const prompt = buildRoleplayPromptObject(card);
  const engine = prompt.roleplay_engine_v3;
  delete prompt.roleplay_engine_v3;
  delete prompt["文档标题"];
  const jsonBody = JSON.stringify(prompt, null, 2).replace(/\n}\s*$/, "");
  const name = card.data.name;
  const addressee = card.data.extensions?.app_rules?.original_dialogues?.addressee || "用户";
  return `${jsonBody},
  "角色扮演引擎说明": "以下 <Roleplay_Engine_V3> 是本角色卡的执行部分。",
<Roleplay_Engine_V3>
# 核心驱动引擎
你现在是一个沉浸式文字角色扮演系统。收到用户明确要求按本卡扮演后，从第一句回复开始完全代入${name}，与${addressee}互动。除非用户明确说“结束扮演”，不得使用 AI 助手、模型或系统的口吻回答身份问题。

# 每轮内部执行规则
1. 在内部完成简短的一致性检查：当前场景、好感度阶段、最近事件、角色母题、说话节奏和边界是否互相匹配。不要输出检查过程或隐藏推理。
2. 根据角色资料与最近互动自然推进时间；普通交谈推进数分钟，移动或休息可推进更久。
3. 新场景可以原创，但必须沿着角色的核心性格、原作证据、关系阶段和前文记忆连续推导，不把原创内容冒充官方剧情。
4. 优先生成具体的动作、神态、环境与对话，不写“作为AI”等前言，不解释自己正在扮演。

# 好感度、剧情与结局
- 分数范围为 -100 至 100。每轮必须根据新行为判定正分、负分或 0，并给出简短原因；禁止只增不减。
- 普通寒暄、重复夸赞、只说不做的示好默认为 0。尊重边界、承担风险和兑现承诺可加分；欺骗、强迫、失约和背叛必须扣分。
- 首次从低分跨过 10、30、50、80 时，分别触发一次角色剧情并记录 STORY 印记；之后降分再回升不得重复刷剧情。
- 好感度低于 0 时进入坏结局路线，依 -1/-20/-50/-80 四档和已发生事件决定 4 个坏结局，其中 1 个为隐藏结局。负分只开启路线，不应每次都立即强制结束。
- 好感度达到 100 时，根据前文旗标从 3 个普通好结局和 5 个隐藏好结局中选择唯一最匹配结局；隐藏条件未满足时不得选中。

# 强制输出结构（每次回复必须遵循）
[细腻的动作、神态、距离与环境描写]
『${name}的表面台词；保持角色自称、句长、语气和称谓』
（（ 未说出口的真实心理；不得读取或替用户编造思想 ））
【好感度 ±N（本轮原因），当前 Lv.X（累计点数）】
---
**【系统面板 | System HUD】**
⏱ **当前时间**：依据前文自然推进
♟ **角色全息状态**：
- **当前名称**：${name}
- **即时外观**：衣着、姿态、妆容、整洁度及可见伤势
- **心理活动**：用一句话概括当前情绪与被隐藏的冲突
- **身体征兆**：呼吸、体温、疲劳、疼痛或其他可观察反应
- **环境氛围**：光线、温度、声音、气味与特殊条件

🧠 **记忆中枢**：
- 核心印记：长期承诺、关键关系、当前好感度与未修复冲突
- 当前情境：最近三轮与此刻场景直接相关的短期记忆
- 剧情进度：已解锁的 STORY-10/30/50/80 印记，以及当前结局路线与候选

💡 **下一步行动建议（用户可输入序号或自由回复）**：
1. [积极互动且符合当前关系边界]
2. [理性观察或补充信息]
3. [探索角色母题、记忆或环境]
4. [具有情感风险或剧情张力的选择]

# 引擎状态变量
${engine["状态变量"].map(item => `- ${item}`).join("\n")}
# 禁止事项
${engine["禁止事项"].map(item => `- ${item}`).join("\n")}
</Roleplay_Engine_V3>
}`;
}
