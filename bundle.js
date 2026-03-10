const esbuild = require('esbuild');

esbuild.build({
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: false,
    define: {
        "process.env": JSON.stringify({}),
        "process.env.NODE_ENV": JSON.stringify("production")
    },
    entryPoints: ['index.js'],
    outfile: 'dist/plugin.mjs',
}).then(() => {
    console.log('bundle complete!');
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
