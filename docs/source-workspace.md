# Documents and video summaries — release checklist

## Latest extraction review — 2026-10-03

Production `document-process` v6 has been recovered into `supabase/functions/document-process/recovered-v6.ts` using the Management API; no prior source was found in this checkout's history. The replacement source, pinned dependencies/lockfile, synthetic fixtures and tests are now in `supabase/functions/document-process/`. See that directory's README for the contract, provenance, fidelity limits and commands.

**Deployment:** after explicit owner approval on 2026-10-03, production `document-process` v7 is ACTIVE with JWT verification enabled. Readback matches tested canary v2; both have bundle SHA-256 `3e89aecb0b4364ce33c928cfe361a37203bc3c4601fbe9066db7b5f9a8485e32`. Production checks passed for partial-page metadata, encrypted/150-page rejection, PDF/DOCX/CSV extraction, combined summary and ownership. Evidence: `tmp/document-extraction-qa/production-smoke.log` and `production-workspace.log`. `source-analyze` production remains v4; no source-analyze or chat endpoint was deployed in this extraction review. No schema, prices, entitlement rules or quotas changed.

The replacement recovers tested PDF text outside MediaBox/CropBox, includes DOCX table cells/text boxes/headers/footers/notes, supports UTF-8 and BOM-labelled UTF-16 plus Latin-1-compatible fallback, detects PDF/DOCX content independently of the supplied MIME, and parses quoted CSV records. Encrypted PDFs return `ENCRYPTED_DOCUMENT`; invalid/binary formats return `UNSUPPORTED_DOCUMENT`; PDFs above 100 pages return `TOO_MANY_PAGES`. The 200,000-character cut is disclosed by `truncated`, and PDFs return `pageCount`, text-bearing `extractedPages` and `partialText`. This deliberately rejects 150-page PDFs rather than summarizing a silent first-100-page prefix.

The client preserves these fields through upload normalization, chat attachment persistence, pending jobs and validated saved records. Sources displays text-bearing page counts and partial/truncated notices. Chat errors map by code. The four new chat error strings have explicitly allowlisted English fallback in all locale catalogs, matching the existing file-upload fallback policy; this is not a completed translation pass. Workspace copy also retains its English fallback. No optional chat-proxy marker change was made.

Validation: 11 Deno extraction/HTTP tests passed; 309 Jest tests passed in 55 suites; changed-file ESLint has zero errors and one existing inline-style warning. Live canary tests passed for PDF/DOCX, mislabelled files, Unicode, cropped/off-page text, mixed text/textless pages, encrypted and 150-page rejection, valid 100-page files, actual PDF character truncation, malformed encoding/CSV, and the 10 MiB inclusive byte boundary for TXT/PDF. The existing `tmp/verify-source-workspace.cjs --documents` passed using `DOCUMENT_ENDPOINT=document-process-canary` and `SOURCE_ENDPOINT=source-analyze-canary`: combined French summary, no-text rejection and ownership. Its scratch script now supports the document endpoint override. Database readback of only generated fixtures confirmed expected text and seven-day expiry. The existing active cleanup job runs hourly at minute 17 and deletes expired document rows.

Evidence: `tmp/document-extraction-tests.log`, `tmp/document-extraction-jest.log`, `tmp/document-extraction-lint.log`, and `tmp/document-extraction-qa/{canary-final-live.log,workspace-live.log,canary-results.json}`. No new native APK or store release was produced in this extraction review; client metadata integration was tested in Jest. Test builds installed during earlier sections predate these client changes.

Remaining limitations: no OCR; PDF content-stream reading order can differ from visual columns/tables; complex-script order/font mappings are not universally recoverable; DOCX equations/embedded objects and visual layouts are not reconstructed. Page metadata is stored locally, not in new server columns. The canary shares the production database and uses only synthetic QA files. Backend deployment is complete; client metadata/UI changes still require a new app release.

## Current state

The owner authorized backend implementation on 2026-10-02, superseding the earlier backend hold. The additive migration `20261001233338_source_workspace_jobs.sql` is applied to project `lkpmzvrveyocaodaixss`. The new `source-analyze` endpoint is ACTIVE (version 1), with gateway JWT verification enabled. `source-analyze-canary` was used for live integration checks in the same project; this is not a separate staging database.

Enabled: Documents, pasted transcripts and uploaded MP4/WebM speech summaries. YouTube remains disabled because the configured Gemini key was rejected as invalid. OpenAI transcription and text summarization work with the existing server-side key. Visual-frame analysis, YouTube caption/media retrieval, scanned-PDF OCR and cloud library sync are not implemented. No Play release has been published.

Paywalls, prices, purchase flows and the existing chat functions were not changed by this implementation. The production chat cap remains 50,000 requests/day.

## Backend contract

GET source-analyze returns contractVersion 2, available, per-source flags and limits. Each capability is independently gated. Version-1 readiness is incompatible. Previously confirmed capabilities and saved briefs remain usable offline.

POST takes JSON for document IDs, transcripts or enabled YouTube links, or multipart metadata plus a video file. Headers include existing Authorization/apikey, x-client-id, a separately generated x-workspace-key stored in Keychain, and a stable x-request-id persisted before submission.

The server hashes the capability and device ID. A device ID alone cannot read/cancel jobs. Existing document references retain their established device-hash ownership boundary. This is device-capability access, not authenticated-account identity; per-device quotas can be evaded by creating identities. Global limits provide a separate cost boundary.

POST returns a saved job. GET ?id=UUID retrieves status/result; DELETE cancels and clears that job's result. Same-ID retries return the same job. Different source content under that ID returns REQUEST_CONFLICT. Tables have RLS and no public/client grants. The reservation RPC is service-only and uses an atomic lock.

Default analysis quotas are 50 accepted attempts/device/day and 1,000 globally/day, UTC, with one active job/device. Failed/cancelled jobs remain counted. These limits are separate from chat and configurable in source_workspace_settings; review budgets before broad rollout. The obsolete undeployed 20-request quota draft was removed.

EdgeRuntime.waitUntil continues accepted work after a client disconnect. Provider work has a 105-second deadline. Job records are durable, but worker execution remains bounded by Edge runtime limits. On retrieval, a stopped worker becomes TIMEOUT after 150 seconds, with no silent paid retry. This is not a durable media queue or resumable upload. Job records expire after seven days with hourly cleanup.

## Source behavior

- Documents: existing document-process remains unchanged. PDF/DOCX/TXT/CSV, three files, 10 MB each. Existing extraction limits are 100 PDF pages and 200,000 characters per file. Quotes must match extracted text. Textless scans fail explicitly; no page numbers are invented.
- Transcripts: 40–120,000 characters. Chapters use only source timestamps. Summaries use OpenAI Responses, strict JSON and store:false.
- Video uploads: MP4/WebM, 20 MB, up to 10 minutes of speech. Whisper-1 provides segment timestamps, then the text model summarizes. Silence is filtered and overlong/unreadable recordings fail explicitly. Results disclose speech-only coverage and transcription uncertainty. MOV is not advertised.
- Pasted/generated transcripts become owned seven-day chat document references. Follow-up chat can use source text instead of only the brief; existing chat context limits still apply.
- Raw videos are not stored persistently by this implementation. Local brief deletion does not delete prior chats or retained source text; document expiry uses the existing cleanup job.

The app persists pending metadata before submission and keeps it on lost acknowledgement, disconnect or navigation. Check progress retrieves the existing job. Stop waiting stops local polling; Cancel analysis requests server cancellation. Results save before pending metadata is removed. Disk failures leave the visible result recoverable.

UI uses the existing dark palette and Lato fonts. New copy has English fallback; summary language follows the app locale. Full translation of the new namespace remains outstanding.

## Checks completed before interruption

- 276 client tests across 50 suites passed. The new recovery regression confirms pre-acceptance provider configuration failures do not leave a pending job blocking the next attempt.
- Backend lifecycle/provider tests passed: ownership, duplicate requests, quotas, cancellation, dead-worker recovery, malformed results, timestamped uploads and duration rejection.
- Database rollback checks passed for disabled features, reservation/idempotency, ownership, quota and restricted grants.
- Live TXT/PDF/DOCX/CSV extraction and combined French analysis passed.
- Textless PDF, wrong-owner and missing-document rejection passed.
- Live MP4 produced accurate fixture numbers, timestamped chapters and a transcript reference.
- A live follow-up chat using that transcript answered 37 correctly.
- Both existing production chat endpoints returned CAP_OK and completed streams.
- Release Android JavaScript bundle and modified frontend lint passed.

Advisors list informational no-policy notices for the intentionally service-only new tables. Pre-existing coins/rewards/reporting findings were not changed. [Advisor reference](https://supabase.com/docs/guides/database/database-linter).

## Simulator verification on 2026-10-02

Android 15 (`ChatCloud_API35_QA`) booted using the normal detached launcher after earlier renderer startup failures. Debug APK installation preserved simulator data and loaded the current JavaScript through Metro.

- Native DOCX selection → extraction → accurate brief → Android text share sheet → follow-up chat passed. Fixture answers were 37 volunteers and $8,200.
- Native MP4 selection → OpenAI speech transcription → accurate brief → timestamped chapters → follow-up chat passed. Chat correctly reported that a public launch was not approved and two battery issues remained unresolved.
- Saved video brief reopened after process termination/relaunch.
- A transcript submitted just before force-stopping the app completed on the server. Its pending request survived restart. Offline progress retrieval showed a network error and preserved the same request. Reconnecting and checking progress retrieved the original completed result, without another analysis submission.
- Live API cancellation of a processing job passed. Its result remained cleared after the worker had time to finish, and the same request ID did not restart work.
- Fixed result scroll position: new/reopened briefs start at the top. Verified by reopening the saved video brief from the bottom of the library. Pending controls are hidden while the active progress controls are displayed.
- At 150% Android font scale after a cold start, document controls wrapped/read correctly, a long filename stayed within its two-line row with an accessible remove control, and the result tabs remained usable. A saved document brief reopened with both Wi-Fi and mobile data disabled. Network and font-scale settings were restored afterward.
- Release APK build completed successfully across all four configured ABIs, including resource shrinking and release lint. A copy signed with the existing debug test key was installed over the simulator's debug app to preserve its data. The original release-signed APK was not modified. Metro forwarding was removed and the packaged app ran independently.
- Release build: DOCX/TXT picker/extraction/analysis worked, development sample controls were absent, existing chat history reopened, and a normal chat request returned 56 for 7 × 8. Existing chat file upload still opened the Premium gate for a non-premium test installation. No purchase was attempted.
- Release testing found percent-encoded document labels. The client now preserves the original picker filename and uses matching document indexes for readable evidence labels in saved/resumed results and exports. The full 276-test suite passed again after this fix.
- The final incremental release build succeeded and was installed. A new long-filename TXT import produced a completed brief with the original readable filename in both the brief header and source excerpts. Final screenshot: `tmp/workspace-review/simulator-release-document-brief.png`.
- A fresh MP4 upload in that final release build also completed with correct fixture facts and speech-only coverage disclosure. Final screenshot: `tmp/workspace-review/simulator-release-video-brief.png`. No Android runtime or React Native fatal errors appeared in the captured smoke-test logs.

Evidence is saved under `tmp/workspace-review/`: `simulator-document-chat.png`, `simulator-video-brief.png`, `simulator-video-chat.png`, and `simulator-offline-recovery.png`. These are synthetic fixtures, not customer data. The debug app intentionally replays onboarding on cold start via the pre-existing `App.js` development override.

## UI refinement on 2026-10-02

Documents and Video now use the chat background, Lato typography, rounded neutral surfaces, existing SVG icons and white primary controls. Entry screens have shorter instructions, readable file limits and equal-width selection controls. Analyze stays disabled until a source is supplied. Results omit the upload introduction and show the summary immediately, with a persistent Continue in chat action and a compact share control. The library has file icons, a clear-search action and a distinct no-results state.

Simulator checks covered a fresh TXT import and live summary, a fresh transcript with correct 00:00/00:12 chapters, opening a saved document in chat, and the native share sheet. Long filenames and 150% font scale were checked; the upload heading now takes the full available width to avoid clipping. No backend, pricing, entitlement or purchase changes were made for this UI pass.

Screenshots: `tmp/workspace-review/ui-documents.png`, `ui-video.png`, `ui-document-summary.png`, `ui-documents-large-text.png`, and `ui-summary-large-text.png`. The release build is installed on the simulator using a test-signed copy; nothing was uploaded to Play.

Final keyboard verification found and fixed a search field moving behind the keyboard when filtering shortened the saved list. The screen now uses the existing KeyboardAwareScrollView, keeps focused inputs visible after content changes, and dismisses the keyboard when analysis starts. No-result search and clearing the query were verified on the final release installation; reopening a saved MP4 summary still starts at the top with its chat action visible. Evidence: `ui-search-keyboard.png` and `ui-video-summary.png`. Final validation: all 276 tests in 50 suites passed, changed screen lint passed, and `:app:assembleRelease` succeeded (`assemble-ui-keyboard.log`).

## Color and motion design on 2026-10-02

The subsequent product-design pass replaces the neutral entry treatment with blue/cyan Documents and violet/coral Video themes. Custom transparent 3D illustrations, gradient actions, numbered source/depth sections, format badges, tinted selection controls and matching result cards carry these colors into the chat shortcuts. Existing Lato typography and dark navigation remain consistent with the app. The artwork is rendered imagery with native floating/rotation animation, not an interactive 3D mesh. Exact generation prompts and asset provenance are in `assets/images/workspace/README.md`.

Decorative motion uses the native animation driver and stops when the route loses focus, the app enters the background or reduced motion is enabled. On the release simulator, two app-region captures taken two seconds apart with reduced motion enabled were identical. At 150% font scale after a cold start, the hero stacks its illustration above its title; copy, format badges and upload controls remained readable. Font scale and animation preferences were restored afterward.

Validation: all 276 tests across 50 suites passed; changed-file lint had no errors (two nonfatal inline-style warnings); the full release build succeeded. The packaged release was installed using a simulator test-signed copy. Native checks confirmed Documents/Video entry screens, reopening a saved MP4 summary, switching to timestamped chapters and continuing into its source-aware chat. No Android runtime or React Native errors appeared in the captured smoke-test log. This design pass made no backend, paywall, pricing or purchase changes.

Evidence: `tmp/workspace-review/product-documents.png`, `product-video.png`, `product-summary.png`, `product-large-text.png`, and the eight-second `product-documents-motion.mp4`. Build/test logs are `assemble-product-design.log` and `product-design-tests.log`. The simulator APK is `app-product-design-simulator.apk`; nothing was uploaded to Play.

## Cloud Studio creative revision on 2026-10-02

Following the owner's rejection of the technical-looking layout, Creative Production was used to develop a warmer editorial direction. Its board `d0765617-99a5-47a5-b619-5bef45e0782f` contains the generated paper-sculpture artwork. Documents and Video now share a peach/ivory/lilac illustrated header with slow native motion. Numbered setup headings, format tiles and the nested form card were removed. Actions use plain language (Add files, Get summary, Ask about this), and summary options read Short & sweet / The full picture. Chat shortcuts and summary cards use the same warm neutral and lilac accents. The app's dark navigation and Lato fonts remain.

Fifteen targeted client/chat flow tests passed (`studio-tests.log`). Changed-file ESLint reported no errors and two existing inline-style warnings. The final release build succeeded (`assemble-studio-final.log`) and a test-signed copy was installed on the Android 15 simulator. Native checks covered both entry screens, switching summary length and transcript mode, opening a saved MP4 summary, and its chat handoff. At 150% text size, the header, upload guidance and selection cards wrapped without overlap. Reduced motion was enabled for static inspection and restored to normal along with font scale. No runtime/React Native errors appeared in the captured smoke-test log. This UI revision did not submit a new paid analysis or change backend/purchase behavior.

Final screenshots: `tmp/workspace-review/studio-documents.png`, `studio-video.png`, `studio-summary.png`; enlarged-text evidence: `studio-large-text.png` (before the final button-background color correction). Motion recording: `studio-motion.mp4`. Artwork path and exact prompt: `assets/images/workspace/README.md`. No store release was published.

## Physical phone verification on 2026-10-02

Tested on the connected Xiaomi 21091116AG running Android 12, using the packaged release build signed with the existing debug test key. Installation preserved app data; no Play release or backend/paywall change was made. Evidence is under `tmp/physical-qa/`.

| Flow | Physical result |
| --- | --- |
| Normal chat | Passed: 17 × 23 returned 391. |
| Image chat | Passed: selected a synthetic image through Android Photos; response correctly identified a red square and blue circle. |
| DOCX summary and follow-up | Passed: native picker, upload, analysis, save, share-sheet opening/cancel and source-aware chat; 37 volunteers and $8,200 preserved. |
| PDF + CSV + TXT together | Passed after CSV picker fix: three sources selected/uploaded together and result kept Cedar and garden budgets separate. Source excerpts used readable filenames. PDF fixture text ran outside its page bounds and the extractor truncated that line; this fixture does not establish full PDF extraction fidelity. |
| Local MP4 | Passed: native picker, upload, speech transcription, saved summary, chapters and follow-up chat. Correctly stated two unresolved issues and no approved public launch. Visual understanding and video playback were not tested/supported by this flow. |
| Pasted transcript | Passed: fresh Orchid fixture preserved 18 students, $640, Nora bringing six cameras Tuesday, and outdoor-session cancellation due to rain. |
| Saved content/offline | Saved summaries survived application reinstall/reopen. With Wi-Fi disabled and mobile data already off, chat displayed its offline state and a saved summary remained readable. This phone run did not establish interrupted-job recovery. |
| History | Search filtered the arithmetic conversation and reopening restored its messages. |
| Private chat | Returned 824, then the unique private test phrase was absent from history after ending private mode. |
| Assistants/models | Category filtering worked. Selecting Daily Planner or a PRO model opened the existing paywall. Paid responses remain unverified. |
| Voice/web search | Both opened the existing Premium gate for this account; actual recognition/search remain unverified. |
| Restore | Returned “No purchases found” for this account. This does not prove subscriber restoration or store purchase fulfillment. |
| Settings/legal | Settings opened; Privacy Policy loaded externally. Terms navigation was interrupted by a Mi Browser advertisement; final destination not verified. |

Found and fixed an Android CSV picker bug: files advertised as supported were disabled when providers used alternate CSV MIME types. Both document pickers now use the shared validated MIME allowlist. Three alternate-MIME regression cases were added; the corrected release was installed and successful CSV selection/analysis was repeated on the phone.

**Defect found in the first pass, fixed in the follow-up below:** Chat's Regenerate action only copied the assistant answer into the composer. Reproduced on the arithmetic response and confirmed in `src/screens/Chat.js` (`onRetryFromHere`).

Validation: 279 tests passed in 50 suites; release assembly succeeded. Changed screens linted without errors (two warnings in the workspace screen/test). The captured crash buffer contained UI Automator inspection-tool failures, not an app-process crash. Animation scale, font scale, Wi-Fi and mobile-data settings were restored to their original values. Synthetic QA files and saved results remain for inspection. Screenshots include `chat.png`, `document-summary.png`, `document-chat.png`, `multi-document-summary.png`, `video-summary.png`, `video-chat.png`, `image-chat.png`, `transcript-summary.png` and `offline-summary.png`.

This is a broad smoke/regression audit, not exhaustive certification. Still unverified on this phone: successful licensed purchases/entitlements/restoration, paid models/assistants/voice/search, destructive reset/delete operations, report/support submission, stream stopping under adverse networks, all languages/devices, maximum-size sources, scanned/encrypted PDFs and long/no-speech videos. No real purchase, customer-data deletion or external message was performed.

## Reviewer Premium and Regenerate follow-up on 2026-10-02

At the owner's instruction, five taps on the sidebar Version 1 control enabled existing Reviewer Premium. No entitlement, paywall or production backend implementation was changed. Reviewer Premium remains enabled on the test phone.

Regenerate now starts an actual streaming request using the original question, original multimodal/document attachments, the current selected model, assistant instructions and saved workspace context. Context ends at the original question, excluding later answers and any summary derived from those later messages. A successful response updates only the selected assistant message by ID, preserving the question and later conversation. The old answer remains in the store until a complete nonempty replacement arrives. Cancelled, failed, empty and late callbacks cannot overwrite it. A synchronous operation guard prevents overlapping send/retry operations. A completed retry invalidates the old derived conversation summary. StreamingText remounts between saved/streaming states so a shorter replacement or cancelled partial response cannot leave stale text visible.

Physical verification on the final installed build:

- Regenerated the direct CSV answer: fresh wording, correct 37 volunteers and $8,200; composer stayed empty. Evidence: `tmp/physical-qa/regenerated-document.png`.
- Regenerated an earlier Daily Planner reply: new two-block plan, with the later CSV question and answer retained.
- Regenerated a persisted image reply after application restart: correct red square and blue circle, using the original saved image.
- Private-chat regeneration completed. A subsequent retry was stopped after 300 ms; after returning to the same scroll position, the complete visible answer text matched the pre-retry XML and input was enabled. Private mode was then ended.
- Direct chat CSV selection, extraction and answer passed with Reviewer Premium.
- Daily Planner selection and response passed; web search returned an official NASA page title and source link.
- All ten listed model selections returned correct arithmetic answers across the initial and reviewer passes: GPT Luna/Sol/Terra, Claude Fable/Sonnet, Gemini Pro/Flash, Grok, DeepSeek Flash/Pro. These establish app-level response paths, not provider provenance: existing streamChat fallback can serve an alternate model. Recorded automated model checks are `tmp/physical-qa/model-*.json`.
- Microphone permission and listening UI opened; live speech transcription was skipped at the owner's explicit request.

Final validation: 287 tests passed in 51 suites, including eight new retry tests covering original-source context, earlier-turn isolation, completion, empty/error/cancel behavior, late callbacks and cancellation during setup. Changed code lint has zero errors (existing MessageBubble style warnings remain). Release assembly passed in 1m39s. The final APK is installed with the existing test key and application data preserved: version 1.4.0/code 11; SHA-256 `EDC5F12EACE2E7543A8869F89680F26E18D76804FF3AAF794D85723ACE5D5DD3`. Evidence logs: `verified-tests.log`, `regenerate-final-build.log`, `final-lint.log`, `final-crash-buffer.log` under `tmp/physical-qa/`. Phone animation scale was restored to 1.0; Wi-Fi is on, mobile data remains off. No store release was published.

## Remaining gate

Physical-device coverage and the Regenerate fix are recorded above. Successful billing/paid entitlement restoration still require a Play-licensed test setup; Reviewer Premium bypasses that path and cannot verify it. Their code remains unchanged. The original release APK is at `android/app/build/outputs/apk/release/app-release.apk`; the latest phone test-signed copy is at `tmp/physical-qa/app-physical-qa.apk`. Microphone transcription was explicitly skipped. The earlier audit's other untested edge cases remain outside this smoke-test evidence.

New analysis uses its separate quotas and, since 2026-10-03, requires Premium through the client-side `SOURCE_WORKSPACE_REQUIRES_PREMIUM` gate (see the review-fixes section). Do not silently change prices, purchase flows or entitlement policy.

Do not call the release fully verified until these checks pass. YouTube and visual video understanding must remain unadvertised until their implementations and live tests are complete.

## Local verification

```powershell
node node_modules/jest/bin/jest.js --runInBand
npx --yes deno test --allow-env --config supabase/functions/source-analyze/deno.json supabase/functions/source-analyze/handler_test.ts supabase/functions/source-analyze/provider_test.ts
node node_modules/react-native/cli.js bundle --platform android --dev false --entry-file index.js --bundle-output tmp/workspace-review/workspace-release.bundle --assets-dest tmp/workspace-review/workspace-release-assets
```

Synthetic live checks used tmp/verify-source-workspace.cjs. Its default target is canary; SOURCE_ENDPOINT=source-analyze tests the app endpoint. Server credentials must never be placed in the app, logs or git.

## Gemini video implementation — 2026-10-03

This section supersedes the earlier speech-only and unavailable-YouTube notes. Production `source-analyze` v3 and canary v11 now use Gemini for uploaded MP4/WebM and public YouTube videos. The existing server-side Google key is used; no provider secret is shipped in the application. YouTube is enabled in the existing workspace settings. Documents and pasted transcripts retain the existing OpenAI path. Paywall, purchase logic and chat limits were not changed by this implementation.

Video analysis covers speech, sampled visual scenes and readable on-screen content, including silent videos. Uploads remain capped at 20 MB. Requests explicitly clip analysis to the first 600 seconds, at one sampled frame per second and low media resolution. Private, restricted and unavailable YouTube videos can fail; fast visual actions can be missed. Analysis quotas remain 50 per device/day and 1,000 globally/day. Libraries remain local to the device.

Chat now routes a pasted YouTube link or the new Upload video action through the same backend. User questions accompany the video request. Completed results are saved to the video library outside private mode. Follow-ups use a bounded, labelled AI analysis reference, not a claim to re-watch the original video. References are owner-scoped and expire after seven days; the saved analysis context also remains in the conversation. Stop cancels the server job, and uncertain network failures retain recoverable pending jobs outside private mode.

Verification completed:

- Three Deno tests passed for provider validation and the existing job lifecycle. All 296 Jest tests passed in 53 suites, including video routing, durable follow-up context, private mode, cancellation and save/network failures.
- Live Gemini checks passed for a silent blue rectangle, a spoken tutorial, a public YouTube clip and a 605-second fixture with excluded content after second 600. Existing document/transcript analysis, follow-up chat, ownership and idempotency regression checks passed.
- On the connected Xiaomi phone: YouTube summary in chat identified elephants, a follow-up answered correctly, native video selection summarized a silent blue rectangle, and both appeared in the saved library after reinstall/restart. Opening a saved result and choosing Ask about this produced the correct answer “Blue”.
- The final installed build completed a new YouTube summary with the polished chat layout. Stop displayed “Video analysis stopped.”; production database readback confirmed `cancelled` at 2026-10-02 21:10:09 UTC.
- Final Android release assembly passed. Changed-file lint has zero errors; existing style warnings remain. The inspected crash buffer contained UIAutomator/system errors, with no app crash identified in that buffer. Animation scale was restored to 1.

Installed QA APK: `tmp/app-gemini-video-qa.apk`, version 1.4.0/code 11, signed with the existing local test key. SHA-256: `41AF3952F64F5700A8DB0CE6FCC3CCEA8D4D8000FF9E04817630E0E2B879135C`. No Google Play release was published. Evidence includes `tmp/gemini-final-tests.log`, `tmp/gemini-polished-build.log`, `tmp/gemini-library.png`, `tmp/gemini-saved-detail2.png`, `tmp/gemini-library-followup.json` and `tmp/gemini-stopped-final.json`.

Store publication and Play-licensed billing verification remain separate release tasks. Reviewer Premium does not establish purchase/restore correctness. These checks establish the tested video/document paths, not universal success for every source or network condition.

## Pre-release review fixes — 2026-10-03

An independent review of the document summarizer found no failing tests but several gaps. Fixes applied in this pass:

- **Entitlement policy.** The owner decided on 2026-10-03 that the workspaces require Premium, matching chat's own file upload. `SOURCE_WORKSPACE_REQUIRES_PREMIUM` in `src/constants/featureFlags.js` ships `true`: a free user who taps Get summary or Ask about this is sent to the existing paywall through the same pending-action flow as the chat composer, with `returnTo` set to the workspace route; saved briefs stay readable. Setting the flag to `false` reopens the workspaces. No price, purchase flow or backend quota changed.
- **Follow-up truncation disclosure.** The chat proxy includes at most 48,000 characters of attached document text per request, while a summary may have covered 600,000. A generic "may be shortened" note was not enough: on the phone, GPT-5.6 Sol still answered a question about section 300 of a 70,190-character fixture with a figure borrowed from another excerpt. The saved reference context now lists each document's extracted size and the exact 48,000-character cut (`CHAT_DOCUMENT_CONTEXT_CHARS` in `src/config/chatLimits.js`, mirroring the proxy constant), declares later sections unavailable, and forbids estimating from similar entries; the workspace system prompt says the same. With that context the same question returned "Section 300 is not included in the available document text", while section 150 (inside the cut) still answered correctly with 47 hours.
- **Combined input budget.** `source-analyze` now estimates tokens across all selected documents (Latin ≈ 4 characters/token, other scripts ≈ 1.5) and rejects more than 240,000 estimated tokens with `SOURCES_TOO_LARGE` (413) before any provider call. A provider `context_length_exceeded` response maps to the same code instead of `SOURCE_UNAVAILABLE`. The client shows "too large to analyze together; summarize separately or in smaller groups".
- **Cancellation poll tolerance.** The worker's four-second status poll no longer aborts a paid provider request on a single transient database error; it aborts on `JOB_NOT_FOUND` or three consecutive failures.
- **Pending card recovery.** Cancelling a pending analysis the server never received (`JOB_NOT_FOUND` on DELETE) now clears the local card immediately instead of waiting three minutes. Check progress keeps the existing three-minute guard against racing a late reservation.
- **Private mode.** "Ask about this" during a private chat now asks before ending private mode; declining keeps the private chat and writes nothing.
- **Retention wording.** The in-app Sources caption and this document now state that analysis results are also kept on the analysis server for up to seven days (hourly expiry cleanup; cancel clears the result), in addition to the device-local brief.
- **Housekeeping.** Section headings in document briefs no longer carry an empty timestamp slot. The two superseded 3D illustrations are no longer bundled (about 3 MB). Android build logs are ignored by git.

Still outside this repository: the deployed `document-process` function (PDF page cut, `truncated` flag, encrypted-PDF handling) and the other locales for the `workspace` namespace, which remains English with fallback.

Validation: 306 Jest tests in 54 suites (ten new), 4 Deno tests, changed-file lint with zero errors, two release assemblies. The owner deployed the edge-function changes as production `source-analyze` v4 on 2026-10-03 (JWT verification on). Live verification (`tmp/review-fix-qa/verify-too-large.cjs`): three 190,000-character dense-script documents uploaded through `document-process` were rejected with HTTP 413 `SOURCES_TOO_LARGE` before any provider call, and a short transcript analysis still completed in about five seconds.

Physical verification on the Xiaomi 21091116AG (Android 12) with the rebuilt release APK re-signed with the local test key (SHA-256 `7F8576B6C2BD637F8723855937EBFAAE90BE1B80ED89C05BFF2681313791FCEE`, installed over the existing data): TXT fixture import through the system picker, 70,190-character summary completed in under 30 seconds with correct budget, volunteer and coordinator facts; follow-up chat declared section 300 unavailable and answered section 150 correctly; "Ask about this" during a private chat showed the "Leave private chat?" dialog, Cancel kept private mode (verified back in chat), Continue ended it and opened the saved conversation; the Sources tab shows "Source available until 10/10/2026" and the new seven-day server retention caption. Animation scale was set to 0 for UI dumps and restored to 1. A third build with the Premium gate enabled (SHA-256 `4BA8178804AB131CCD31A48EEE72D704A06C9F08EF439E8239ECC02D25BC957D`, installed over the same data) was checked after turning Reviewer Premium off through the five-tap version control: Ask about this on a saved brief opened the existing Cloud AI Premium paywall and no chat was created; after re-activating Reviewer Premium the same tap opened the saved conversation. Reviewer Premium remains enabled on the phone. No purchase was attempted; a "No purchases found" dialog seen during the check came from a stray tap on the paywall's Restore link, not from the app. Evidence: `tmp/review-fix-qa/phone-*.png`, `assemble.log`, `assemble2.log`. No Play release was published by this pass.

## Re-check after the follow-up work — 2026-10-03

### GPT-6 Luna backend migration — 2026-10-03

Production `chat-proxy-v2` v12 and `source-analyze` v5 now route the former GPT-5.6 Luna workloads to `gpt-6-luna`. Old client model IDs remain accepted. Source text defaults and an explicit `SOURCE_TEXT_MODEL=gpt-5.6-luna` migrate; other custom overrides remain respected. Gemini video, legacy `chat-proxy` (GPT-5.4 Nano), paywalls and quotas are unchanged. Server logs confirm GPT-6 Luna completions in production.

Deployment was built from the live production files, changing only the model constants and source text model selection/usage logging. The local chat index already lacked the abuse protections present in production; that pre-existing local difference was NOT deployed or reverted. Before a future deployment from the local tree, reconcile it with the saved production snapshot. Exact pre/post deployment bundles are in `tmp/luna-migration/*-before.json` and `*-deployed.json`.

Verification: five Deno tests passed, including legacy environment mapping and custom overrides. Canary checks passed for streaming, old client IDs, history, French, image understanding, actual web-search tool execution, TXT/PDF/DOCX/CSV extraction and structured summaries, source follow-up chat, ownership, missing sources, idempotency, cancellation and Gemini YouTube. Production smoke passed chat, image, transcript/TXT summaries and follow-up; logs are `tmp/luna-migration/production-chat.log` and `production-workspace.log`. Web-search transport succeeded, but one production answer returned the wrong official model-page URL; search factual accuracy is not fully certified.

Full Jest run initially had 306/309 passing. The upstream-model assertion was updated for this migration and passed on targeted rerun. Two unrelated failures remain: a UI model description assertion expects `display.description`, and locale parity reports missing keys. No client release was made. These tests do not establish whole-app readiness.

Published standard token prices per million: GPT-5.6 Luna input $0.20 / output $1.20; GPT-6 Luna input $0.10 / output $0.50. At identical token usage, input is 50% cheaper and output about 58% cheaper; actual bills depend on generated tokens and tool charges. Sources: https://developers.openai.com/api/docs/models/gpt-6-luna and https://developers.openai.com/api/docs/models/gpt-5.6-luna.

Second production-readiness pass over the tree after the `document-process` recovery and the chat error-copy additions.

- `document-process` is now versioned at `supabase/functions/document-process/` (recovered production v6 as `recovered-v6.ts`, new `index.ts`/`extract.ts`, 11 Deno tests with synthetic fixtures, pinned `deno.json`/`deno.lock`). The function README recorded canary-only deployment, but production `document-process` now serves the new implementation: a probe on 2026-10-03 returned `partialText`/`truncated` for a TXT upload and the phone showed "Text found on 1 of 1 pages" for a PDF, fields the recovered v6 source never produced. The app's coverage fields (`pageCount`, `extractedPages`, `partialText`) and error codes (`ENCRYPTED_DOCUMENT`, `UNSUPPORTED_DOCUMENT`) are optional on the client, so either server version works. Canary evidence: `tmp/document-extraction-qa/canary-final-live.log` and `workspace-live.log` (PDF + DOCX + CSV combined French brief through the canary pair). Record the production version number in `recovery.json` when the CLI is logged in; see the function README for limits.
- The four new `chat.files.*` strings were added to all 86 catalogs in English and allowlisted in `scripts/i18n-identical-allowlist.json`, so `i18n:audit:strict` passes but non-English users see them in English, like the rest of the workspace namespace.
- Validation on this pass: 309 Jest tests in 55 suites, 11 + 4 Deno tests, `i18n:audit:strict` PASS (86/86), changed-file lint with zero errors, production `source-analyze` readiness unchanged (all sources available).

## Full localization — 2026-10-03

Every user-visible string now ships in all 86 catalogs.

- **Workspace copy moved into the main catalogs.** The separate `workspace` i18next namespace (English only) is gone. Its 180 strings live under `workspace.*` in every `src/i18n/locales/<locale>.json`, so they share lazy locale loading, the strict localization audit and the manual-translation pipeline. `useWorkspaceTranslation` now reads `t('workspace.<key>')`.
- **Code fixes so nothing bypasses the catalogs.** Chat's video errors use their own `workspace.videoErrors.*` keys (they previously collided with the workspace screen's differently worded `errors.*`). Unknown error codes fall back to the translated generic message instead of English. One key that carried two different messages was split (`sourceUnavailableLibrary`). Shared and displayed summaries use translated section headings (`summaryLabels`). Built-in model taglines use `descriptionKey` instead of English literals. The rewards button, document chip badge, pasted-text file name, demo labels and a launch-preview label are now translated. Missing onboarding keys and `providers.deepseek` were added.
- **New strings translated** into 85 locales (about 19,000 strings): the workspace, chat file messages that were English everywhere, model taglines and the other additions.
- **Existing catalog defects repaired:** Romansh (about 600 strings were Romanian), European Portuguese (545 Brazilian strings converted), Odia (full re-translation; the old catalog was corrupted machine translation with `|` instead of the danda and English fragments inside words), Serbian Cyrillic/Latin (leaked `⟬П000⟭` placeholder tokens, Cyrillic in the Latin catalog, English spelled in Cyrillic such as "Уплоад Пхотос", mangled brand names), Urdu/Assamese/Punjabi (junk first lines on about 400 strings), `|| mobile app UI` context fragments in ten catalogs, leaked tokens in twelve more, English left in running text across about 70 catalogs, Sinhala's insurance term for "Premium", and untranslated `(Lite)` and preset names.
- **Guards:** `__tests__/workspaceLocalization.test.js` fails if workspace code uses a key missing from the catalog, if an error code lacks copy, or if model taglines regress to English literals. The global identical-to-English allowlist no longer exempts `chat.files.*`; only reviewed short cognates (French "Documents", German "Details"…) are allowlisted per locale.

- **Right-to-left direction:** 139 Arabic, Persian, Dari, Urdu and Hebrew strings that began with Latin text (brand names, format lists, Latin-filled placeholders) now start with U+200F. Without it Android laid those lines out left-to-right and scrambled them (e.g. the Arabic document-limits line). `__tests__/rtlDirectionMarks.test.js` guards this.

Validation: `npm run i18n:audit:strict` PASS (86/86, 0 errors), 325 Jest tests in 57 suites, changed-file lint with zero errors. Release APK (test-signed SHA-256 `1B220DAAC75E6C3C86047526978F60981015CC7093A1ADE3BCC792CA6050B7A0`) checked on the Android 15 emulator with per-app language switching in de, ar, ja, ru, hi, or, rm, sr-Latn and sw: chat home, Documents and Video summaries all rendered in the selected language with no English left and no clipping; Arabic lays out right-to-left.

Build note: Gradle marked `createBundleReleaseJsAndAssets` up to date after catalog-only edits and shipped a stale JavaScript bundle. Force it when catalogs change: `./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease`.

Known limits: translations were produced with an LLM against each catalog's existing terminology, then validated for placeholders, line breaks, script and leftover English. They have not had native-speaker review; Romansh, Basque, Odia and the African catalogs are the ones most worth a native check. The older v3 onboarding screens (not used by the shipping v4 flow) still build one title from two separately translated halves.
