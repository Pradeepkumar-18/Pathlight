# 0010 · Red error path and how swallowed errors are detected
Date: 2026-11-01 · Status: Accepted

## Context
An error is recorded when it is thrown, before anyone knows whether it will be ignored. The docs wanted swallowed and converted errors flagged with no rule for how.

## Decision
The collector decides after the fact:
- **Swallowed** (shown as "Caught", violet): a thrown error after which an enclosing function returns normally.
- **Converted**: an exception filter or error middleware turns it into a response.
- **Unhandled**: it reaches the response without being handled.

The **red path** runs from the root to the step that threw, only for errors that reached the response (unhandled, or converted to a 5xx). With several errors, red goes to the one that reached the response; the others show as Caught.

## Alternatives considered
Red for every thrown error (misleading on 200 responses); deciding in the agent (it cannot know the outcome yet).

## Consequences
PRD FR-9 and architecture §11 #20 updated; trace builder (task 2.9) implements the rule. "caught", "swallowed" and "Caught" are documented as the same thing in task 0.8.
