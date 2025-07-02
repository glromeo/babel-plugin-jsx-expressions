// test/plugin.test.js
const { normalize, transform } = require("./helper");

test("wraps member access in computed()", async () => {
    const input = `
        import { signal } from "@preact/signals";
        function App() {
          const count = signal(0);
          return <div>{count.value}</div>;
        }
    `;

    const output = await transform(input);

    expect(normalize(output)).toBe(normalize(`
        import { jsx } from "preact/jsx-runtime";
        import { computed } from "@preact/signals";
        import { signal } from "@preact/signals";
        function App() {
            const count = signal(0);
            return /* @__PURE__ */ jsx("div", { children: computed(() => count.value) });
        }
    `));
});

test("does not wrap literals", async () => {
    const input = `
        function App() {
          return <div>{42}</div>;
        }
    `;

    const output = await transform(input);

    expect(normalize(output)).toBe(normalize(`
        import { jsx } from "preact/jsx-runtime";
        function App() {
            return /* @__PURE__ */ jsx("div", { children: 42 });
        }
    `));
});

test("wraps spread attribute containing member access in computed()", async () => {
    const input = `
        import { signal } from "@preact/signals";
        function App() {
          const props = signal({ class: 'a' });
          return <div {...props.value} />;
        }
    `;

    const output = await transform(input);

    expect(normalize(output)).toBe(normalize(`
        import { jsx } from "preact/jsx-runtime";
        import { computed } from "@preact/signals";
        import { signal } from "@preact/signals";
        function App() {
            const props = signal({
                class: "a"
            });
            return /* @__PURE__ */ jsx("div", { ...computed(() => props.value) });
        }
    `));
});

test("function and lambda declarations are ignored", async () => {
    const input = `
        import { signal, computed } from "@preact/signals";
        function App() {
          const props = signal({ class: 'a' });
          return <div cn={computed(()=>props.value)} fn={f(()=>props.value)} hn={h(function(){return props.value;})} />;
        }
    `;

    const output = await transform(input);

    expect(normalize(output)).toBe(normalize(`
        import { jsx } from "preact/jsx-runtime";
        import { signal, computed } from "@preact/signals";
        function App() {
            const props = signal({
                class: "a"
            });
            return /* @__PURE__ */ jsx("div", { cn: computed(() => props.value), fn: f(() => props.value), hn: h(function() {\nreturn props.value;\n}) });
        }
    `));
});