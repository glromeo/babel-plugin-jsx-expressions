import {jsx, Fragment} from "preact/jsx-runtime";

describe("transpiled runtime", () => {

    it("fragment returns a VNode with Fragment type", () => {
        expect((<></>).type).toBe(Fragment);
    });

    it("element has correct type and static props", () => {
        const el = <div class="hello">World</div>;
        expect(el.type).toBe("div");
        expect(el.props.class).toBe("hello");
        expect(el.props.children).toBe("World");
    });

    it("reactive child is wrapped in arrow function", () => {
        const sig = {value: "hello"};
        const el = <div>{sig.value}</div>;
        expect(typeof el.props.children).toBe("function");
        expect(el.props.children()).toBe("hello");
    });

    it("handler prop is not wrapped", () => {
        const el = <div onClick={null}/>;
        expect(el.props.onClick).toBeNull();
    });

    it("boolean attribute becomes true", () => {
        const el = <input disabled />;
        expect(el.props.disabled).toBe(true);
    });

    it("key is passed as third argument", () => {
        const el = <div key="k"/>;
        expect(el.key).toBe("k");
    });
});
