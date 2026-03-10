const {
  arrayExpression,
  arrowFunctionExpression,
  blockStatement,
  booleanLiteral,
  callExpression,
  identifier,
  importDeclaration,
  importSpecifier,
  isStringLiteral,
  isValidIdentifier,
  memberExpression,
  objectExpression,
  objectMethod,
  objectProperty,
  returnStatement,
  spreadElement,
  stringLiteral
} = require("@babel/types");

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE_URI = "http://www.w3.org/1999/xhtml";

const DEFAULTS = {
  preact: {
    factories: {
      jsx: {module: "preact/jsx-runtime", name: "jsx"},
      svg: {module: "preact/jsx-runtime", name: "jsx"},
      xhtml: {module: "preact/jsx-runtime", name: "jsx"},
      Fragment: {module: "preact/jsx-runtime", name: "Fragment"}
    }
  },
  wizkit: {
    factories: {
      jsx: {module: "@wizkit/jsx-runtime", name: "jsx"},
      svg: {module: "@wizkit/jsx-runtime", name: "svg"},
      xhtml: {module: "@wizkit/jsx-runtime", name: "xhtml"},
      Fragment: {module: "@wizkit/jsx-runtime", name: "Fragment"}
    },
    aliases: {
      "wizkit": "@wizkit/library/index.mjs"
    }
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getterMethod(prop, expression) {
  return objectMethod("get", prop, [], blockStatement([returnStatement(expression)]), prop.type === "StringLiteral");
}

function isHandler(id) {
  const name = id.name ?? id.value;
  return name.length > 1 && name[0] === "o" && name[1] === "n";
}

function isDirective(id) {
  const name = id.name ?? id.value;
  return name.length > 2 && name[2] === ":" && name[0] === "i" && name[1] === "s";
}

function tagIdentifier(tag) {
  if (tag.type === "JSXIdentifier") {
    const cc = tag.name.charCodeAt(0);
    return cc >= 65 && cc <= 90 && isValidIdentifier(tag.name)
        ? identifier(tag.name)
        : stringLiteral(tag.name);
  }
  return parseJSXMemberExpression(tag);
}

function parseJSXMemberExpression({object, property}) {
  return memberExpression(
      object.object
          ? parseJSXMemberExpression(object)
          : identifier(object.name),
      identifier(property.name)
  );
}

function jsxCallExpression(callee, tag, props, key) {
  const args = [tag, objectExpression(props)];
  if (key !== undefined) {
    args.push(key);
  }
  return callExpression(callee, args);
}

function reactiveProperty(useArrow, key, expression) {
  if (useArrow) {
    return objectProperty(key, arrowFunctionExpression([], expression));
  } else {
    return getterMethod(key, expression);
  }
}

// ─── Reactive detection ───────────────────────────────────────────────────────

const isReactive = (
    () => {
      const skipSubTree = (path) => {
        path.skip();
      };
      const markReactive = (path, state) => {
        state.isReactive = true;
        path.stop();
      };
      const jsxExpressionVisitor = {
        CallExpression: markReactive,
        MemberExpression: markReactive,
        NewExpression: skipSubTree,
        ArrowFunctionExpression: skipSubTree,
        FunctionExpression: skipSubTree
      };
      return path => {
        const state = {isReactive: false};
        path.traverse(jsxExpressionVisitor, state);
        return state.isReactive;
      };
    }
)();

function isIntrinsic(tagName) {
  return isStringLiteral(tagName) || tagName.name === "Fragment";
}

// ─── JSX node visitor (shared for JSXElement and JSXFragment) ─────────────────

const CHILDREN = identifier("children");

const jsxNodeVisitor = {
  enter(path, state) {
    state.ctx = {
      __proto__: state.ctx,
      tagName: undefined,
      key: undefined,
      props: []
    };
  },
  exit(path, state) {
    const {factory = state.factories.jsx, tagName, key, props} = state.ctx;
    state.ctx = Object.getPrototypeOf(state.ctx);

    const childrenPaths = path.get("children");
    const children = [];
    const reactive = [];

    path.node.children.forEach((child, index) => {
      if (child.type === "JSXText") {
        const text = child.value.replace(/^\n\s*/, "").replace(/\n\s*$/, "").replace(/\s+/g, " ");
        if (text) children.push(stringLiteral(text));
      } else if (child.type === "JSXExpressionContainer") {
        if (child.expression.type !== "JSXEmptyExpression") {
          if (isReactive(childrenPaths[index])) {
            reactive.push(children.length);
          }
          children.push(child.expression);
        }
      } else if (child.type === "JSXSpreadChild") {
        if (isReactive(childrenPaths[index])) {
          reactive.push(children.length);
        }
        children.push(spreadElement(child.expression));
      } else {
        // already-transformed children (CallExpression from inner JSX, etc.)
        children.push(child);
      }
    });

    if (children.length) {
      const isSpread = children.some(n => n.type === "SpreadElement");
      const value = (
          children.length > 1 || isSpread
      )
          ? arrayExpression(children)
          : children[0];

      if (reactive.length === 0 || (
          isIntrinsic(tagName) && children.length > 1 && !isSpread
      )) {
        for (const i of reactive) {
          children[i] = arrowFunctionExpression([], children[i]);
        }
        props.push(objectProperty(CHILDREN, value));
      } else {
        props.push(reactiveProperty(isIntrinsic(tagName), CHILDREN, value));
      }
    }

    path.replaceWith(jsxCallExpression(factory, tagName, props, key));
    path.skip();
  }
};

// ─── Plugin ───────────────────────────────────────────────────────────────────

/**
 * Babel plugin JSX expressions
 *
 * @param babel {{types: import("@babel/types")}}
 * @param options {{ factories?: object, aliases?: object }}
 * @returns {import("@babel/core").PluginObj}
 */
module.exports = function pluginJsxExpressions(babel, options = {}) {
  const factoryConfig = Object.assign({}, DEFAULTS.preact.factories, options.factories);
  const aliases = Object.assign({}, DEFAULTS.preact.aliases, options.aliases);

  return {
    name: "plugin-jsx-expressions",

    manipulateOptions(opts, parserOpts) {
      if (!parserOpts.plugins) parserOpts.plugins = [];
      if (!parserOpts.plugins.includes("jsx")) parserOpts.plugins.push("jsx");
      if (!parserOpts.plugins.includes("typescript")) parserOpts.plugins.push("typescript");
    },

    visitor: {
      Program(root, state) {

        function importIdentifier({module, name}) {
          const id = identifier(name);
          for (const node of root.node.body) {
            if (node.type !== "ImportDeclaration" && node.type !== "InterpreterDirective") break;
            if (node.source.value === module) {
              if (node.specifiers.some(s => s.type === "ImportSpecifier" && s.local.name === name)) {
                return id;
              }
              node.specifiers.unshift(importSpecifier(id, id));
              return id;
            }
          }
          root.unshiftContainer("body", importDeclaration([importSpecifier(id, id)], stringLiteral(module)));
          return id;
        }

        const factories = {};
        for (const key of Object.keys(factoryConfig)) {
          let name = null;
          Object.defineProperty(factories, key, {
            get() {
              if (name === null) name = importIdentifier(factoryConfig[key]).name;
              return identifier(name);
            },
            configurable: true,
            enumerable: true
          });
        }

        state.factories = factories;
        state.ctx = {xmlns: XHTML_NAMESPACE_URI};
      },

      ImportDeclaration(path) {
        const alias = aliases[path.node.source.value];
        if (alias !== undefined) {
          path.node.source.value = alias;
        }
      },

      JSXFragment: jsxNodeVisitor,
      JSXElement: jsxNodeVisitor,

      JSXOpeningElement(path, {factories, ctx}) {
        const tag = path.node.name;
        if (tag.type === "JSXNamespacedName") {
          const {namespace, name} = tag;
          switch (namespace.name) {
            case "svg":
              ctx.xmlns = SVG_NAMESPACE_URI;
              ctx.factory = factories.svg;
              break;
            case "xhtml":
              ctx.xmlns = XHTML_NAMESPACE_URI;
              ctx.factory = factories.xhtml;
              break;
            default:
              ctx.factory = identifier(namespace.name);
          }
          ctx.tagName = stringLiteral(name.name);
        } else {
          ctx.tagName = tagIdentifier(tag);
          if (isStringLiteral(ctx.tagName) && ctx.tagName.value === "svg") {
            ctx.xmlns = SVG_NAMESPACE_URI;
            ctx.factory = factories.svg;
          }
        }
      },

      JSXOpeningFragment(path, {factories, ctx}) {
        ctx.tagName = factories.Fragment;
      },

      JSXSpreadAttribute(path, {ctx}) {
        ctx.props.push(spreadElement(path.node.argument));
      },

      JSXAttribute: {
        enter(path, {factories, ctx}) {
          if (path.node.name.type === "JSXNamespacedName") {
            const {namespace, name} = path.node.name;
            ctx.attr = stringLiteral(`${namespace.name}:${name.name}`);
          } else {
            const {name: {name}, value} = path.node;
            if (name === "key") {
              ctx.key = value?.expression ?? value;
              path.skip();
            }
            if (name === "xmlns") {
              const {type, value: xmlns} = value;
              if (type === "StringLiteral") {
                ctx.xmlns = xmlns;
                if (xmlns === SVG_NAMESPACE_URI) {
                  ctx.factory = factories.svg;
                } else if (xmlns === XHTML_NAMESPACE_URI) {
                  ctx.factory = factories.xhtml;
                } else {
                  throw path.buildCodeFrameError(`invalid xmlns value: "${xmlns}"`);
                }
              } else {
                throw path.buildCodeFrameError(`invalid xmlns type: ${type}`);
              }
              path.skip();
            }
            ctx.attr = name === "class" || name === "style" || isValidIdentifier(name)
                ? identifier(name)
                : stringLiteral(name);
          }
        },
        exit(path, {ctx}) {
          const {props, tagName, attr} = ctx;
          const {value} = path.node;
          if (value?.type === "JSXExpressionContainer") {
            const expression = value.expression;
            if (!isHandler(attr) && isReactive(path.get("value"))) {
              const useArrow = isIntrinsic(tagName) && !isDirective(attr);
              props.push(reactiveProperty(useArrow, attr, expression));
            } else {
              props.push(objectProperty(attr, expression));
            }
          } else {
            props.push(objectProperty(attr, value ?? booleanLiteral(true)));
          }
        }
      }
    }
  };
};
