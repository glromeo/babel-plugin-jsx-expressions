const babel = require("@babel/core");
const plugin = require("../index");
const {build} = require("esbuild");
const esbuildBabelPlugin = require("esbuild-babel-plugin");
const path = require("path");
const fs = require("fs/promises");
const os = require("node:os");

function transformWithBabel(source, options = {}) {
  const result = babel.transformSync(source, {
    plugins: [[plugin, options]],
    filename: "test.tsx",
    sourceType: "module"
  });
  return result.code;
}

async function transformWithESBuild(inputCode, options = {}, filename = `test-${crypto.randomUUID()}.tsx`) {
  const tmpFile = path.join(os.tmpdir(), filename);
  await fs.mkdir(path.dirname(tmpFile), {recursive: true});
  await fs.writeFile(tmpFile, inputCode);
  try {
    const result = await build({
      entryPoints: [tmpFile],
      bundle: false,
      write: false,
      plugins: [
        esbuildBabelPlugin({
          filter: /\.(jsx?|tsx?)$/,
          plugins: [[plugin, options]]
        })
      ],
      sourcemap: true
    });
    return result.outputFiles[0].text;
  } finally {
    await fs.unlink(tmpFile).catch(console.log);
  }
}

function stripMap(code) {
  const idx = code.lastIndexOf("//# sourceMappingURL");
  return idx === -1 ? code : code.slice(0, idx);
}

// Trim each line and remove empty lines, for whitespace-agnostic comparison
function normalize(code) {
  return stripMap(code).split("\n").map(l => l.trim()).filter(Boolean).join("\n");
}

// normalize() then strip import lines, for expression-only assertions
function stripImports(code) {
  return normalize(code).split("\n").filter(l => !l.startsWith("import ")).join("\n");
}

module.exports = {transformWithBabel, transformWithESBuild, normalize, stripImports};
