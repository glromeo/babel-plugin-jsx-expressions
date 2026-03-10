module.exports = {
    presets: [
        ["@babel/preset-typescript"]
    ],
    plugins: [
        [require("./index.js")],
        ["@babel/plugin-transform-modules-commonjs"]
    ]
};
