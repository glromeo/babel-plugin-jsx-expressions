# babel-plugin-jsx-expressions

A Babel plugin that automatically wraps JSX expressions and spread attributes containing member access (e.g. `foo.bar`) in `computed(() => ...)` calls from [`@preact/signals`](https://preactjs.com/guide/v10/signals/).

This enables signal-safe expressions in JSX when using Preact with the Signals library.

---

## Installation

```sh
npm install --save-dev @babel/core @preact/signals
```

Also install this plugin (locally or from your project):

```sh
npm install --save-dev babel-plugin-jsx-expressions
```

---

## Usage with Babel

```js
const { transformSync } = require("@babel/core");
const plugin = require("babel-plugin-jsx-expressions");

const result = transformSync(code, {
  filename: "file.tsx",
  plugins: [plugin],
  parserOpts: { sourceType: "module" },
  sourceMaps: true
});
```

Or in your `babel.config.js`:

```js
module.exports = {
  plugins: ["babel-plugin-jsx-expressions"]
};
```

---

## What it does

This plugin transforms JSX like:

```jsx
<div>{foo.bar}</div>
```

into:

```jsx
import { computed } from "@preact/signals";
<div>{computed(() => foo.bar)}</div>
```

It also works for JSX spread attributes:

```jsx
<Component {...some.obj} />
// becomes
<Component {...computed(() => some.obj)} />
```

---

## Notes

* The plugin ensures the Babel parser supports both `jsx` and `typescript` by injecting those parser plugins via `manipulateOptions()`.
* Only expressions containing a `MemberExpression` (e.g. `a.b`) are wrapped.
* Nested JSX containers are handled correctly.

---

## License

MIT
