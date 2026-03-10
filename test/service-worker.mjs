import "../node_modules/@babel/standalone/babel.js";
const Babel = self.Babel;
import plugin from "../dist/plugin.mjs";

Babel.registerPlugin("jsx-expressions", plugin);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
});

function transpile(source, url) {
    const {code, map} = Babel.transform(source, {
        filename: url,
        plugins: [["jsx-expressions"]],
        sourceMaps: true,
    });
    return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${btoa(JSON.stringify(map))}`;
}

self.addEventListener("fetch", (event) => {
    const url = event.request.url;
    if (url.endsWith(".ts") || url.endsWith(".tsx") || url.endsWith(".jsx")) {
        event.respondWith(fetch(event.request).then(async response => {
            if (!response.ok) {
                return response;
            }
            try {
                const source = await response.text();
                const code = transpile(source, url);
                const headers = new Headers(response.headers);
                headers.set("Content-Type", "application/javascript; charset=UTF-8");
                return new Response(code, {status: 200, headers});
            } catch (error) {
                console.error("error transpiling", url, error);
                return new Response(`throw new Error(${JSON.stringify(String(error))})`, {
                    status: 200,
                    headers: {"Content-Type": "application/javascript; charset=UTF-8"}
                });
            }
        }));
    } else {
        event.respondWith(fetch(event.request));
    }
});
