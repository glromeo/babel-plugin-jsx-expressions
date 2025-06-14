const parse = require("@babel/parser").parse;
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const {
    arrowFunctionExpression,
    callExpression,
    expressionStatement,
    file,
    identifier,
    importDeclaration,
    importSpecifier,
    program,
    stringLiteral
} = require("@babel/types");
const {readFile} = require("fs/promises");

function containsMemberAccess(expr) {
    let found = false;

    traverse(file(program([expressionStatement(expr)])), {
        MemberExpression(path) {
            found = true;
            path.stop();
        }
    });

    return found;
}

module.exports = () => {
    return {
        name: "preact-jsx-signals",
        setup({onLoad}) {
            onLoad({filter: /\.(jsx|tsx)$/}, async (args) => {
                const source = await readFile(args.path, {encoding: "utf8"});

                const ast = parse(source, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"]
                });

                let importComputed = false;

                traverse(ast, {
                    JSXExpressionContainer(path) {
                        const expr = path.node.expression;
                        if (containsMemberAccess(expr)) {
                            importComputed = true;
                            path.node.expression = callExpression(
                                identifier("computed"),
                                [arrowFunctionExpression([], expr)]
                            );
                        }
                    },
                    JSXSpreadAttribute(path) {
                        const arg = path.node.argument;
                        if (containsMemberAccess(arg)) {
                            importComputed = true;
                            path.node.argument = callExpression(
                                identifier('computed'),
                                [arrowFunctionExpression([], arg)]
                            );
                        }
                    }
                });

                if (importComputed) {
                    ast.program.body.unshift(
                        importDeclaration(
                            [importSpecifier(identifier("computed"), identifier("computed"))],
                            stringLiteral("@preact/signals")
                        )
                    );
                }

                const {code, map} = generate(ast, {
                    sourceMaps: true,
                    sourceFileName: args.path
                }, source);

                const encodedMap = Buffer.from(JSON.stringify(map)).toString("base64");
                const contents = `${code}\n//# sourceMappingURL=data:application/json;base64,${encodedMap}`;

                return {
                    contents,
                    loader: "tsx",
                    resolveDir: require("path").dirname(args.path),
                    watchFiles: [args.path]
                };
            });
        }
    };
};