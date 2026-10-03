# Production chat request cap — 2026-10-01

Raised GLOBAL_DAILY_REQUEST_LIMIT from 12_000 to 30_000 in production chat-proxy-v2 (version 9) and chat-proxy (version 153). Both share the global accepted-request daily bucket. The 30_000_000 estimated-input-token cap remains unchanged.

Deployment used freshly downloaded production source and changed only this constant. All deployed files were fetched again and verified against the intended payload; JWT verification remains enabled. No schema, purchase configuration, or source-workspace deployment was included.

Important: the local chat-proxy-v2 source differs from production and does not contain the production rate limiter. Do not deploy the local function over production without reconciling those differences first.

## October 2 follow-up (Armenia time)

Raised the shared daily request cap from 30_000 to 50_000 using freshly fetched production files. Deployed chat-proxy-v2 version 10 and chat-proxy version 154. Downloaded both functions again and verified every file exactly matches the intended deployment, with only the request-cap constant changed. Both live chat smoke tests returned HTTP 200, CAP_OK, and a completion event. The 30_000_000 estimated-input-token cap, per-device/IP limits, JWT verification, and purchase configuration remain unchanged.
