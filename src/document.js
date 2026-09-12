import {
  Document,
  Packer,
  Paragraph,
  TextRun
} from "docx";
import { serializeRoleplayPrompt } from "./prompt-card.js";

const black = "000000";

function jsonParagraph(line) {
  return new Paragraph({
    spacing: { after: 0, before: 0, line: 240 },
    children: [new TextRun({
      text: line || " ",
      font: "SimSun",
      eastAsia: "SimSun",
      color: black,
      size: 21
    })]
  });
}

export async function buildDocx(card) {
  const doc = createDocument(card);
  return Packer.toBuffer(doc);
}

export async function buildDocxBlob(card) {
  const doc = createDocument(card);
  return Packer.toBlob(doc);
}

function createDocument(card) {
  const prompt = serializeRoleplayPrompt(card);
  const lines = prompt.split("\n");
  const children = lines.map(jsonParagraph);

  return new Document({
    creator: "原作角色卡整理器",
    title: `${card.data.name} AI角色卡`,
    description: "包含完整系统指令、角色资料、好感度机制、原作对白和规则原创场景的角色卡",
    styles: {
      default: {
        document: {
          run: { font: "SimSun", color: black, size: 21 },
          paragraph: { spacing: { after: 0, before: 0, line: 240 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1800, bottom: 1440, left: 1800 }
        }
      },
      children
    }]
  });
}
