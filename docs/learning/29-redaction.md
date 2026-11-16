# 29 · Redaction: secrets never leave the app
2026-11-16 · Task 3.4 · `packages/agent/src/capture/redact.ts`, `capturer.ts`

## In one sentence
Values under secret-looking keys (`password`, `authorization`, `accessToken`, ...) are replaced with `[REDACTED]` inside the agent, before they are read, buffered or sent.

## Why we are doing this
Request bodies and headers hold passwords and tokens. The debug map would show them, the database would store them, a screenshot would leak them. The safest place to hide a secret is the earliest place: in the app's own process (PRD FR-11, CLAUDE.md "no tokens or captured values outside the database").

## How it works
- A key is **normalised**: lower-case, with `-` and `_` removed. So `x-api-key`, `X_API_KEY` and `apiKey` all become `xapikey` / `apikey`.
- Two lists:
  - **Contains** (matched anywhere in the key): `password`, `passwd`, `pwd`, `secret`, `token`, `authorization`, `cookie`, `apikey`, `accesskey`, `privatekey`, `credential`, `session`, `jwt`.
  - **Exact only**: `otp`, `pin`, `cvv`.
- `PATHLIGHT_TRACKER_REDACT_KEYS` adds your own words; they match like the "contains" list.
- The secret value is replaced **before it is read**. This matters: reading could run a getter, and a secret that was read could end up in a preview.
- `redactUrl` handles query strings: `https://x/cb?token=abc&page=2` becomes `https://x/cb?token=[REDACTED]&page=2`.
- `createCapturer` combines caps (lesson [28](28-safe-value-capture.md)) and redaction in one function, so a patch cannot capture without redacting.

## Why this way, not another
- Why are `otp`, `pin`, `cvv` exact only? As parts of words they would hide `notPaid`, `footprint`, `shipping`. Over-redaction makes the map useless; under-redaction leaks. This trade-off is the heart of the task.
- A key list is a guess: a secret stored under `data.x` is not caught. Honest limit; the docs (`architecture.md` §8) are the place to state it. Added to open questions.
- A small cache (max 2000 keys) avoids repeating the string work, and is bounded so distinct keys cannot grow memory.
- Test: a `request.start` full of secrets goes through the real transport; none arrive at the collector.
- Sources: `architecture.md` §8 and §9, PRD FR-11.

## Words to know
- **redact**: replace a sensitive value with a marker.
- **normalise**: bring text to one standard form before comparing.
- **false positive**: hiding something that was not secret (`notPaid`).
- **false negative**: showing something that was secret.

## Try it yourself
In `redact.test.ts`, add a test that `isSecretKey('Set-Cookie')` is true and `isSecretKey('shipping')` is false. Then try `createRedactor(['ssn'])` and check `userSSN` is secret.

## Check yourself
1. Why does `accessToken` match `token` but `shipping` not match `pin`?
2. Why replace the value before reading it?
3. Name one kind of secret this approach can miss.

<details><summary>Answers</summary>

1. `token` is in the "contains" list; `pin` is "exact only", and `shipping` is not exactly `pin`.
2. Reading can run user code or put the secret in a preview; the secret must never even be touched.
3. A secret under an ordinary key name (e.g. `data.x`) or inside a free-text string.
</details>

## Go deeper
- `docs/architecture.md` §8 and §9
