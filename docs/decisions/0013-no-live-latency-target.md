# 0013 · No fixed millisecond target for live steps
Date: 2026-11-01 · Status: Accepted

## Context
The PRD promised new steps within ~100 ms, but the agent, collector and UI waits add up to about 250 ms.

## Decision
No fixed millisecond promise for live steps: they appear while the request runs, and the delay varies with load. The internal batching values are tuning, not promises. The full map still appears within 300 ms of the response.

## Consequences
PRD non-functional requirements updated.
