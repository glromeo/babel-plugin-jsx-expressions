const babel = require("@babel/core");
const plugin = require("../index");

const transformSync = (source, options = {}) => babel.transformSync(source, {
  configFile: false,
  plugins: [[plugin, options]],
  filename: "test.tsx",
  sourceType: "module"
}).code;
const stripSourceMapping = code => {
  const idx = code.lastIndexOf("//# sourceMappingURL");
  return idx === -1 ? code : code.slice(0, idx);
}
const normalize = code => stripSourceMapping(code).split("\n").map(l => l.trim()).filter(Boolean).join("\n");
const stripImports = code => code.split("\n").filter(l => !l.startsWith("import ")).join("\n");
const transpiledCode = (source, opts) => normalize(transformSync(source, opts));
const transpiledExpression = source => stripImports(transpiledCode(source));

expect.extend({
  toMatchCode(received, expected) {
    const norm = s => s.split("\n").map(l => l.trim()).filter(Boolean).join("\n");
    const pass = norm(received) === norm(expected);
    return {
      pass, message: () => `Expected:\n${norm(expected)}\n\nReceived:\n${norm(received)}`
    };
  }
});

// ─── Fragments ────────────────────────────────────────────────────────────────

describe("fragment", () => {

  test("empty fragment", () => {
    expect(transpiledCode(`<></>`)).toMatchCode(`
        import { jsx, Fragment } from "preact/jsx-runtime";
        jsx(Fragment, {});
    `);
  });

  test("fragment with space text", () => {
    expect(transpiledExpression(`<> </>`)).toMatchCode(`
        jsx(Fragment, {
            children: " "
        });
    `);
  });

  test("text-only fragments are string literals", () => {
    expect(transpiledExpression(`<>undefined</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "undefined"
        });
    `);
    expect(transpiledExpression(`<>null</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "null"
        });
    `);
    expect(transpiledExpression(`<>0</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "0"
        });
    `);
    expect(transpiledExpression(`<>1</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "1"
        });
    `);
    expect(transpiledExpression(`<>false</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "false"
        });
    `);
    expect(transpiledExpression(`<>true</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "true"
        });
    `);
    expect(transpiledExpression(`<>Hello</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "Hello"
        });
    `);
    expect(transpiledExpression(`<>Hello World</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "Hello World"
        });
    `);
  });

  test("empty expression container is ignored", () => {
    expect(transpiledExpression(`<>{}</>`)).toMatchCode(`jsx(Fragment, {});`);
  });

  test("space + empty expression + space produces two space children", () => {
    expect(transpiledExpression(`<> {} </>`)).toMatchCode(`
        jsx(Fragment, {
            children: [" ", " "]
        });
      `);
  });

  test("tab collapses to space", () => {
    expect(transpiledExpression(`<>\t</>`)).toMatchCode(`
        jsx(Fragment, {
            children: " "
        });
    `);
  });

  test("newline-indented text is trimmed", () => {
    expect(transpiledExpression(`<> \n\t {"\t"} \n </>`)).toMatchCode(`
        jsx(Fragment, {
            children: [" ", "\t", " "]
        });
    `);
  });

  test("mixed text and expression children", () => {
    expect(transpiledExpression(`<> \na {"\t"} b\n </>`)).toMatchCode(`
        jsx(Fragment, {
            children: [" a ", "\t", " b"]
        });
    `);
  });

  test("text and empty expression children", () => {
    expect(transpiledExpression(`<>Hello{}World</>`)).toMatchCode(`
        jsx(Fragment, {
            children: ["Hello", "World"]
        });
    `);
  });

  test("expression children: undefined, null, numbers, booleans, strings", () => {
    expect(transpiledExpression(`<>{undefined}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: undefined
        });
    `);
    expect(transpiledExpression(`<>{null}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: null
        });
    `);
    expect(transpiledExpression(`<>{0}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: 0
        });
    `);
    expect(transpiledExpression(`<>{1}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: 1
        });
    `);
    expect(transpiledExpression(`<>{false}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: false
        });
    `);
    expect(transpiledExpression(`<>{true}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: true
        });
    `);
    expect(transpiledExpression(`<>{"Hello"}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: "Hello"
        });
    `);
  });

  test("multiple string expression children", () => {
    expect(transpiledExpression(`<>{"Hello"}{"World"}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: ["Hello", "World"]
        });
    `);
  });

  test("array expression child", () => {
    expect(transpiledExpression(`<>{["Hello","World"]}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: ["Hello", "World"]
        });
    `);
  });
});

// ─── Fragments & signals ──────────────────────────────────────────────────────

describe("fragments & signals", () => {

  test("empty expression in element is dropped", () => {
    expect(transpiledExpression(`<p>{}</p>`)).toMatchCode(`jsx("p", {});`);
  });

  test("plain identifier child is not reactive", () => {
    expect(transpiledExpression(`<p>{fn}</p>`)).toMatchCode(`
        jsx("p", {
            children: fn
        });
    `);
  });

  test("nested element child", () => {
    expect(transpiledExpression(`<><p/></>`)).toMatchCode(`
        jsx(Fragment, {
            children: jsx("p", {})
        });
    `);
  });

  test("nested element with text child", () => {
    expect(transpiledExpression(`<><p>NO</p></>`)).toMatchCode(`
        jsx(Fragment, {
            children: jsx("p", {
                children: "NO"
            })
        });
    `);
  });

  test("mixed text and identifier child is not reactive", () => {
    expect(transpiledExpression(`<><p>NO{fn}</p></>`)).toMatchCode(`
        jsx(Fragment, {
            children: jsx("p", {
                children: ["NO", fn]
            })
        });
    `);
  });

  test("call expression child is wrapped in arrow (intrinsic)", () => {
    expect(transpiledExpression(`<p>{fn()}</p>`)).toMatchCode(`
        jsx("p", {
            children: () => fn()
        });
    `);
  });

  test("multiple reactive children in fragment are individually wrapped", () => {
    expect(transpiledExpression(`<>{fn()}{fn()}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: [() => fn(), () => fn()]
        });
    `);
  });

  test("spread child with call is reactive (arrow wraps entire array)", () => {
    expect(transpiledExpression(`<p>{...fn()}</p>`)).toMatchCode(`
        jsx("p", {
            children: () => [...fn()]
        });
    `);
  });

  test("mixed static and reactive spread children", () => {
    expect(transpiledExpression(`<p>{0}{...fn()}{gn()}</p>`)).toMatchCode(`
        jsx("p", {
            children: () => [0, ...fn(), gn()]
        });
    `);
  });

  test("already-transformed jsx children are not reactive", () => {
    // jsx() call is reactive in source, but <p> becomes a call AFTER transformation
    expect(transpiledExpression(`<><p>{jsx()}</p></>`)).toMatchCode(`
        jsx(Fragment, {
            children: jsx("p", {
                children: () => jsx()
            })
        });
    `);
  });

  test("signal value child is reactive (member expression)", () => {
    expect(transpiledExpression(`<>{$s}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: $s
        });
    `);
    expect(transpiledExpression(`<>{$s.value}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: () => $s.value
        });
    `);
  });

  test("multiple signal children are individually wrapped", () => {
    expect(transpiledExpression(`<>{$s.value}{$s.value}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: [() => $s.value, () => $s.value]
        });
    `);
  });

  test("spread child without reactivity is not wrapped", () => {
    expect(transpiledExpression(`<>{...["Hello","World"]}</>`)).toMatchCode(`
        jsx(Fragment, {
            children: [...["Hello", "World"]]
        });
    `);
  });
});

// ─── Function components ──────────────────────────────────────────────────────

describe("FC (function components)", () => {
  test("component vs intrinsic tag detection", () => {
    expect(transpiledCode(`
        let FC = () => {}, div = <div/>;
        <FC></FC>;
        <CF></CF>;
        <div></div>;
    `)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        let FC = () => {},
            div = jsx("div", {});
        jsx(FC, {});
        jsx(CF, {});
        jsx("div", {});
    `);
  });

  test("Fragment import on demand", () => {
    expect(transpiledCode(`
        import { Fragment } from "preact/jsx-runtime";
        function FO() {
            let FC = () => {};
            <FC>
                <Fragment><div></div></Fragment>
            </FC>;
        }
    `)).toMatchCode(`
        import { jsx, Fragment } from "preact/jsx-runtime";
        function FO() {
            let FC = () => {};
            jsx(FC, {
                children: jsx(Fragment, {
                children: jsx("div", {})
                })
            });
        }
      `);
  });

  test("component with spread attribute (non-reactive)", () => {
    expect(transpiledExpression(`<FC class={"cx"} {...unknown}></FC>`)).toMatchCode(`
        jsx(FC, {
            class: "cx",
            ...unknown
        });
    `);
  });

  test("component with reactive array spread child uses getter", () => {
    expect(transpiledExpression(`<FC>{['a', ...unknown.value]}</FC>`)).toMatchCode(`
        jsx(FC, {
            get children() {
                return ['a', ...unknown.value];
            }
        });
      `);
  });

  test("component with non-reactive array spread child uses plain prop", () => {
    expect(transpiledExpression(`<FC>{['a', ...unknown]}</FC>`)).toMatchCode(`
        jsx(FC, {
            children: ['a', ...unknown]
        });
      `);
  });

  test("member expression tag (Namespace.Component)", () => {
    expect(transpiledCode(`
        const Namespace = { Component: () => {} };
        <Namespace.Component></Namespace.Component>
    `)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        const Namespace = {
            Component: () => {}
        };
        jsx(Namespace.Component, {});
    `);
  });

  test("comprehensive component with all prop types", () => {
    expect(transpiledCode(`
        let FC = () => {};
        let value, fn, obj;
        <FC class="one" style="color: red;"
             data-field={value}
             arrow_expr={()=>{}}
             kall:fn={fn()}
             property_access={obj.value}
             indexed_access={obj[0]}
             methodCall={obj.get()}
             nested={<div not={fn} yes={fn.call()}>{obj}{obj.value}</div>}
         >A B C {...new Set([1, 2, 3])} {fn()} {jsx()}</FC>
    `)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        let FC = () => {};
        let value, fn, obj;
        jsx(FC, {
            class: "one",
            style: "color: red;",
            "data-field": value,
            arrow_expr: () => {},
            get ["kall:fn"]() {
                return fn();
            },
            get property_access() {
                return obj.value;
            },
            get indexed_access() {
                return obj[0];
            },
            get methodCall() {
                return obj.get();
            },
            get nested() {
                return jsx("div", {
                not: fn,
                yes: () => fn.call(),
                children: [obj, () => obj.value]
                });
            },
            get children() {
                return ["A B C ", ...new Set([1, 2, 3]), " ", fn(), " ", jsx()];
            }
        });
    `);
  });
});

// ─── Elements (intrinsics) ────────────────────────────────────────────────────

describe("elements", () => {
  test("text child", () => {
    expect(transpiledExpression(`<div>Hello Sailor!</div>`)).toMatchCode(`
        jsx("div", {
            children: "Hello Sailor!"
        });
    `);
  });

  test("mixed text and string expression children", () => {
    expect(transpiledExpression(`<div>Hello {"Great"} Sailor!</div>`)).toMatchCode(`
        jsx("div", {
            children: ["Hello ", "Great", " Sailor!"]
        });
    `);
  });

  test("newline-indented mixed children", () => {
    expect(transpiledExpression(`<div>\n\t  Hello {"Great"} Sailor!\n  </div>`)).toMatchCode(`
        jsx("div", {
            children: ["Hello ", "Great", " Sailor!"]
        });
    `);
  });

  test("reactive nested element prop uses arrow (intrinsic)", () => {
    expect(transpiledExpression(`<div el={<p>{fn()}</p>}/>`)).toMatchCode(`
        jsx("div", {
            el: () => jsx("p", {
                children: () => fn()
            })
        });
    `);
  });

  test("static nested element prop uses arrow (intrinsic)", () => {
    expect(transpiledExpression(`<div el={<p></p>}/>`)).toMatchCode(`
        jsx("div", {
            el: () => jsx("p", {})
        });
    `);
  });

  test("img with static attrs", () => {
    expect(transpiledCode(`<img src="url://" data-test-id={0} />`)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        jsx("img", {
            src: "url://",
            "data-test-id": 0
        });
    `);
  });

  test("on* handlers are never wrapped", () => {
    expect(transpiledCode(`
        <p onClick={handler} onclick={() => handler()} onclick={handler()}/>
    `)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        jsx("p", {
            onClick: handler,
            onclick: () => handler(),
            onclick: handler()
        });
    `);
  });

  test("spread attribute (non-reactive)", () => {
    expect(transpiledExpression(`<div class={"cx"} {...unknown}></div>`)).toMatchCode(`
        jsx("div", {
            class: "cx",
            ...unknown
        });
    `);
  });

  test("reactive array spread child uses arrow (intrinsic)", () => {
    expect(transpiledExpression(`<div>{['a', ...unknown.value]}</div>`)).toMatchCode(`
        jsx("div", {
            children: () => ['a', ...unknown.value]
        });
    `);
  });

  test("non-reactive array spread child uses plain prop", () => {
    expect(transpiledExpression(`<div>{['a', ...unknown]}</div>`)).toMatchCode(`
        jsx("div", {
            children: ['a', ...unknown]
        });
    `);
  });

  test("comprehensive element with all prop types", () => {
    expect(transpiledCode(`
        let value, fn, obj;
        <div class="one" style="color: red;"
             data-field={value}
             arrow_expr={()=>{}}
             kall:fn={fn()}
             property_access={obj.value}
             indexed_access={obj[0]}
             methodCall={obj.get()}
             nested={<div not={fn} yes={fn()}>{obj}{obj.value}</div>}
         >A B C {...new Set([1, 2, 3])}</div>
    `)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        let value, fn, obj;
        jsx("div", {
            class: "one",
            style: "color: red;",
            "data-field": value,
            arrow_expr: () => {},
            "kall:fn": () => fn(),
            property_access: () => obj.value,
            indexed_access: () => obj[0],
            methodCall: () => obj.get(),
            nested: () => jsx("div", {
                not: fn,
                yes: () => fn(),
                children: [obj, () => obj.value]
            }),
            children: ["A B C ", ...new Set([1, 2, 3])]
        });
      `);
  });

  test("boolean attribute (no value) becomes booleanLiteral true", () => {
    expect(transpiledExpression(`<input disabled />`)).toMatchCode(`
        jsx("input", {
            disabled: true
        });
      `);
    expect(transpiledExpression(`<input required readonly />`)).toMatchCode(`
        jsx("input", {
            required: true,
            readonly: true
        });
      `);
  });

  test("is: directive uses getter even on intrinsic", () => {
    expect(transpiledExpression(`
        let axis = {value: "north south"};
        <div is:resizable={axis.value}></div>
    `)).toMatchCode(`
        let axis = {
            value: "north south"
        };
        jsx("div", {
            get ["is:resizable"]() {
                return axis.value;
            }
        });
      `);
  });
});

// ─── Reactive props ───────────────────────────────────────────────────────────

describe("reactive props", () => {
  test("template literal with member access is reactive", () => {
    expect(transpiledExpression(`
        <div class="editor" style={\`display:\${mode.value === "source" ? "block" : "none"}\`} />
    `)).toMatchCode(`
        jsx("div", {
            class: "editor",
            style: () => \`display:\${mode.value === "source" ? "block" : "none"}\`
        });
    `);
  });
});

// ─── Key prop ─────────────────────────────────────────────────────────────────

describe("key prop", () => {
  test("string key is passed as third argument", () => {
    expect(transpiledCode(`<div key="x" />`)).toMatchCode(`
      import { jsx } from "preact/jsx-runtime";
      jsx("div", {}, "x");
    `);
  });

  test("expression key is passed as third argument", () => {
    expect(transpiledCode(`<div key={id} />`)).toMatchCode(`
      import { jsx } from "preact/jsx-runtime";
      jsx("div", {}, id);
    `);
  });

  test("key with other props is not included in props object", () => {
    expect(transpiledCode(`<div class="a" key="k" />`)).toMatchCode(`
      import { jsx } from "preact/jsx-runtime";
      jsx("div", {
        class: "a"
      }, "k");
    `);
  });
});

// ─── Elements with xmlns / SVG ────────────────────────────────────────────────

describe("elements with xmlns", () => {
  test("svg: namespace prefix maps to configured svg factory (default: jsx)", () => {
    expect(transpiledExpression(`
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M1 8s3-5.5 8-5.5S17 8"/>
        </svg>
    `)).toMatchCode(`
        jsx("svg", {
            width: "16",
            height: "16",
            fill: "currentColor",
            viewBox: "0 0 16 16",
            children: jsx("path", {
                d: "M1 8s3-5.5 8-5.5S17 8"
            })
        });
    `);
  });

  test("svg:g namespace syntax maps to svg factory", () => {
    expect(transpiledCode(`<svg:g></svg:g>`)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        jsx("g", {});
    `);
  });

  test("xhtml:a namespace syntax maps to xhtml factory", () => {
    expect(transpiledCode(`<xhtml:a></xhtml:a>`)).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        jsx("a", {});
    `);
  });

  test("custom namespace prefix resolves to identifier in scope", () => {
    expect(transpiledCode(`
        let h = () => {};
        <h:a></h:a>
    `)).toMatchCode(`
        let h = () => {};
        h("a", {});
    `);
  });

  test("xmlns with unknown string value throws", () => {
    expect(() => transformSync(`<div xmlns="http://example.com/ns" />`)).
        toThrow("invalid xmlns value: \"http://example.com/ns\"");
  });

  test("xmlns with non-string value throws", () => {
    expect(() => transformSync(`<div xmlns={ns} />`)).toThrow("invalid xmlns type: JSXExpressionContainer");
  });

  test("xmlns attribute switches factory for element and descendants", () => {
    expect(transpiledExpression(`
        <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
          <foreignObject x="10" y="10" width="280" height="180">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%">
              <strong>Hello!</strong>
            </div>
          </foreignObject>
        </svg>
    `)).toMatchCode(`
        jsx("svg", {
            width: "300",
            height: "200",
            children: jsx("foreignObject", {
                x: "10",
                y: "10",
                width: "280",
                height: "180",
                children: jsx("div", {
                style: "width: 100%; height: 100%",
                children: jsx("strong", {
                    children: "Hello!"
                })
                })
            })
        });
    `);
  });
});

// ─── Expressions ─────────────────────────────────────────────────────────────

describe("expressions", () => {
  test("TypeScript props with member access are reactive", () => {
    expect(transpiledExpression(`
        function FC(props: { letter: string, counter: number }) {
            return <div>{props.letter + ":" + props.counter}</div>;
        }
    `)).toMatchCode(`
        function FC(props: {
            letter: string;
            counter: number;
        }) {
            return jsx("div", {
                children: () => props.letter + ":" + props.counter
            });
        }
    `);
  });

  test("assignment expressions with member/index access are reactive", () => {
    expect(transpiledExpression(`
        function FC(props) {
            return <div k={y = props.z} w={y[0] = 0}>{x = <Fragment></Fragment>}</div>
        }
    `)).toMatchCode(`
        function FC(props) {
            return jsx("div", {
                k: () => y = props.z,
                w: () => y[0] = 0,
                children: () => x = jsx(Fragment, {})
            });
        }
    `);
  });

  test("new expression with .value is reactive", () => {
    expect(transpiledExpression(`<div>{new Computed(() => props.message).value}</div>`)).toMatchCode(`
        jsx("div", {
            children: () => new Computed(() => props.message).value
        });
    `);
  });

  test("computed call with .value is reactive", () => {
    expect(transpiledExpression(`<div>{computed(() => props.message).value}</div>`)).toMatchCode(`
        jsx("div", {
            children: () => computed(() => props.message).value
        });
    `);
  });

  test("named function expression is not reactive (skipped)", () => {
    expect(transpiledExpression(`<div>{function X() { return props.message }}</div>`)).toMatchCode(`
        jsx("div", {
            children: function X() {
                return props.message;
            }
        });
    `);
  });

  test("IIFE (immediately invoked function expression) is reactive", () => {
    expect(transpiledExpression(`<div>{(function X() { return props.message })()}</div>`)).toMatchCode(`
        jsx("div", {
            children: () => function X() {
                return props.message;
            }()
        });
    `);
  });
});

// ─── Configurability ──────────────────────────────────────────────────────────

describe("configurable factories", () => {
  test("custom svg factory produces distinct import and call", () => {
    expect(transpiledCode(
        `<svg:g></svg:g>`,
        {factories: {svg: {module: "my-svg", name: "svg"}}}
    )).toMatchCode(`
        import { svg } from "my-svg";
        svg("g", {});
    `);
  });

  test("custom jsx module is used for all elements", () => {
    expect(transpiledCode(
        `<div/>`,
        {factories: {jsx: {module: "my-jsx", name: "h"}}}
    )).toMatchCode(`
        import { h } from "my-jsx";
        h("div", {});
    `);
  });
});

describe("import aliases", () => {
  test("alias rewrites import source", () => {
    expect(transpiledCode(
        `import { signal } from "my-signals"; <div/>;`,
        {aliases: {"my-signals": "@preact/signals"}}
    )).toMatchCode(`
        import { jsx } from "preact/jsx-runtime";
        import { signal } from "@preact/signals";
        jsx("div", {});
    `);
    expect(transpiledCode(
        `import { signal } from "my-signals"; <div/>;`,
        {aliases: {"my-signals": "@preact/signals"}}
    )).not.toContain("my-signals");
  });
});
