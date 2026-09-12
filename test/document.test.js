import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCharacter } from "../src/analyzer.js";
import { buildDocx } from "../src/document.js";
import { serializeRoleplayPrompt } from "../src/prompt-card.js";

test("serializes a reference-shaped roleplay prompt", () => {
  const card = analyzeCharacter({
    work: "剑来",
    character: "宁姚",
    sources: [{ title: "人物百科", url: "https://example.com/ning-yao", text: "宁姚是剑修，性格孤傲而坚定。宁姚：不用担心，我会回来。" }]
  });
  const prompt = serializeRoleplayPrompt(card);
  assert.ok(prompt.startsWith("{"));
  assert.match(prompt, /<Roleplay_Engine_V3>/);
  assert.match(prompt, /系统面板 \| System HUD/);
  assert.doesNotMatch(prompt, /^宁姚 AI角色卡/);
});

test("creates a valid-sized docx package", async () => {
  const card = analyzeCharacter({
    work: "剑来",
    character: "宁姚",
    sources: [{ title: "人物百科", url: "https://example.com/ning-yao", text: "宁姚是剑修，性格孤傲而坚定。宁姚：不用担心，我会回来。" }]
  });
  const buffer = await buildDocx(card);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  assert.ok(buffer.length > 20_000);
});
