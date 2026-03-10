const plugin = require("../index");
const {build} = require("esbuild");
const esbuildBabelPlugin = require("esbuild-babel-plugin");
const path = require("path");
const fs = require("fs/promises");
const os = require("node:os");

const transformAsync = async (inputCode, options = {}, filename = `test-${crypto.randomUUID()}.tsx`) => {
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
          configFile: false,
          plugins: [[plugin, options]]
        })
      ],
      sourcemap: true
    });
    return result.outputFiles[0].text;
  } finally {
    await fs.unlink(tmpFile).catch(console.log);
  }
};
const stripSourceMapping = code => {
  const idx = code.lastIndexOf("//# sourceMappingURL");
  return idx === -1 ? code : code.slice(0, idx);
}
const normalize = code => stripSourceMapping(code).split("\n").map(l => l.trim()).filter(Boolean).join("\n");

// ─── esbuild integration ──────────────────────────────────────────────────────

describe("esbuild integration", () => {
  test("basic element transforms via esbuild", async () => {
    expect(normalize(await transformAsync(
        `<div class="hello">World</div>;`
    ))).toBe(normalize(`
        import { jsx } from "preact/jsx-runtime";
        jsx("div", {
            class: "hello",
            children: "World"
        });
    `));
  });

  test("reactive child is wrapped in arrow via esbuild", async () => {
    expect(normalize(await transformAsync(
        `<div>{fn()}</div>;`
    ))).toBe(normalize(`
        import { jsx } from "preact/jsx-runtime";
        jsx("div", {
            children: () => fn()
        });
    `));
  });

  test("plugin options are forwarded via esbuild", async () => {
    expect(normalize(await transformAsync(
        `<svg:g/>;`,
        {factories: {svg: {module: "my-svg", name: "svg"}}}
    ))).toBe(normalize(`
        import { svg } from "my-svg";
        svg("g", {});
    `));
  });
});
