# AI Content Reporting Design

## Goal

Add a Google Play-compliant in-app reporting flow for every AI-generated output in ChatCloud: assistant chat replies, newly generated or edited images, and saved images opened from the studio gallery.

## Approved Constraint

Reports are inserted directly from the React Native client into Supabase. This feature will not introduce an Edge Function. The database must therefore enforce a narrow write-only client contract through row-level security and column constraints.

## Existing Context

- The app has no authenticated end-user session in its current reporting path. It uses a stable keychain-backed `deviceId`.
- Chat message records have stable local `msg_*` IDs and assistant response text in `message.content`.
- Image jobs store job IDs, image IDs, prompt, selected model, generation `mode`, and original remote image URLs. Cached `file://` paths are not useful moderation references.
- Private chat messages are not ordinarily persisted. A Private chat response remains reportable only after explicit user submission, with disclosure in the report modal that submitted content is sent for safety review.

## Storage

Create a Supabase migration for `public.ai_content_reports` with:

- Output identity: `content_type`, `content_id`, `source_screen`.
- Reporter identity: nullable `user_id`, nullable `device_id`.
- Classification: `reason`, reserved nullable `details`, moderation `status`. The in-app UI submits a reason only; `details` remains nullable for schema compatibility.
- Evidence: optional `prompt`, `output_text`, `image_url`, `image_storage_path`, `model`, and bounded `metadata`.
- Client context: `app_version`, `platform`.
- Audit timestamps: `created_at`, `updated_at`.

Database check constraints restrict `content_type`, `reason`, `status`, and bounded text lengths. `image_url` may store the remote generated-image URL; base64/data URLs must not be submitted. Enable RLS and grant `anon` and `authenticated` insert permission through an insert-only policy. No client select, update, or delete policy is created.

## Client Submission Boundary

Add `src/api/reportContent.js` as the single submission boundary. It:

- Validates supported content types and reasons before issuing a request.
- Removes empty optional evidence fields and keeps any future `details` value within the database bound.
- Obtains the existing device ID and submits through `createSbWithDevice(deviceId)`.
- Adds `APP_VERSION` and `Platform.OS`.
- Rejects local/base64 image references rather than uploading media.
- Throws a stable user-facing error for failed inserts.

## Shared UI

Add `ReportContentModal.jsx`, rendered within the existing screen/modal hierarchy. It shows:

- Title: `Report AI content`.
- Explanation: `Tell us what is wrong with this generated content.`
- Six selectable reasons: sexual or nudity; violence or self-harm; hate or harassment; child safety concern; scam or deceptive content; other.
- `Cancel` and `Submit Report` actions with loading state.
- Inline failure message and submitted success state.
- Private-chat disclosure when applicable.

The modal receives an output payload and submits through the shared API. It does not navigate outside the app.

## Surface Integrations

### Chat

Show a visible action row below completed assistant messages with `Copy`, `Share`, `Regenerate`, and `Report`; user messages do not receive `Report`. `MessageList` supplies the preceding user prompt for each assistant message and `Chat` owns the report modal so it can include thread/private context. Reports include:

- `content_type: chat_response`
- assistant `message.id`, response text, preceding user prompt when available, selected/request model when available
- `source_screen: chat`
- private-chat metadata/disclosure flag when applicable

### Generated And Edited Image Result

Add a labeled `Report` action beside existing result actions in `CreateImageGenerating`. Determine content type from payload `mode`: `text2img` is `generated_image`; all edit modes including `img2img` are `edited_image`. Reports include image/job identifier, prompt, model, original remote URL if retained, and `source_screen: create_image_generating`.

### Saved Image Viewer

Add labeled `Report` next to `Delete`, `Save`, and `Share` in `ImageViewer`. Build the report from the stored job and selected image. Preserve the source job `mode` to distinguish generated versus edited image and send `source_screen: image_viewer`.

## Error Handling And Privacy

- Users receive `Thanks. Your report was submitted.` after a successful insert.
- Failed inserts leave the modal open and display `Could not submit report. Please try again.`
- A reason is mandatory; the in-app report flow does not collect free-text details.
- Reporting a Private chat item is an explicit exception to private storage, communicated before submission.
- Report evidence excludes base64 reference images and locally cached image bytes.

## Verification

- Unit/source contract tests cover schema/RLS intent, payload normalization, report controls on all output surfaces, and Private chat disclosure.
- Run the Jest suite and lint.
- Run an Android release/debug build task available in the project, or report the precise blocker.
- Manually verify the in-app flow on chat output, new text-to-image output, edited output, and a stored gallery image.
