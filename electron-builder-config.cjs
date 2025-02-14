module.exports = {
  appId: "com.lordtocs.castmate",
  productName: "CastMate",
  asar: true,
  directories: {
    output: "release"
  },
  files: [
      "dist/**/*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/node_modules/.bin",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
      "!.editorconfig",
      "!**/._*",
      "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
      "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
      "!**/{appveyor.yml,.travis.yml,circle.yml}",
      "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}"
  ],
  mac: {
    artifactName: "${productName}_${version}.${ext}",
    target: [
      "dmg"
    ]
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: [
          "x64"
        ]
      }
    ],
    artifactName: "${productName}_${version}.${ext}"
  },
  nsis: {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "deleteAppDataOnUninstall": true
  },
  extraResources: [
    {
      "from": "node_modules/regedit/vbs",
      "to": "regedit/vbs",
      "filter": [
        "**/*"
      ]
    }
  ],
  extraFiles: [
    {
      from: "web",
      to: "web",
    }
  ],
  publish: [{
    provider: 'github',
    owner: "LordTocs",
    repo: "CastMate"
  }],
}