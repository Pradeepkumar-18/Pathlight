/** Agent ↔ collector and collector ↔ UI protocol major version (`v` on every message). */
export const PROTOCOL_VERSION = 1;

/** WebSocket subprotocol both `/agent` and `/live` offer, next to `bearer.<token>`. */
export const PROTOCOL_SUBPROTOCOL = `pathlight-tracker.v${PROTOCOL_VERSION}`;
