module.exports = {
  packagerConfig: {
    asar: true,
    name: "CanonCharacterCard",
    executableName: "原作角色卡整理器",
    ignore: [
      /^\/(?:android|dist-native|out|release-artifacts)(?:\/|$)/,
      /^\/(?:\.github|\.qa|\.tmp|test|tools)(?:\/|$)/,
      /^\/start-app\.cmd$/
    ]
  },
  rebuildConfig: {},
  makers: [
    { name: "@electron-forge/maker-zip", platforms: ["win32"] }
  ]
};
