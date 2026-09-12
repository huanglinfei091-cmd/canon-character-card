import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCharacter } from "../src/analyzer.js";
import { serializeRoleplayPrompt } from "../src/prompt-card.js";

const source = {
  title: "测试角色资料",
  url: "https://example.com/character",
  text: `秧秧性格温柔细腻，但在危险面前十分坚定。她是队伍中的同伴，也会保护朋友。
秧秧：你好，今天的风很轻呢。
秧秧：小心！前面有敌人，跟紧我。
秧秧：如果累了，就先休息一会儿吧。
秧秧：我相信你，我们一起走。`,
  sections: [{ heading: "心声 一", text: "漂泊者，如果有不了解的事，可以随时来找我。" }]
};

test("extracts canon evidence and creates deterministic original scenes", () => {
  const first = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source], dialogueLimit: 200 });
  const second = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source], dialogueLimit: 200 });
  const evidence = first.data.extensions.canon_evidence;
  const original = first.data.extensions.app_rules.original_dialogues;
  assert.equal(first.spec, "chara_card_v3");
  assert.ok(evidence.dialogue_count_exported >= 5);
  assert.ok(evidence.traits.some(item => item.trait === "温柔"));
  assert.equal(original.scenes.length, 12);
  assert.equal(original.scenes[0].stages.length, 5);
  assert.equal(original.scenes[0].negativeStages.length, 4);
  assert.equal(original.scenes[0].stages[0].dialogues.length, 3);
  assert.equal(original.total, 324);
  for (const scene of original.scenes) {
    for (const stage of scene.stages) {
      assert.equal(new Set(stage.dialogues.map(item => item.text)).size, stage.dialogues.length);
    }
    for (const stage of scene.negativeStages) {
      assert.equal(stage.dialogues.length, 3);
      assert.equal(new Set(stage.dialogues.map(item => item.text)).size, stage.dialogues.length);
    }
  }
  assert.deepEqual(first.data.extensions.app_rules, second.data.extensions.app_rules);
  assert.match(first.data.creator_notes, /应用规则原创/);
  assert.match(first.data.extensions.roleplay_prompt.system_instruction["核心指令"], /秧秧/);
  const firstScene = first.data.extensions.roleplay_prompt.character_profile["好感度完整场景反应"]["初次相遇"]["Lv.0 观察"];
  const negativeScene = first.data.extensions.roleplay_prompt.character_profile["负好感度完整场景反应"]["初次相遇"]["Neg.3 敌对"];
  assert.ok(firstScene["动作"]);
  assert.match(firstScene["表面"], /^『/);
  assert.match(firstScene["内心"], /^（（/);
  assert.match(negativeScene["表面"], /^『/);
  assert.ok(negativeScene["隐藏敌意"]);
  assert.ok(negativeScene["修复入口"]);
  assert.match(first.data.extensions.roleplay_prompt.character_profile["好感度变动规则"]["点数机制"], /10.*30.*50.*80.*100/);
});

test("builds bidirectional affinity, story gates, and normal plus hidden endings", () => {
  const card = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source] });
  const affinity = card.data.extensions.app_rules.affinity;
  const prompt = card.data.extensions.roleplay_prompt;

  assert.equal(affinity.minimum, -100);
  assert.equal(affinity.maximum, 100);
  assert.equal(affinity.negativeStages.length, 4);
  assert.equal(affinity.routeLocks.length, 5);
  assert.equal(affinity.recoverySystem.windows.length, 4);
  assert.ok(affinity.events.some(item => item.change > 0));
  assert.ok(affinity.events.some(item => item.change < 0));
  assert.ok(affinity.events.some(item => item.change === 0));
  assert.deepEqual(affinity.storyUnlocks.map(item => item.score), [10, 30, 50, 80]);
  assert.equal(affinity.badEndingRoute.endings.length, 4);
  assert.equal(affinity.badEndingRoute.endings.filter(item => item.hidden).length, 1);
  assert.equal(affinity.goodEndingRoute.normalEndings.length, 3);
  assert.equal(affinity.goodEndingRoute.hiddenEndings.length, 5);
  assert.match(prompt.character_profile["好感度变动规则"]["核心原则"], /有增有减/);
  assert.ok(prompt.roleplay_engine_v3["禁止事项"].some(item => item.includes("只加分不扣分")));
  const serialized = serializeRoleplayPrompt(card);
  assert.match(serialized, /禁止只增不减/);
  assert.match(serialized, /10、30、50、80/);
  assert.match(serialized, /3 个普通好结局和 5 个隐藏好结局/);
});

test("builds identity-specific Galgame routes and adult gating", () => {
  const villain = analyzeCharacter({
    work: "鸣潮", character: "秧秧", sources: [source], userRole: "villain",
    userRoleCustom: "表面反派，实际在保护她", adultContent: "explicit", adultConfirmed: true
  });
  const route = villain.data.extensions.app_rules.user_role;
  const adult = villain.data.extensions.app_rules.adult_content;
  const prompt = villain.data.extensions.roleplay_prompt;
  assert.equal(route.label, "反派");
  assert.equal(route.initialScore, -50);
  assert.equal(villain.data.extensions.app_rules.affinity.initialScore, -50);
  assert.equal(route.exclusivePlots.length, 4);
  const defeatCG = route.eventCGs.find(item => /战败CG/.test(item.title));
  assert.ok(defeatCG);
  assert.match(defeatCG.visualScript, /不把战败等同于同意/);
  assert.equal(adult.effective, "purelove");
  assert.equal(adult.adultConfirmed, true);
  assert.match(prompt.system_instruction["用户默认身份"], /反派/);
  assert.equal(prompt.character_profile["成人剧情规则"]["当前强度"], "纯爱成人剧情（露骨）");
  assert.equal(adult.chapters.length, 3);
  assert.equal(adult.corruptionSystem.stages.length, 6);
  assert.match(adult.corruptionSystem.threshold50, /不自动等于同意/);
  assert.deepEqual(adult.sexualConsentSystem.states, ["未询问", "正在确认", "明确同意", "暂停", "已撤回"]);
  const serialized = serializeRoleplayPrompt(villain);
  assert.match(serialized, /Galgame/);
  assert.match(serialized, /角色可以主动推动剧情、拒绝、离开、欺骗、隐瞒、设局、战斗、求援、逃脱和逆转/);

  const friend = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source], userRole: "friend" });
  assert.equal(friend.data.extensions.app_rules.user_role.initialScore, 30);
  const unconfirmed = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source], userRole: "romance", adultContent: "explicit" });
  assert.equal(unconfirmed.data.extensions.app_rules.adult_content.effective, "romance");
  const dark = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source], userRole: "villain", adultContent: "dark", adultConfirmed: true });
  assert.equal(dark.data.extensions.app_rules.adult_content.chapters.length, 4);
  assert.match(dark.data.extensions.app_rules.adult_content.chapters[3].title, /战败幻想与逆转/);
});

test("supports simple and complex real-person profiles without explicit mode", () => {
  const roommate = analyzeCharacter({
    work: "现实", character: "小林", subjectType: "real", realPermission: true,
    profileMode: "simple", subjectGender: "male", realRelationship: "roommate",
    manualTraits: "安静、谨慎、嘴硬心软", userRole: "auto", adultContent: "ntr", adultConfirmed: true
  });
  assert.equal(roommate.data.extensions.subject_profile.type, "real");
  assert.equal(roommate.data.extensions.app_rules.user_role.label, "同伴");
  assert.equal(roommate.data.extensions.app_rules.user_role.selectionMode, "简单模式自动判定");
  assert.equal(roommate.data.extensions.app_rules.adult_content.effective, "romance");
  assert.ok(roommate.data.extensions.canon_evidence.traits.some(item => item.trait === "嘴硬心软"));
  assert.match(roommate.data.extensions.canon_evidence.notice, /不代表本人真实想法/);
  assert.throws(() => analyzeCharacter({ character: "室友", subjectType: "real" }), /本人同意/);
});

test("keeps Fang Yuan non-romantic in canon-strict mode even when romance is requested", () => {
  const fangSource = {
    title: "方源人物资料",
    url: "https://example.com/fang-yuan",
    text: `方源是《蛊真人》的主角。他执着于永生，以利益和目标衡量选择，冷酷果断，不让爱情成为束缚。\n方源：先谈条件，再决定是否同行。`
  };
  const card = analyzeCharacter({
    work: "蛊真人", character: "方源", sources: [fangSource], userRole: "romance",
    adultContent: "purelove", adultConfirmed: true, canonMode: "canon-strict"
  });
  const rules = card.data.extensions.app_rules;
  const prompt = card.data.extensions.roleplay_prompt;
  const serialized = serializeRoleplayPrompt(card);

  assert.equal(rules.canon_policy.strictLock, true);
  assert.equal(rules.user_role.label, "恋爱候选（原作拒绝路线）");
  assert.equal(rules.user_role.initialScore, 0);
  assert.equal(rules.user_role.routeLocked, true);
  assert.equal(rules.adult_content.effective, "off");
  assert.equal(rules.adult_content.lockedByCanon, true);
  assert.deepEqual(rules.affinity.stages.map(item => item.name), ["衡量", "可用", "合作", "认可", "长期盟约"]);
  assert.equal(rules.affinity.goodEndingRoute.normalEndings.length, 3);
  assert.ok(rules.affinity.goodEndingRoute.normalEndings.every(item => !/恋|爱人|伴侣|甜蜜/.test(`${item.title}${item.result}`)));
  assert.ok(rules.original_dialogues.scenes.flatMap(scene => scene.stages).flatMap(stage => stage.dialogues).every(item => !/恋人|爱上|想念|心愿/.test(item.text)));
  assert.match(prompt.system_instruction["原作人格优先级"], /恋爱和成人路线已锁定/);
  assert.equal(prompt.character_profile["成人剧情规则"]["启用"], false);
  assert.match(serialized, /不创建堕落值、调教值、成人事件、恋爱结局或亲密结局/);
  assert.doesNotMatch(serialized, /50 点只解锁角色主动询问/);

  const friend = analyzeCharacter({ work: "蛊真人", character: "方源", sources: [fangSource], userRole: "friend", canonMode: "canon-strict" });
  assert.equal(friend.data.extensions.app_rules.user_role.routeLocked, true);
  assert.match(friend.data.extensions.app_rules.user_role.routeEnding, /不进入恋爱结局/);

  const ifRoute = analyzeCharacter({ work: "蛊真人", character: "方源", sources: [fangSource], userRole: "romance", canonMode: "canon-if" });
  assert.equal(ifRoute.data.extensions.app_rules.canon_policy.strictLock, false);
  assert.match(ifRoute.data.extensions.app_rules.user_role.label, /IF 非原作路线/);
});

test("applies persona-first relationship gating to every character", () => {
  const warmCard = analyzeCharacter({ work: "鸣潮", character: "秧秧", sources: [source], userRole: "romance", canonMode: "canon-strict" });
  const warmRules = warmCard.data.extensions.app_rules;
  assert.equal(warmRules.canon_policy.archetype, "warm");
  assert.equal(warmRules.canon_policy.userRouteCannotSetFeelings, true);
  assert.equal(warmRules.user_role.initialScore, 0);
  assert.match(warmRules.user_role.stance, /尚未确定/);
  assert.equal(warmRules.original_dialogues.relationshipMode, "canon_grounded");
  const warmOriginal = warmRules.original_dialogues.scenes.flatMap(scene => scene.stages).flatMap(stage => stage.dialogues).map(item => item.text).join("\n");
  assert.doesNotMatch(warmOriginal, /吃醋|爱上|恋人|抱住|每天醒来都还能看见/);
  assert.match(warmRules.canon_policy.romanceGate, /初始不预设双方互相吸引/);

  const bondedSource = {
    title: "原作关系资料",
    url: "https://example.com/bonded",
    text: "角色甲性格谨慎克制。角色甲与角色乙是恋人和长期伴侣，两人共同承担使命。角色甲：不要急着相信陌生人。"
  };
  const bonded = analyzeCharacter({ work: "测试作品", character: "角色甲", sources: [bondedSource], userRole: "romance", adultContent: "purelove", adultConfirmed: true, canonMode: "canon-strict" });
  assert.equal(bonded.data.extensions.app_rules.canon_policy.existingCanonBond, true);
  assert.equal(bonded.data.extensions.app_rules.user_role.routeLocked, true);
  assert.match(bonded.data.extensions.app_rules.user_role.label, /原作关系冲突/);
  assert.equal(bonded.data.extensions.app_rules.adult_content.effective, "off");

  const bondedIf = analyzeCharacter({ work: "测试作品", character: "角色甲", sources: [bondedSource], userRole: "romance", canonMode: "canon-if" });
  assert.equal(bondedIf.data.extensions.app_rules.user_role.routeLocked, false);
  assert.match(bondedIf.data.extensions.app_rules.user_role.label, /IF 非原作路线/);
});

test("rejects empty source set", () => {
  assert.throws(() => analyzeCharacter({ character: "秧秧" }), /至少添加一个/);
});

test("keeps imported dialogue provenance", () => {
  const card = analyzeCharacter({
    work: "原神",
    character: "钟离",
    sources: [{ title: "人物页", url: "", text: "钟离性格沉稳，是旅行者的朋友。" }],
    importedDialogues: [{ speaker: "钟离", text: "欲买桂花同载酒。", sourceTitle: "avatar.csv" }]
  });
  const scenes = card.data.extensions.canon_evidence.dialogue_scenes;
  const item = Object.values(scenes).flat().find(dialogue => dialogue.text.includes("桂花"));
  assert.equal(item.sourceTitle, "avatar.csv");
});
