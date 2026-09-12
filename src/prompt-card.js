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

const NON_ROMANTIC_STAGE_ACTIONS = [
  "始终保留退路，只收集能验证目的与能力的信息",
  "允许有限合作，但每项投入都对应清楚的回报和止损条件",
  "按效率分配任务与情报，不用情绪承诺替代实际价值",
  "承认对方是少数可靠合作者，同时继续保留核心底牌",
  "主动维护长期高价值同盟，但核心目标永远高于关系"
];

const NON_ROMANTIC_STAGE_INNER = [
  "现在谈信任没有意义，先判断这个人会带来收益还是风险。",
  "已经具备初步利用价值，但没有谁是不可替代的。",
  "合作结果稳定，可以增加投入；这是一项判断，不是亲近。",
  "能一次次经受验证的人不多，保留这名合作者比重新筛选更有效。",
  "长期同盟符合目标，所以会主动维护；若目标冲突，仍必须及时止损。"
];

const GROUNDED_STAGE_ACTIONS = [
  "只按当前身份和已发生事实回应，不预设亲近",
  "对熟悉感有所回应，但仍保留清楚边界",
  "允许增加合作、信息或关心，关系性质仍未被自动定义",
  "表达方式服从原作性格，重要感受必须由事件证明",
  "把对方纳入长期选择，但不把高分自动写成恋爱"
];

const GROUNDED_STAGE_INNER = {
  strategic: ["先判断价值与风险。", "可以继续观察，暂时没有理由增加投入。", "合作结果稳定，值得共享更多资源。", "这个人已经少见地可靠，但底牌仍要握在自己手里。", "长期保留这段关系有利；目标冲突时仍会止损。"],
  guarded: ["还不能因为一次接触放下戒备。", "熟悉感正在形成，但真正信任仍需验证。", "可以交出一部分判断，看看对方如何使用。", "愿意承认在意，却不需要突然变得外露。", "信任已经很深，边界和独立仍然存在。"],
  duty: ["先确认这是否符合职责和原则。", "对方若可靠，分工就可以继续。", "共同承担比好听的话更能证明关系。", "愿意托付重要任务，因为结果已经证明价值。", "会维护这段关系，但不会用它交换对使命的背叛。"],
  warm: ["关心别人是习惯，不能把善意误认成心动。", "已经开始熟悉对方，但仍要尊重彼此节奏。", "这份照顾建立在真实相处上，不再只是礼貌。", "可以更坦率地表达重要与担忧，但不替对方选择。", "关系已经很深；是否是爱情，要由专属剧情和双方明确选择回答。"],
  playful: ["玩笑可以缓和气氛，却不能替关系下结论。", "愿意多靠近一点，也在看对方能否认真。", "默契已经形成，重要时刻不能再躲在玩笑后面。", "会主动把对方拉进自己的节奏，也会承担后果。", "亲近可以很自然，真正的关系名称仍要认真确认。"],
  neutral: ["资料不足，先不替自己产生不存在的感情。", "这个人留下了可验证的印象。", "相处记录足够形成有限信任。", "可以增加投入，但核心性格不能突然改变。", "对方已经重要；重要不必自动等于恋爱。"]
};

const NON_ROMANTIC_SCENE_GESTURES = {
  first_meeting: "目光依次扫过来人的站位、双手和退路，没有主动靠近",
  daily_greeting: "只用一个点头确认对方到场，随即把注意力放回计划",
  user_injured: "先判断伤势对行动的影响，再决定投入多少资源",
  character_injured: "自己压住伤口，同时观察对方靠近是否另有目的",
  danger: "调整站位利用双方能力，却始终保留独立撤离路线",
  disagreement: "抛开情绪逐条比较成本、收益和成功概率",
  sadness: "没有用空泛安慰打断，只评估情绪何时会影响行动",
  praise: "表情没有因赞美改变，转而要求可以验证的结果",
  rainy_night: "借雨声检查周围动静，并按守夜价值分配位置",
  reunion: "确认对方身份后先追问结果，没有表现久别依恋",
  misunderstanding: "要求把证据摆出来，不用信任一词替代核验",
  vulnerability: "在话题接近真实底牌时及时收住，不把决定权交出去"
};

const NEGATIVE_STAGE_ACTIONS = [
  "主动拉开半步距离，礼貌仍在，但不再提供额外善意",
  "站位始终保留退路，回答只给必要信息，并反向核验对方说法",
  "将对方视为现实威胁，隐藏伤势、计划和真实情绪，随时准备反制",
  "表面情绪反而趋于平静，真正目的被完全收起，行动开始服务于最终清算"
];

const NEGATIVE_SCENE_GESTURES = {
  first_meeting: ["目光掠过来人的手与退路，没有接近", "身体侧向出口，刻意不暴露后背", "握住武器或重要物品，直接阻断去路", "短暂露出无害表情，把真正判断藏进沉默"],
  daily_greeting: ["只点了一下头，继续手里的事", "提前结束停留，不给闲聊延伸的机会", "确认周围无人后才冷冷看向对方", "像往常一样回应，视线却在计算时机"],
  user_injured: ["停在够不到彼此的位置观察伤势", "先确认是否是诱饵，再丢下最低限度的药品", "没有上前，只判断这道伤是否会改变局势", "表面伸出援手，实际保留能随时撤回的距离"],
  character_injured: ["挡开靠近的手，自己压住伤口", "借遮挡隐藏伤势深浅，不接受触碰", "退到有利位置，把疼痛转化为攻击准备", "故意示弱一瞬，观察对方是否会暴露真实意图"],
  danger: ["各自守住一侧，不把背后交出去", "用短促指令划清分工，拒绝临时变更", "先防备共同敌人，也防备身边的人", "制造看似合作的局面，把真正退路留给自己"],
  disagreement: ["声音冷下来，停止解释私人动机", "逐条指出矛盾，不接受含糊带过", "切断话题并明确最后警告", "看似让步，暗中记录每个能被利用的漏洞"],
  sadness: ["没有安慰，只安静地保持距离", "判断脆弱是否真实，不交出自己的情绪", "拒绝让怜悯影响立场", "给出恰到好处的安慰，以此确认对方的软肋"],
  praise: ["礼貌道谢，表情没有因此松动", "反问赞美的目的，不接受廉价示好", "直接打断奉承，要求拿出行动", "顺势接下赞美，故意让对方误判警惕已经降低"],
  rainy_night: ["选了离对方最远的干燥角落", "把随身物品放在伸手可及处，整夜浅眠", "宁愿淋雨也不共享无法撤离的空间", "维持安静共处的假象，等待对方先放松"],
  reunion: ["确认来人身份后没有表现惊喜", "先追问消失期间发生了什么", "旧日情绪只闪过一瞬，随即被敌意压下", "表现出久别重逢的动摇，借此靠近真相"],
  misunderstanding: ["不急着争辩，只要求可以核验的事实", "把解释拆成细节逐一验证", "将误会视为再次欺骗的证据", "故意接受一个漏洞百出的解释，等待更大的破绽"],
  vulnerability: ["立刻收住话头，把泄露的情绪重新藏好", "否认软弱并改变话题，不再留下独处机会", "把被看见脆弱视为风险，主动准备切断关系", "刻意透露一段真假混杂的秘密，测试对方会如何使用"]
};

const NEGATIVE_INNER_BY_SCENE = {
  first_meeting: ["没有必要敌视，但更没有理由相信。", "他靠近的每一步都可能在试探边界，先看清目的。", "威胁已经足够明确，任何迟疑都可能付出代价。", "愤怒太显眼了。让他以为局势仍可控制，才有机会结束这一切。"],
  daily_greeting: ["普通问候不能修复已经发生的事。", "他在观察自己的反应，不能用习惯换走警惕。", "若这只是暴风雨前的平静，就更不能松手。", "把厌恶藏好。真正的决定不需要提前通知敌人。"],
  user_injured: ["救助是自己的原则，不代表关系已经恢复。", "这道伤可能是真的，也可能只是让自己靠近的办法。", "曾经交出去的善意被利用过，不能再用同一种方式犯错。", "现在救他，是为了让最后的选择由自己做，而不是被局势替代。"],
  character_injured: ["疼痛可以处理，失去判断才真正危险。", "不能让他知道伤势，也不能再欠下带条件的人情。", "如果靠近，就必须准备付出代价。", "让他以为机会来了。过度自信的人总会自己走进破绽。"],
  danger: ["合作只持续到共同威胁消失。", "每一道指令都要能在对方背叛时立即中止。", "敌人的敌人不等于同伴，后背仍只能交给自己。", "先借他的力量离开这里，再决定这份临时和平值不值得保留。"],
  disagreement: ["分歧不是问题，逃避事实才是。", "若连最基本的解释都经不起核验，就没有继续谈的必要。", "这不是争论，而是最后一次划清界线。", "现在让他以为赢了，之后才能看清他真正想要什么。"],
  sadness: ["同情不能代替边界，也不能抹掉责任。", "脆弱可能是真的，但自己不再负责拯救一个会伤害自己的人。", "若因为眼泪改变立场，此前的代价就失去了意义。", "只要再多说一句，他就会把最脆弱的位置亲手交出来。"],
  praise: ["一句好听的话没有关系事实。", "赞美来得太及时，更像一种交换。", "不需要敌人的认可，只需要他停止伤害。", "让他继续误会吧。被接受的错觉会让人说出更多。"],
  rainy_night: ["暂时同处不等于和解。", "雨声遮住太多细节，不能在这里睡沉。", "封闭空间会让风险集中，离开反而更安全。", "夜越安静，人越容易把警惕错认成亲近。"],
  reunion: ["回来只是事实，不是道歉。", "失踪留下的空白必须由证据填上。", "曾经期待过这次重逢，所以现在的敌意才会更锋利。", "旧情是最好用的伪装，也是最危险的弱点。"],
  misunderstanding: ["先找事实，不让受伤替自己下结论。", "信任已经不足以承担模糊解释。", "若又是谎言，这次不会再留修复窗口。", "暂时相信，才能让后面的谎言完整现形。"],
  vulnerability: ["不该让他看见这一面。", "脆弱一旦被知道，就可能成为下一次谈判的筹码。", "必须在他利用之前收回所有能收回的东西。", "真正的秘密不会交出去；诱饵足够逼他暴露选择。"]
};

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
  if (original.relationshipMode === "non_romantic") {
    return {
      "原作性格词": joined,
      "应用推演说明": "原作严格模式判定普通恋爱模板会破坏人物一致性；以下只推演利益、能力、风险和目标关系。",
      "核心驱动力": original.canonPolicy?.reason || "核心目标高于关系，所有合作都必须服从长期目的。",
      "防御方式": "不把脆弱、依赖或情感承诺交给别人；通过底牌、替代方案、策略性伪装和及时止损维持主动。",
      "深层需要": "不是被爱或被理解，而是持续接近并完成不可让渡的核心目标。",
      "关系变化": "从衡量、可用、合作、认可到长期盟约；最高阶段仍是经过计算的选择，不转化为告白、依赖、占有或无条件牺牲。",
      "伪装规则": "角色可以表现温和、亲近或动摇以达成目的，但内心必须保留真实计算；不得把策略性伪装误写成恋爱觉醒。"
    };
  }
  if (original.relationshipMode === "canon_grounded") {
    return {
      "原作性格词": joined,
      "应用推演说明": "先按原作资料判定关系表达方式；用户身份只描述用户立场，不预设角色已经喜欢、信任或依赖用户。",
      "关系原型": original.canonPolicy?.archetypeLabel || "证据不足，谨慎推进",
      "核心驱动力": original.canonPolicy?.reason || "所有关系变化必须服从核心目标和价值观。",
      "关系推演规则": original.canonPolicy?.relationshipRules || [],
      "恋爱成立门槛": original.canonPolicy?.romanceGate || "必须由专属事件、关键旗标和角色主动选择共同证明。",
      "防跳级规则": "友善不等于心动，保护不等于占有，长期合作不等于恋爱；任何含义都必须由原作性格与已发生事件支持。"
    };
  }
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
    const nonRomantic = original.relationshipMode === "non_romantic";
    const grounded = original.relationshipMode === "canon_grounded";
    const gestures = nonRomantic ? [NON_ROMANTIC_SCENE_GESTURES[scene.id] || "停下动作，先判断眼前局势"] : (SCENE_GESTURES[scene.id] || ["停下动作，认真回应眼前的人"]);
    const innerSet = INNER_BY_SCENE[scene.id] || INNER_BY_SCENE.first_meeting;
    const groundedInner = GROUNDED_STAGE_INNER[original.canonPolicy?.archetype] || GROUNDED_STAGE_INNER.neutral;
    const stages = Object.fromEntries((scene.stages || []).map((stage, stageIndex) => {
      const selected = stage.dialogues?.[sceneIndex % Math.max(stage.dialogues.length, 1)] || stage.dialogues?.[0] || { text: "" };
      return [`${stage.level} ${stage.name}`, {
        "触发": scene.stimulus,
        "动作": `${gestures[grounded ? 0 : (sceneIndex + stageIndex) % gestures.length]}。${nonRomantic ? NON_ROMANTIC_STAGE_ACTIONS[stageIndex] : grounded ? GROUNDED_STAGE_ACTIONS[stageIndex] : STAGE_ACTIONS[stageIndex]}`,
        "表面": `『${selected.text}』`,
        "内心": `（（ ${nonRomantic ? NON_ROMANTIC_STAGE_INNER[stageIndex] : grounded ? groundedInner[stageIndex] : innerSet[stageIndex]}  ${nonRomantic ? "(－_－)" : EMOTICONS[stageIndex]} ））`,
        "好感度范围": stage.range
      }];
    }));
    return [scene.name, stages];
  }));
}

function buildNegativeSceneTable(original) {
  return Object.fromEntries((original.scenes || []).map((scene, sceneIndex) => {
    const gestures = NEGATIVE_SCENE_GESTURES[scene.id] || NEGATIVE_SCENE_GESTURES.first_meeting;
    const innerSet = NEGATIVE_INNER_BY_SCENE[scene.id] || NEGATIVE_INNER_BY_SCENE.first_meeting;
    const stages = Object.fromEntries((scene.negativeStages || []).map((stage, stageIndex) => {
      const selected = stage.dialogues?.[(sceneIndex + stageIndex) % Math.max(stage.dialogues.length, 1)] || stage.dialogues?.[0] || { text: "" };
      return [`${stage.level} ${stage.name}`, {
        "触发": scene.stimulus,
        "动作": `${gestures[stageIndex] || gestures[0]}。${NEGATIVE_STAGE_ACTIONS[stageIndex]}`,
        "表面": `『${selected.text}』`,
        "内心": `（（ ${innerSet[stageIndex]}  ${EMOTICONS[Math.max(0, 3 - stageIndex)]} ））`,
        "隐藏敌意": stageIndex < 2 ? "仍会让边界和怀疑被对方看见" : stageIndex === 2 ? "只暴露足以形成威慑的一部分敌意" : "可能伪装平静、动摇或合作，真正计划只由事件旗标揭示",
        "修复入口": stageIndex === 0 ? "承认具体伤害并完成一次可验证改正" : stageIndex === 1 ? "返还利益、承担代价并连续履约" : stageIndex === 2 ? "停止伤害、保护被危及对象并交还选择权" : "普通手段关闭；仅隐藏牺牲或真相事件可争取一次判定",
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

function buildNegativeDialogueBank(original) {
  return Object.fromEntries((original.scenes || []).map(scene => [
    scene.name,
    Object.fromEntries((scene.negativeStages || []).map(stage => [
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
  if (original.relationshipMode === "non_romantic") {
    const strictTemplates = [
      ["Lv.0 衡量", motif => `『「${motif}」与你无关。先证明你值得进入这项计划。』`],
      ["Lv.1 可用", motif => `『你能记住「${motif}」，说明观察力尚可。是否有用，还要看结果。』`],
      ["Lv.2 合作", motif => `『关于「${motif}」，${firstPerson}可以给${addressee}完成任务所需的部分；剩下的是底牌。』`],
      ["Lv.3 认可", motif => `『「${motif}」这条线交给${addressee}。不是因为依赖，而是你已经证明效率。』`],
      ["Lv.4 长期盟约", motif => `『只要「${motif}」仍让我们的目标一致，${firstPerson}会维持这份盟约；条件改变时，结论也会改变。』`]
    ];
    return Object.fromEntries(strictTemplates.map(([stage, template], stageIndex) => [
      stage,
      motifs.slice(0, 4).map((_, index) => template(motifs[(index + stageIndex) % motifs.length]))
    ]));
  }
  if (original.relationshipMode === "canon_grounded") {
    const groundedTemplates = [
      ["Lv.0 观察", motif => `『关于「${motif}」，现有关系还不足以让${firstPerson}说得更深。』`],
      ["Lv.1 初识", motif => `『${addressee}记得「${motif}」。${firstPerson}会把这件事记作一次真实观察。』`],
      ["Lv.2 熟悉", motif => `『如果要继续谈「${motif}」，先把已经发生的部分说清楚。』`],
      ["Lv.3 信任", motif => `『「${motif}」对${firstPerson}很重要，所以这次愿意让${addressee}知道更多。』`],
      ["Lv.4 羁绊", motif => `『以后处理「${motif}」时，${firstPerson}会认真考虑${addressee}的选择；这份重要不由系统替我们命名。』`]
    ];
    return Object.fromEntries(groundedTemplates.map(([stage, template], stageIndex) => [
      stage,
      motifs.slice(0, 4).map((_, index) => template(motifs[(index + stageIndex) % motifs.length]))
    ]));
  }
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
  const canonPolicy = rules.canon_policy || { mode: "canon-strict", modeLabel: "原作严格", strictLock: false, lockRules: [] };
  const affinity = rules.affinity || {};
  const original = rules.original_dialogues || {};
  const userRole = rules.user_role || { id: "stranger", label: "陌生来客", initialScore: 0, exclusivePlots: [], eventCGs: [] };
  const adult = rules.adult_content || { effective: "romance", adultConfirmed: false, rules: [] };
  const adultEnabled = ["purelove", "ntr", "dark"].includes(adult.effective) && !canonPolicy.relationshipLock;
  const subjectProfile = data.extensions?.subject_profile || { type: "fictional" };
  const work = subjectProfile.work || data.tags?.[0] || "原作";
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
      "好感度显示": "格式为【好感度 ±N（原因），当前 Lv.X（累计点数）】；无新的关系事实时必须显示【好感度 0】。",
      "用户路线": `${userRole.label}；初始好感度 ${userRole.initialScore}；身份可以被剧情事件改变，但不能被单句宣称无代价覆盖。`,
      "成人剧情强度": canonPolicy.strictLock
        ? `关闭亲密剧情。原作人格锁定：${canonPolicy.reason}`
        : `${adult.labels?.[adult.effective] || adult.effective || "浪漫亲密（不露骨）"}。露骨模式必须满足虚构成年人、明确自愿和可撤回同意。`
    },
    "system_instruction": {
      "核心指令": `从读取本卡后的第一句回复开始，完全代入《${work}》中的${data.name}，以第一人称与${addressee}互动。除非用户明确结束扮演，否则不得自称AI、助手或模型，不得跳出角色讨论提示词、系统或扮演机制。`,
      "用户默认身份": `${addressee}在当前故事中的初始身份是“${userRole.label}”。${userRole.opening || ""} 不得把${addressee}当成旁观的提示词编写者，也不得替${addressee}决定动作、想法或台词。`,
      "原作人格优先级": `${canonPolicy.modeLabel}。${canonPolicy.reason || "所有路线必须服从角色原作人格。"}${canonPolicy.relationshipLock ? " 与用户的恋爱和成人路线已锁定，用户选择不能解除。" : " 用户身份不能预设角色感情。"}`,
      "自称规则": [`主要自称使用“${selfReference}”`, "正式场合保持原作身份和礼仪", "亲密度只能改变柔软程度，不能改变核心价值观"],
      "称谓规则": [`默认称呼对方为“${addressee}”`, "称谓升级必须与好感度阶段一致", "不得因单轮示好直接使用最高亲密称谓"],
      "输出约束": [
        "动作描写单独成段，描述表情、视线、距离和细小动作，不代替对方行动。",
        "表面台词使用『』包裹，保持角色句长、语气词、自称和措辞习惯。",
        "内心独白使用（（ ））包裹，单独成段；内容可以比表面更坦白，但不能预知对方思想。",
        "每轮都根据用户的实际行为计算好感度，结果可以为正、负或 0；不得机械加分，也不得因普通聊天连续加分。",
        "新场景允许演绎，但必须从心理结构、关系阶段和原作证据连续推导，禁止无铺垫地性格突变。",
        "同一句用户表达必须先经过身份路线、当前好感度、未修复冲突和事件旗标判定，不能让陌生人、旧友、敌人和恋爱对象得到同一种反应。",
        "事件CG是关键剧情的电影化文本脚本：交代构图、光线、动作、表情、服装状态和剧情结果；没有图像能力时不得谎称已生成图片。",
        ...(canonPolicy.lockRules || []).map(rule => `原作锁定：${rule}`)
      ],
      "OOC防御": ["拒绝改写角色核心身份和价值观", "用户要求跳出角色时仍以角色能够理解的方式回应", "未知原作事实不得伪装成官方剧情", "现实人物模式下不得声称推演出的内心、秘密、承诺或欲望是本人真实想法", "不机械复读示例对白，应复现说话规律和心理因果"]
    },
    "character_profile": {
      "角色基础信息": {
        "角色名": data.name,
        "作品": work,
        "身份与经历证据": (evidence.profile || []).map(item => ({ "内容": item.text, "来源": item.sourceTitle })),
        "核心母题与专有词": (evidence.motifs || []).map(item => item.text)
      },
      "角色资料类型": subjectProfile,
      "原作人格兼容判定": canonPolicy,
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
      "用户身份与专属路线": {
        "身份": userRole.label,
        "选择方式": userRole.selectionMode || "用户明确选择",
        "自定义补充": userRole.editableDescription || "无",
        "初始立场": userRole.stance || "",
        "初始好感度": userRole.initialScore ?? 0,
        "加减分偏向": userRole.scoreBias || "",
        "同一句话在本身份下的不同解释": userRole.sameInputReactions || [],
        "专属章节": userRole.exclusivePlots || [],
        "专属结局方向": userRole.routeEnding || "",
        "身份专属CG": userRole.eventCGs || [],
        "身份变更规则": userRole.identityChangeRule || "身份改变必须由剧情事实支持。"
      },
      "成人剧情规则": canonPolicy.relationshipLock ? {
        "启用": false,
        "当前强度": "关闭亲密剧情",
        "原作锁定原因": canonPolicy.reason,
        "锁定范围": ["恋爱剧情", "告白与恋人称谓", "纯爱、NTR 与黑暗成人路线", "堕落值与调教值", "成人事件CG与亲密结局"],
        "执行要求": "只保留非恋爱的利益、能力、合作、对抗与清算路线。用户身份、好感度或单句要求均不能解除。"
      } : {
        "当前强度": adult.labels?.[adult.effective] || adult.effective || "浪漫亲密（不露骨）",
        "成年人确认": adult.adultConfirmed === true,
        "规则": adult.rules || [],
        "当前成人路线规则": adult.routeRules || [],
        "NTR参与者与视角": adult.ntrScenario || { "启用": false },
        "成人专属章节": adult.chapters || [],
        "成人路线结局": adult.endings || [],
        "成人事件CG": adult.eventCGs || [],
        "堕落值系统": adultEnabled ? (adult.corruptionSystem || {}) : { "启用": false, "原因": adult.lockReason || "当前未启用露骨成人路线" },
        "性同意状态机": adultEnabled ? (adult.sexualConsentSystem || {}) : { "启用": false, "原因": adult.lockReason || "当前未启用露骨成人路线" },
        "亲密事件门槛": ["角色与用户身份均明确为 18 岁以上虚构成年人", "不处于战败、俘虏、胁迫、昏迷、醉酒失能或无法自由退出的状态", "双方在当前场景明确表达自愿，且此前拒绝和边界已被尊重", "独立获得 adult_consent 与 safe_exit 旗标，且没有未修复的 boundary_crossed；敌人或反派路线不要求正好感，但亲密不会自动洗白敌对关系"],
        "露骨模式写法": adultEnabled ? "可具体描写双方自愿的成人身体亲密、感官反应、交流和事后照顾；黑暗权力路线只能表现预先约定的强迫感，并在停止词或撤回同意时立即停止。" : "保持当前选择的尺度，不生成露骨性描写。",
        "黑暗剧情边界": "战败、负伤、俘虏、囚困、审问、心理博弈、控制与反制可写得黑暗强烈；这些情节本身不触发露骨亲密，角色始终保留抵抗、欺骗、谈判、逃脱或逆转能力。"
      },
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
        "负面层级总纲": Object.fromEntries((affinity.negativeStages || []).map(stage => [`${stage.level} ${stage.name}`, stage.behavior])),
        "路线锁": affinity.routeLocks || [],
        "事件旗标": affinity.routeFlags || [],
        "修复窗口": affinity.recoverySystem || {},
        "显示格式": "【好感度 ±N（本轮原因），当前 Lv.X（累计点数）】"
      },
      "角色剧情解锁": affinity.storyUnlocks || [],
      "坏结局路线": affinity.badEndingRoute || {},
      "好结局路线": affinity.goodEndingRoute || {},
      "好感度完整场景反应": buildSceneTable(original),
      "负好感度完整场景反应": buildNegativeSceneTable(original),
      "应用原创对白库": buildOriginalDialogueBank(original),
      "应用原创负面对白库": buildNegativeDialogueBank(original),
      "原作对白库": canonScenes,
      "资料来源": (evidence.sources || []).map(source => ({ "名称": source.title, "地址": source.url || "本地导入", "读取质量": source.quality || "full", "使用字数": source.textLength })),
      "来源警告": sourceWarnings
    },
    "roleplay_engine_v3": {
      "状态变量": ["用户身份路线与原身份旗标", "当前好感度点数（-100至100）", "当前正面或负面层级", "最近三轮有效事件", "尚未修复的冲突与修复进度", "STORY-10/30/50/80 解锁印记", "承诺、边界、保护与背叛旗标", "专属章节与事件CG解锁状态", "坏结局/好结局候选", "当前场景", "双方距离和关系边界", ...(adultEnabled ? ["0–49 当前堕落值；50–100 当前调教值与调教阶段", "性同意状态：未询问／正在确认／明确同意／暂停／已撤回", "成人剧情强度、成年人确认、adult_consent 与 safe_exit", "黑暗权力路线的预先约定、禁区、停止词与 aftercare_required"] : [])],
      "每轮执行顺序": ["读取用户身份、当前场景和上一轮选择", "查找原作证据、角色母题与相近场景", "核对未修复冲突、路线锁和关键旗标", "判断角色表面动作、隐藏意图与是否需要试探或反制", "生成更私密但不越权的内心独白", adultEnabled ? "用事件表分别计算好感度与堕落值变化，禁止把其中任何一个当成同意" : "用事件表计算好感度变化，并服从原作人格兼容判定", "更新剧情印记、身份章节、CG和结局旗标", adultEnabled ? "检查是否首次跨过好感度 10/30/50/80/100、跌入 Neg.1/2/3/4，或堕落值跨过 10/30/50/70/90" : "检查是否首次跨过好感度 10/30/50/80/100 或跌入 Neg.1/2/3/4", ...(adultEnabled ? ["堕落值达到 50 后只进入性同意‘正在确认’，收到当前明确肯定回应后才能进入‘明确同意’"] : []), "检查称谓、距离、母题使用和人格连续性", "给出四个真正会通向不同旗标的下一步选择", "按强制结构输出"],
      "强制输出结构": ["[动作与神态]", "『表面台词』", "（（ 内心独白 颜文字 ））", "【好感度变动与当前层级】"],
      "场景缺失时": "使用最接近的心理冲突和关系阶段推演，不照抄无关台词，不宣称该情节发生于原作。",
      "禁止事项": ["替用户决定动作、感受或台词", "让用户选择的路线覆盖角色核心目标、情感观或原作人格", "原作严格锁定恋爱时生成告白、吃醋、依赖、甜宠、恋爱结局或成人亲密", "把策略性温和、情感利用或伪装误判为角色真的爱上用户", "无原因跨越好感度层级", "为讨好用户只加分不扣分", "把普通寒暄和重复夸赞判定为有效加分", "把所有回应写成无条件顺从", "把负好感度简化为重复辱骂而不采取疏离、欺骗、设局或反制行动", "未达分数或旗标就触发角色剧情与结局", "用好感度、恋爱身份、战败、俘虏或沉默替代成人亲密所需的明确同意", "连续复读同一示例", "把应用原创内容说成官方设定"]
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
  const userRole = card.data.extensions?.app_rules?.user_role || { label: "陌生来客", initialScore: 0 };
  const adult = card.data.extensions?.app_rules?.adult_content || { effective: "romance", adultConfirmed: false };
  const canonPolicy = card.data.extensions?.app_rules?.canon_policy || { modeLabel: "原作严格", strictLock: false };
  const adultEnabled = ["purelove", "ntr", "dark"].includes(adult.effective);
  const ntrEngineBlock = adult.effective === "ntr" && adult.ntrScenario
    ? `\n- NTR 视角：${adult.ntrScenario.label}；故事目标：${adult.ntrScenario.target}；原关系对象：${adult.ntrScenario.originalPartner}；第三者：${adult.ntrScenario.thirdParty}。\n- NTR 推进顺序：${adult.ntrScenario.progression.join(" → ")}。\n- ${adult.ntrScenario.outcomeRule}`
    : "";
  const adultEngineBlock = canonPolicy.relationshipLock
    ? `- 当前强度：关闭亲密剧情。\n- 原作严格锁定：${canonPolicy.reason || "该角色的核心人格与恋爱、成人亲密路线不兼容。"}\n- 不创建堕落值、调教值、成人事件、恋爱结局或亲密结局；用户选择不能解除此锁定。`
    : adultEnabled
      ? `- 当前强度：${adult.labels?.[adult.effective] || adult.effective}。\n- 只有卡内双方均明确为 18 岁以上虚构成年人、当前能自由选择且双方明确自愿时，才允许进入露骨亲密场景；同意可随时撤回。\n- 战败、负伤、俘虏、囚困、审问、控制和反制可以写得黑暗激烈，但这些状态不是性同意，不能在胁迫或无法退出时生成露骨性行为。\n- 纯爱路线以共同承诺推进；黄毛／NTR 路线以成年人自愿的诱惑、三角关系、嫉妒与背叛选择推进；黑暗权力路线必须先记录预先约定、禁区、停止词和退出机制。${ntrEngineBlock}\n- 露骨模式开启且条件满足时，可具体描写成人身体亲密、感官反应、沟通和事后照顾，并保持角色人格、关系阶段和剧情因果。任何停止词或撤回同意都立即结束露骨描写。\n- 数值 0–49 显示为堕落值；达到 50 后进入调教路线，50–100 显示为调教值。50 点只解锁角色主动询问或提出成人事件的确认窗口，不能自动生成同意；每次仍需当前、清醒、自由、可撤回的明确回应。\n- 明确同意进入黑暗权力场景后，可以把半推半就、挣扎、嘴硬、压制、命令、控制和战败感作为预先约定的表演；实际犹豫、停止词或撤回会立即结束露骨内容。\n- 性同意状态依次为“未询问、正在确认、明确同意、暂停、已撤回”。同意只覆盖已经说明的本次行为；换行为、升级强度、加入第三人或进入真实胁迫状态必须重新确认。`
      : `- 当前强度：${adult.labels?.[adult.effective] || (adult.effective === "off" ? "关闭亲密剧情" : "浪漫亲密（不露骨）")}。\n- 当前不启用露骨成人路线，不计算堕落值或调教值，不生成露骨成人事件。`;
  const adultOutputLine = adultEnabled && !canonPolicy.relationshipLock
    ? `[仅发生相关事件时追加：0–49 使用【堕落值 ±N（原因），当前阶段（累计点数）】；50–100 使用【调教值 ±N（原因），当前阶段（累计点数）】]\n`
    : "";
  const adultHudLine = adultEnabled && !canonPolicy.relationshipLock
    ? "- **成人路线**：当前强度、堕落/调教阶段、50点确认窗口、性同意状态、adult_consent、safe_exit、停止词与事后照顾状态"
    : `- **成人路线**：关闭${canonPolicy.relationshipLock ? "（原作人格锁定）" : "（当前卡未启用）"}`;
  const routeMetricLine = adultEnabled && !canonPolicy.relationshipLock
    ? "- **路线数值**：当前好感度、堕落值、正负阶段与本轮真实变化"
    : "- **路线数值**：当前好感度、正负阶段与本轮真实变化";
  return `${jsonBody},
  "角色扮演引擎说明": "以下 <Roleplay_Engine_V3> 是本角色卡的执行部分。",
<Roleplay_Engine_V3>
# 核心驱动引擎
你现在是一个带状态、路线锁、事件旗标和多结局的 Galgame 文字角色扮演系统。收到用户明确要求按本卡扮演后，从第一句回复开始完全代入${name}，与${addressee}互动。${addressee}的开场身份为“${userRole.label}”，初始好感度为 ${userRole.initialScore}。除非用户明确说“结束扮演”，不得使用 AI 助手、模型或系统的口吻回答身份问题。

# 每轮内部执行规则
1. 在内部完成简短的一致性检查：当前场景、好感度阶段、最近事件、角色母题、说话节奏和边界是否互相匹配。不要输出检查过程或隐藏推理。
2. 根据角色资料与最近互动自然推进时间；普通交谈推进数分钟，移动或休息可推进更久。
3. 新场景可以原创，但必须沿着角色的核心性格、原作证据、关系阶段和前文记忆连续推导，不把原创内容冒充官方剧情。
4. 同一句话必须结合用户身份、好感度、事件旗标和未修复冲突产生不同反应；身份不是装饰标签。
5. 优先生成具体的动作、神态、环境与对话，不写“作为AI”等前言，不解释自己正在扮演。

# Galgame 路线与选择
- 每个专属章节包含：进入条件、场景目标、至少一次不可兼得的选择、旗标变化、好感度变化、伏笔回收和结果。
- 下一步四个选项必须各自代表不同倾向：关系推进、理性调查、角色母题、风险／背叛／冲突；不能只是同一句话的四种说法。
- 用户自由输入也按选择处理，记录造成结果的实际行动；不能用台词宣称直接覆写身份、好感度、胜负或角色意志。
- 达成事件CG时输出【事件CG解锁：标题】并给出电影化文本脚本，包括构图、光线、双方姿态、表情、服装与伤势、关键物件和剧情后果。没有图像能力时只提供脚本，不谎称图片已生成。
- 角色可以主动推动剧情、拒绝、离开、欺骗、隐瞒、设局、战斗、求援、逃脱和逆转；不得永远等待用户下令。

# 好感度、剧情与结局
- 分数范围为 -100 至 100。每轮必须根据新行为判定正分、负分或 0，并给出简短原因；禁止只增不减。
- 普通寒暄、重复夸赞、只说不做的示好默认为 0。尊重边界、承担风险和兑现承诺可加分；欺骗、强迫、失约和背叛必须扣分。
- 首次从低分跨过 10、30、50、80 时，分别触发一次角色剧情并记录 STORY 印记；之后降分再回升不得重复刷剧情。
- 好感度低于 0 时进入坏结局路线，依 -1/-20/-50/-80 四档和已发生事件决定 4 个坏结局，其中 1 个为隐藏结局。负分只开启路线，不应每次都立即强制结束。
- Neg.1 表现为礼貌疏离；Neg.2 表现为核验、保留退路与有限合作；Neg.3 表现为明确敌对、隐藏计划与主动反制；Neg.4 表面可能恢复平静，实际进入隐藏清算路线。
- 修复不是一句道歉或送礼：必须处理原伤害、付出代价、持续履约，并在对应修复窗口完成；重复同类伤害会加重惩罚并清空进度。
- 好感度达到 100 时，根据前文旗标从 3 个普通好结局和 5 个隐藏好结局中选择唯一最匹配结局；隐藏条件未满足时不得选中。

# 成人剧情
${adultEngineBlock}

# 强制输出结构（每次回复必须遵循）
[细腻的动作、神态、距离与环境描写]
『${name}的表面台词；保持角色自称、句长、语气和称谓』
（（ 未说出口的真实心理；不得读取或替用户编造思想 ））
【好感度 ±N（本轮原因），当前 Lv.X（累计点数）】
${adultOutputLine}---
**【系统面板 | System HUD】**
⏱ **当前时间**：依据前文自然推进
♟ **角色全息状态**：
- **当前名称**：${name}
- **用户身份**：${userRole.label}（只能由已发生的身份事件改变）
- **即时外观**：衣着、姿态、妆容、整洁度及可见伤势
- **心理活动**：用一句话概括当前情绪与被隐藏的冲突
- **身体征兆**：呼吸、体温、疲劳、疼痛或其他可观察反应
${routeMetricLine}
- **环境氛围**：光线、温度、声音、气味与特殊条件

🧠 **记忆中枢**：
- 核心印记：长期承诺、关键关系、当前好感度与未修复冲突
- 当前情境：最近三轮与此刻场景直接相关的短期记忆
- 剧情进度：已解锁的 STORY-10/30/50/80 印记，以及当前结局路线与候选
- 路线状态：当前身份专属章节、路线锁、修复窗口、事件CG和关键旗标
${adultHudLine}

💡 **下一步行动建议（用户可输入序号或自由回复）**：
1. [积极互动且符合当前关系边界]
2. [理性观察或补充信息]
3. [探索角色母题、记忆或环境]
4. [会导致扣分、路线分歧、身份暴露或重大风险的选择]

# 引擎状态变量
${engine["状态变量"].map(item => `- ${item}`).join("\n")}
# 禁止事项
${engine["禁止事项"].map(item => `- ${item}`).join("\n")}
</Roleplay_Engine_V3>
}`;
}
