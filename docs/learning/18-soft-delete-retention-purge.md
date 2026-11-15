# 18 · Soft delete, retention and purge
2026-11-14 · Task 2.6 · `packages/collector/src/store/lifecycle.ts`, `cli/clear.ts`

## In one sentence
Deleting a request moves it to a trash first, retention keeps the active list small, and a purge job removes old trash for good.

## Why we are doing this
A debug tool records constantly, so the database would grow forever. But deleting at once is risky: you click "clear" by mistake and your only recording of the bug is gone. So we use three layers: soft delete (undo possible), retention (automatic size limit) and purge (real removal). This keeps the disk small without surprising the developer.

## How it works
```
active  --softDelete / retention-->  trash  --TTL passed or empty trash-->  gone
   ^------------- restore ---------------|
```

- `softDelete` sets `deleted_at`. Steps stay, so `restore` brings everything back.
- A request still **in progress** can never be deleted (the agent is still writing to it).
- `applyRetention`: when there are more active requests than the limit, the oldest *finished* ones go to the trash. Retention never purges directly and never touches in-progress requests.
- `restore` over the limit: the restored request stays and the oldest active one is trashed instead.
- `purgeExpired`: trash older than the TTL is deleted (cascades remove steps and object refs, lesson 15), then empty disconnected sessions, then an incremental vacuum gives the disk space back.
- `startPurgeJob` runs at startup and hourly. The timer is `unref`'d so it never keeps Node alive by itself.

Each function returns the IDs it touched, so the live hub (lesson 23) can tell open browser tabs.

`pathlight-tracker clear` moves everything to the trash; `clear --purge` asks for confirmation with counts (`--yes` skips it). If there is nothing to clear it says so without creating a database file.

## Why this way, not another
- Hard delete only: simplest, but no undo.
- Retention going straight to purge: a busy session could silently destroy the request you were about to open; the trash gives a grace period.
- Follow-up (done in 2.10): `clear` should go through a running collector so tabs update.

## Words to know
- **soft delete**: mark as deleted, keep the data.
- **retention**: the rule for how much history to keep.
- **TTL**: time to live, how long trash stays before purge.
- **vacuum**: give freed database pages back to the file system.
- **`unref`**: a timer that does not stop the process from exiting.

## Try it yourself
Run `pnpm seed` in a scratch folder, then `pathlight-tracker clear` and look at `deleted_at` in the database. Then `clear --purge` and answer "no" to the prompt.

## Check yourself
1. Why can an in-progress request not be deleted?
2. What happens to steps on soft delete? On purge?
3. Why does retention move to the trash and not delete?

<details><summary>Answers</summary>

1. The agent is still adding steps to it; deleting would break writes.
2. Soft delete keeps them; purge removes them by cascade.
3. To leave time to undo; only the purge job removes data for good.
</details>

## Go deeper
- `docs/data-model.md` (soft delete, retention sections)
- Lesson [16](16-seed-data.md) for cascades in practice.
