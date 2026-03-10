# babel-plugin-jsx-expressions

A Babel plugin that transforms JSX into `jsx(tag, props)` factory calls while making reactive expressions
lazy — expressions containing member access or calls are wrapped in arrow functions (for intrinsic
elements) or getter methods (for function components), enabling fine-grained reactivity compatible with
[Preact Signals](https://preactjs.com/guide/v10/signals/).

---

## Installation

```sh
npm install --save-dev @babel/core babel-plugin-jsx-expressions
```

Preact is required at runtime (for the default `preact/jsx-runtime` factory):

```sh
npm install preact
```

---

## Usage with Babel

In your `babel.config.js`:

```js
module.exports = {
  plugins: ["babel-plugin-jsx-expressions"]
};
```

Or programmatically:

```js
const {transformSync} = require("@babel/core");
const plugin = require("babel-plugin-jsx-expressions");

const result = transformSync(code, {
  filename: "file.tsx",
  plugins: [plugin]
});
```

---

## Usage with esbuild

Install [`esbuild-babel-plugin`](https://github.com/nicolo-ribaudo/esbuild-babel-plugin) to hook Babel into the esbuild pipeline:

```sh
npm install --save-dev esbuild esbuild-babel-plugin
```

Then use it in your build script:

```js
const {build} = require("esbuild");
const esbuildBabelPlugin = require("esbuild-babel-plugin");
const plugin = require("babel-plugin-jsx-expressions");

await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  outdir: "dist",
  plugins: [
    esbuildBabelPlugin({
      filter: /\.(jsx?|tsx?)$/,
      plugins: [plugin],
    }),
  ],
});
```

---

## What it does

The plugin replaces JSX syntax with explicit `jsx(tag, props)` factory calls and makes reactive
expressions lazy so that Preact Signals can track them.

**Static expressions** are passed as plain values:

```jsx
<div class="hello">World</div>
// becomes
jsx("div", { class: "hello", children: "World" });
```

**Reactive expressions** — those containing a member access (`a.b`, `a[i]`) or a call (`fn()`) — are
wrapped to defer evaluation:

- On **intrinsic elements** (`<div>`, `<span>`, etc.), reactive props and children become **arrow functions**:

```jsx
<div title={obj.label}>{sig.value}</div>
// becomes
jsx("div", {
  title: () => obj.label,
  children: () => sig.value
});
```

- On **function components**, reactive props and children become **getter methods**:

```jsx
<MyComponent title={obj.label}>{sig.value}</MyComponent>
// becomes
jsx(MyComponent, {
  get title() { return obj.label; },
  get children() { return sig.value; }
});
```

Event handlers (`onClick`, `onInput`, etc.) and arrow function expressions are never wrapped.

---

## Options

| Option | Type | Description |
|---|---|---|
| `factories` | `object` | Override the JSX factory for `jsx`, `svg`, `xhtml`, or `Fragment`. |
| `aliases` | `object` | Rewrite import source strings (e.g. map a short alias to a full module path). |

Example — custom SVG factory:

```js
plugins: [["babel-plugin-jsx-expressions", {
  factories: { svg: { module: "my-svg-runtime", name: "svg" } }
}]]
```

---

## Notes

- The plugin injects the `jsx` and `typescript` Babel parser plugins automatically via `manipulateOptions()`, so no separate parser configuration is needed.
- Nested JSX is handled correctly — inner elements are transformed before outer ones.

---

## Tests

### Node (Jest)

```sh
npm test
```

Runs three suites:

- **`test/babel.spec.js`** — static transform tests: each case calls `babel.transformSync` and compares the output string against the expected code.
- **`test/esbuild.spec.js`** — esbuild integration tests via `esbuild-babel-plugin`.
- **`test/inline.spec.js`** — runtime tests: JSX is transformed and executed against the real Preact `jsx` runtime.
- **`test/transpiled.spec.tsx`** — runtime tests written in TSX, transformed by `babel-jest` and executed with the real Preact runtime using Jest's built-in `expect`.

### Browser

```sh
npm run bundle   # produces dist/plugin.mjs
```

Then serve the project root (e.g. `npx serve .`) and open `test/test-runner.html`. A service worker intercepts
requests for `.tsx`/`.jsx`/`.ts` files and transpiles them on the fly using `@babel/standalone` + the bundled
plugin. Results appear in the browser console (`✓`/`✗`).

---

## License

MIT
