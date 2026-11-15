# 19 · The server and its guards: token, origin, host
2026-11-14 · Task 2.7 · `packages/collector/src/server/app.ts`, `guards.ts`, `errors.ts`, `token.ts`, `listen.ts`

## In one sentence
The collector listens only on 127.0.0.1 and checks the `Host`, the `Origin` and a secret token, so a website you visit cannot read your recorded requests.

## Why we are doing this
The collector holds real request data: headers, bodies, errors. "Local only" is not safe by itself. Any web page in your browser can send requests to `localhost`. Without checks, a malicious page could read your traces. This serves the principle that recordings stay on the machine.

## How it works
Three checks in `guards.ts`:

1. **Host check (all routes).** `Host` must be `127.0.0.1:<port>` or `localhost:<port>`. This blocks **DNS rebinding**: an attacker's domain `evil.com` first resolves to their server, then switches to 127.0.0.1. The browser now thinks `evil.com` is "same origin" and talks to your collector, but the `Host` header still says `evil.com`, so we refuse (403).
2. **Origin check.** For REST, a present `Origin` must be our own UI. For `/live` (browser) it must exist and match. For `/agent` (a Node process, never a browser) *any* `Origin` is refused, because it means a web page is trying.
3. **Token.** A random secret in `.pathlight-tracker/` (mode 0600), sent as `Authorization: Bearer ...`. WebSockets cannot set headers easily, so it travels as the subprotocol `bearer.<token>`. It is compared in constant time (`tokensMatch`) so timing cannot leak it.

Results: missing or wrong token 401, foreign origin or host 403, bursts 429 with rate-limit headers. Also: body limit 64 KB, `Cache-Control: no-store` on `/api`, a strict Content-Security-Policy on the UI. Static UI files are served without a token (the token comes in the URL fragment `#token=`, which browsers never send to servers).

`listen.ts` tries port 4777 then fallbacks and writes `collector.json`. Errors use one envelope (`errors.ts`); 500s never echo internals.

## Why this way, not another
- Token only: does not stop DNS rebinding from a page that somehow gets the token.
- Origin only: non-browser clients can fake it. We use both (decision 0022).
- Missing `Origin` on REST is allowed because browsers omit it on same-origin GETs; the token still applies.

## Words to know
- **DNS rebinding**: tricking a browser into treating an attacker's domain as your local server.
- **Origin / Host**: headers saying where a request comes from / where it is going.
- **Bearer token**: a secret sent to prove permission.
- **constant-time compare**: comparison whose speed does not reveal how many characters matched.
- **CSP**: a header limiting what the page may load.

## Try it yourself
Start a collector, then run `curl -H "Host: evil.com" http://127.0.0.1:4777/api/health` and `curl -H "Origin: http://evil.com" ...`. Compare the status codes with and without the token.

## Check yourself
1. What does the Host check stop that the token check alone might not?
2. Why does `/agent` refuse any `Origin`?
3. Why is the token in `#token=` and not `?token=`?

<details><summary>Answers</summary>

1. DNS rebinding: the attacker's domain resolves to localhost, but the Host header exposes it.
2. The agent is a Node process; an Origin means a browser page is calling.
3. A fragment is never sent to the server, so it does not land in logs or referrers.
</details>

## Go deeper
- `docs/decisions/0022-*`, `docs/api-spec.md` §3, `docs/architecture.md` §4
