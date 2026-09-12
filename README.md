# 原作角色卡整理器

一个可安装的本地应用，用来搜索和导入公开角色资料，再整理成可交给 AI 使用的详细角色卡。

- Windows：解压后双击 `原作角色卡整理器.exe`
- Android：直接安装 APK
- 无需模型、模型密钥、搜索密钥或 Docker
- 搜索与网页资料需要联网，整理规则和文件生成在设备本地完成

## 能做什么

1. 输入作品名和角色名，从公开网页搜索角色档案、经历、性格、人物关系和对白。
2. 导入自己合法持有的 JSON、JSONL、CSV、TXT 或 Markdown 文件。
3. 把原作事实与应用扩写内容分区保存，避免把原创内容冒充官方设定。
4. 根据角色经历、母题和语料统计，用固定规则生成五级好感度、12 类场景反应、动作、内心独白和大量新对白。
5. 导出 Character Card V3 JSON、Word DOCX 和启动指令 TXT。

> 应用不会自动变成角色。将导出的 Word/JSON 上传到你要使用的 AI，再发送应用生成的“启动指令”，AI 才会按该角色卡扮演。

## 使用方法

### Windows

1. 从 [Releases](https://github.com/huanglinfei091-cmd/canon-character-card/releases) 下载 `CanonCharacterCard-Windows-x64-v1.0.0.zip`。
2. 完整解压 ZIP，不要直接在压缩包内运行。
3. 双击 `原作角色卡整理器.exe`。

当前开源版未购买 Windows 商业代码签名证书，Windows 可能显示 SmartScreen 提示。请只从本仓库 Releases 下载，并核对发行页的 SHA-256。

### Android

1. 从 [Releases](https://github.com/huanglinfei091-cmd/canon-character-card/releases) 下载 `CanonCharacterCard-Android-v1.0.0.apk`。
2. 在手机上打开 APK，按 Android 提示允许此次安装。
3. 安装后打开“原作角色卡整理器”。导出时会调用系统分享/保存面板。

Android 发行 APK 使用项目独立的 RSA-4096 密钥签名，后续更新会保持同一签名。

## 资料来源建议

- 原神：[`kqwyf/GenshinTexts`](https://github.com/kqwyf/GenshinTexts)、[`mrzjy/GenshinDialog`](https://github.com/mrzjy/GenshinDialog)、[`simon300000/genshin-voice`](https://github.com/simon300000/genshin-voice)
- 鸣潮：[`Arikatsu/WutheringWaves_Data`](https://github.com/Arikatsu/WutheringWaves_Data)、[`RealNath/wuwa-dialogue-generator`](https://github.com/RealNath/wuwa-dialogue-generator)
- 小说：导入自己合法持有的文本，并搭配可公开访问的百科或 Wiki

公开仓库中的游戏文本和语音仍归相应权利人所有。本项目不打包、不转售这些数据，只在用户设备上读取和整理。

## 本地开发

需要 Node.js 20 或更高版本。

```powershell
npm install
npm test
npm run desktop
```

Android 构建需要 JDK 21、Android SDK Platform 36 和 Build Tools 35/36。

```powershell
npm run android:apk
```

## 安全与版权边界

- 不读取正在运行的游戏进程，不绕过加密、登录、付费或反作弊。
- 网页抓取拒绝本机、局域网 IP 和 `.local` 地址，并限制单页大小与等待时间。
- 导入的本地文件只在用户设备中解析。
- 角色卡会明确区分 `canon_evidence`（原作证据）和 `app_rules`（应用扩写）。

## 许可证

[MIT](LICENSE)
