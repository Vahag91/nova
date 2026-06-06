# AI Content Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app, database-backed offensive AI-content report flow for assistant replies and generated or edited images.

**Architecture:** A Supabase migration creates an insert-only RLS-protected report table. A single React Native API module normalizes and inserts reports through the existing anonymous Supabase client, while one reusable modal is invoked by chat and image surfaces with output-specific evidence.

**Tech Stack:** React Native, Zustand, Supabase Postgres/RLS, `@supabase/supabase-js`, Jest, ESLint

---

### Task 1: Report Storage Contract

**Files:**
- Create: `supabase/migrations/202605260001_ai_content_reports.sql`
- Create: `__tests__/aiContentReportSchema.test.js`

- [x] **Step 1: Write the failing schema contract test**

Create a Jest source-contract test that reads the migration and asserts it declares `ai_content_reports`, check constraints for all content types/reasons/statuses, enables RLS, provides insert-only policy/grants, and does not grant client `select`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/aiContentReportSchema.test.js --runInBand`

Expected: FAIL because the migration file is absent.

- [x] **Step 3: Add the migration**

Implement the table with UUID primary key, required output/reason fields, bounded optional evidence fields, JSONB metadata, timestamps, a trigger for `updated_at`, RLS, insert grants/policies for `anon` and `authenticated`, and no read grants/policies.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/aiContentReportSchema.test.js --runInBand`

Expected: PASS.

### Task 2: Client Reporting API

**Files:**
- Create: `src/api/reportContent.js`
- Read existing values from: `src/config/appInfo.js`, `src/lib/deviceId.js`, `src/lib/supabaseDevice.js`
- Create: `__tests__/aiContentReportApi.test.js`

- [x] **Step 1: Write the failing API contract test**

Assert the module exports supported reasons/content types, uses `ensureDeviceId` and `createSbWithDevice`, inserts into `ai_content_reports`, attaches app/platform fields, rejects invalid categories, strips base64/local image URLs, and maps insert errors to a submission error.

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/aiContentReportApi.test.js --runInBand`

Expected: FAIL because the API module is absent.

- [x] **Step 3: Implement minimal reporting API**

Add normalization helpers and `submitAiContentReport(payload)`, limiting evidence sizes to match SQL constraints and returning a submission acknowledgement after a successful minimal insert. Do not select the inserted report because clients have no read policy.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/aiContentReportApi.test.js --runInBand`

Expected: PASS.

### Task 3: Shared Report Modal

**Files:**
- Create: `src/components/reporting/ReportContentModal.jsx`
- Create: `__tests__/aiContentReportUiContract.test.js`

- [x] **Step 1: Write failing UI contract assertions**

Assert the reusable modal displays the required title, reason labels, submit/failure/success copy, and private-chat safety-review disclosure without a free-text field.

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: FAIL because the component is absent.

- [x] **Step 3: Implement modal**

Implement a `Modal`-based sheet with selected-reason state, `submitAiContentReport`, loading/errors, success confirmation, and callbacks to close/reset.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: PASS.

### Task 4: Chat Response Reporting

**Files:**
- Modify: `src/components/chat/MessageBubble.jsx`
- Modify: `src/components/chat/MessageList.jsx`
- Modify: `src/screens/Chat.js`
- Extend: `__tests__/aiContentReportUiContract.test.js`

- [x] **Step 1: Add failing chat integration assertions**

Assert assistant output exposes visible `Copy`, `Share`, `Regenerate`, and `Report` controls, passes message output/prompt/model to a report handler, and `Chat` renders `ReportContentModal` with Private chat disclosure.

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: FAIL because report handlers and visible assistant actions are absent.

- [x] **Step 3: Implement chat wiring**

Have `MessageList` resolve the nearest preceding user prompt and forward `onReport`; have `MessageBubble` render assistant-only actions; and have `Chat` open the shared modal with `chat_response` evidence and private-mode state.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: PASS.

### Task 5: Image Reporting

**Files:**
- Modify: `src/components/create-image/CreateImageGenerating.jsx`
- Modify: `src/components/image-studio/ImageViewer.jsx`
- Extend: `__tests__/aiContentReportUiContract.test.js`

- [x] **Step 1: Add failing image integration assertions**

Assert both image result components expose labeled `Report`, render `ReportContentModal`, pass original image URL/prompt/model, and classify edit modes as `edited_image`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: FAIL because both image report integrations are absent.

- [x] **Step 3: Implement image wiring**

Add modal state and a fourth action item in both components. Use job/payload `mode` and remote URL references rather than cached local media data.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: PASS.

### Task 6: Verification And Submission Notes

**Files:**
- Modify only if verification reveals defects in changed code.

- [x] **Step 1: Run focused tests**

Run: `npx jest __tests__/aiContentReportSchema.test.js __tests__/aiContentReportApi.test.js __tests__/aiContentReportUiContract.test.js --runInBand`

Expected: PASS.

- [x] **Step 2: Run project validation**

Run: `npm test -- --runInBand`

Run: `npm run lint`

Expected: PASS or record unrelated pre-existing failures precisely.

Recorded result: reporting-specific tests and targeted ESLint pass. Full Jest still fails in pre-existing `__tests__/rewardsSchedule.test.js` and `__tests__/App.test.tsx`; full ESLint still reports unrelated existing repository errors.

- [x] **Step 3: Run Android compilation check**

Run a non-destructive Android Gradle assembly task appropriate to the current configuration and capture whether it succeeds.

- [x] **Step 4: Prepare Google Play verification path**

Provide exact reviewer steps for reporting an assistant response, new generated image, edited image, and saved gallery image without leaving the app.
