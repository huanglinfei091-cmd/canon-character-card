import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCharacter } from "../src/analyzer.js";

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
  assert.equal(original.scenes[0].stages[0].dialogues.length, 3);
  for (const scene of original.scenes) {
    for (const stage of scene.stages) {
      assert.equal(new Set(stage.dialogues.map(item => item.text)).size, stage.dialogues.length);
    }
  }
  assert.deepEqual(first.data.extensions.app_rules, second.data.extensions.app_rules);
  assert.match(first.data.creator_notes, /应用规则原创/);
  assert.match(first.data.extensions.roleplay_prompt.system_instruction["核心指令"], /秧秧/);
  const firstScene = first.data.extensions.roleplay_prompt.character_profile["好感度完整场景反应"]["初次相遇"]["Lv.0-1 初识"];
  assert.ok(firstScene["动作"]);
  assert.match(firstScene["表面"], /^『/);
  assert.match(firstScene["内心"], /^（（/);
  assert.match(first.data.extensions.roleplay_prompt.character_profile["好感度变动规则"]["点数机制"], /500\+/);
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
