const babel = require("@babel/core");
const plugin = require("../index.js");
const {jsx, Fragment} = require("preact/jsx-runtime");

const transform = source => {
  const {code} = babel.transformSync(source, {
    configFile: false,
    plugins: [[plugin]],
    filename: "test.tsx"
  });
  return code.replace(/^import .+;\n?/gm, "").trim();
};
const transpile = source => {
  const body = transform(source);
  return new Function("jsx", "Fragment", `return ${body}`)(jsx, Fragment);
};

describe("transpiled runtime", () => {

    test("fragment returns a VNode with Fragment type", () => {
        expect(transpile(`<></>`).type).toBe(Fragment);
    });

    test("element has correct type and static props", () => {
        const el = transpile(`<div class="hello">World</div>`);
        expect(el.type).toBe("div");
        expect(el.props.class).toBe("hello");
        expect(el.props.children).toBe("World");
    });

    test("reactive child is wrapped in arrow function", () => {
        const fakeSig = {value: "hello"};
        const body = transform(`<div>{sig.value}</div>`);
        const el = new Function("jsx", "Fragment", "sig", `return ${body}`)(jsx, Fragment, fakeSig);
        expect(typeof el.props.children).toBe("function");
        expect(el.props.children()).toBe("hello");
    });

    test("handler prop is not wrapped", () => {
        const el = transpile(`<div onClick={null}/>`);
        expect(el.props.onClick).toBeNull();
    });

    test("boolean attribute becomes true", () => {
        const el = transpile(`<input disabled />`);
        expect(el.props.disabled).toBe(true);
    });

    test("key is passed as third argument", () => {
        const el = transpile(`<div key="k"/>`);
        expect(el.key).toBe("k");
    });
});
