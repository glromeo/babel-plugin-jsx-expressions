const {build} = require("esbuild");
const preactJsxSignalsPlugin = require("../index");
const path = require("path");
const fs = require("fs/promises");
const os = require("node:os");

async function transform(inputCode) {
    const tmpFile = path.join(os.tmpdir(), `test-${crypto.randomUUID()}.jsx`);
    await fs.writeFile(tmpFile, inputCode);
    try {
        const result = await build({
            entryPoints: [tmpFile],
            bundle: false,
            write: false,
            jsx: "automatic",
            jsxImportSource: "preact",
            plugins: [preactJsxSignalsPlugin()],
            sourcemap: true,
            loader: {".jsx": "jsx"}
        });
        return result.outputFiles[0].text;
    } finally {
        await fs.unlink(tmpFile).catch(console.log);
    }
}

function normalize(code) {
    return stripMap(code).split("\n").map(line => line.trim()).join("\n").trim();
}

function stripMap(code) {
    return code.slice(0, code.lastIndexOf("//# sourceMappingURL"));
}

module.exports = {
    normalize,
    transform
};