const {
    arrowFunctionExpression,
    callExpression,
    identifier,
    importDeclaration,
    importSpecifier,
    stringLiteral,
} = require("@babel/types");

/**
 * Preact JSX Signals Plugin
 *
 * @param babel {{types: import("@babel/types")}}
 * @param options {any}
 * @returns {import("@babel/core").PluginObj}
 */
module.exports = function preactJsxSignalsPlugin(babel, options = {}) {
    return {
        name: "preact-jsx-signals",

        manipulateOptions(opts, parserOpts) {
            if (!parserOpts.plugins) {
                parserOpts.plugins = [];
            }
            if (!parserOpts.plugins.includes("jsx")) {
                parserOpts.plugins.push("jsx");
            }
            if (!parserOpts.plugins.includes("typescript")) {
                parserOpts.plugins.push("typescript");
            }
        },

        visitor: {
            Program: {
                enter(path, state) {
                    state.shouldInject = false;
                    state.shouldWrap = [];
                },
                exit(path, state) {
                    if (state.shouldInject) {
                        path.unshiftContainer("body",
                            importDeclaration(
                                [importSpecifier(identifier("computed"), identifier("computed"))],
                                stringLiteral("@preact/signals")
                            )
                        );
                    }
                }
            },

            JSXExpressionContainer: {
                enter(path, state) {
                    state.shouldWrap.push(false);
                },
                exit(path, state) {
                    if (state.shouldWrap.pop()) {
                        state.shouldInject = true;
                        path.node.expression = callExpression(
                            identifier("computed"),
                            [arrowFunctionExpression([], path.node.expression)]
                        );
                    }
                }
            },

            JSXSpreadAttribute: {
                enter(path, state) {
                    state.shouldWrap.push(false);
                },
                exit(path, state) {
                    if (state.shouldWrap.pop()) {
                        state.shouldInject = true;
                        path.node.argument = callExpression(
                            identifier("computed"),
                            [arrowFunctionExpression([], path.node.argument)]
                        );
                    }
                }
            },

            MemberExpression(path, state) {
                if (state.shouldWrap.length) {
                    state.shouldWrap[state.shouldWrap.length - 1] = true;
                }
            }
        }
    };
};
;
