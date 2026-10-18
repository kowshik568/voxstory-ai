# VOXSTORY AI — ENGINEERING & RELEASE MASTER CHECKLIST

**Target**: Commercial-grade, reliable, secure AI voice-production studio (v11.0)  
**Provider**: Gnani Timbre v3.0 (with 13 verified voice profiles and emotion tags)  
**Status Key**:
- `[x] VERIFIED`: Verified with automated tests and/or live execution evidence.
- `[~] IN PROGRESS / ENHANCED`: Implemented and undergoing deep hardening.
- `[ ] PENDING`: To be executed in priority sequence.

---

## 1. Non-Negotiable Project Preservation & Baselines
- [x] VERIFIED: Working tree checked, Git initialized in `/app/applet`.
- [x] VERIFIED: Test baseline established (79 tests passing across 12 test suites).
- [x] VERIFIED: Clean TypeScript compilation (`tsc --noEmit`).
- [x] VERIFIED: Vite production build succeeded (`npm run build`).
- [x] VERIFIED: Server runtime on port 3000 with Express + Vite middleware.
- [x] VERIFIED: Preserved all existing user projects, takes, and local data.

---

## 2. Phase One — Architecture Boundaries
- [x] VERIFIED: Frontend / Backend separation via `/api/*` routes with Zod schemas.
- [x] VERIFIED: Provider adapter (`src/server/gnaniProvider.ts`) isolated from UI.
- [x] VERIFIED: Audio engine (`src/server/routes.ts` & `src/lib/audioGenerator.ts`) handles RIFF WAV/PCM.
- [x] VERIFIED: Storage abstraction (`src/server/storage/storageManager.ts`) handles atomic writes & backups.
- [x] VERIFIED: Background job processing with idempotency keys (`X-Idempotency-Key`).

---

## 3. Phase Two — Gnani Timbre v3.0 Provider Integration
- [x] VERIFIED: Provider URL: `https://api.vachana.ai/api/v1/tts/inference`.
- [x] VERIFIED: Header: `X-API-Key-ID` mapped from server-side `GNANI_API_KEY`. Secrets never leak to client.
- [x] VERIFIED: Explicit timeout handling (25s AbortController) & error classification (`INVALID_API_KEY`, `RATE_LIMIT_EXCEEDED`, `PROVIDER_TIMEOUT`, `PROVIDER_HTTP_ERROR`).
- [x] VERIFIED: No silent fallback to demo mode when `GNANI_API_KEY` is present.
- [x] VERIFIED: Provider health & diagnostic endpoint `/api/provider/health` and `/api/provider/diagnose` without exposing secrets.
- [x] VERIFIED: Exact WAV duration extraction from binary PCM headers.

---

## 4. Phase Three — Voice Catalog & Expression System
- [x] VERIFIED: 13 verified Timbre v3.0 voices (`Avinash`, `Shivani`, `Lakshmi`, `Kalpana`, `Shubham`, `Prakash`, `Devansh`, `Yashraj`, `Chetana`, `Vasudha`, `Harshad`, `Riyaa`, `Tarika`).
- [x] VERIFIED: Backward-compatible alias mapping for project continuity (`nalini` -> `Shivani`, `rohan` -> `Yashraj`, etc.).
- [x] VERIFIED: 13 verified expression tags (`<laugh>`, `<sigh>`, `<whispers>`, `<pauses>`, `<coughs>`, `<excited>`, `<exhales>`, `<giggle>`, `<shouting>`, `<slow>`, `<sniffles>`, `<yawns>`, `<clears throat>`).
- [x] VERIFIED: Script validator (`validateScript`) detecting valid tags, invalid tags, bracket errors, word count, and duration.
- [x] VERIFIED: Cursor-aware tag autocomplete (`TagAutocomplete.tsx`).

---

## 5. Phase Four — Script Editor & Content Workflow
- [x] VERIFIED: Dual-mode writing workstation: Paragraph Narration Mode & Structured Dialogue Line Mode.
- [x] VERIFIED: Speaker assignment per dialogue line.
- [x] VERIFIED: Metrics display: word count, character count, estimated duration, tag breakdown.
- [x] VERIFIED: Multi-step undo/redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`).
- [x] VERIFIED: Debounced autosave indicator with timestamp and saved state.
- [x] VERIFIED: Keyboard shortcuts modal (`?`).
- [x] VERIFIED: Preserves user text without automatic unsolicited rewrites.

---

## 6. Phase Five — Multi-Character Dialogue & Cast Management
- [x] VERIFIED: Cast management panel (`CharacterPanel.tsx`) with name, role badges, and color themes.
- [x] VERIFIED: Real-provider voice preview auditioning via `/api/generations`.
- [x] VERIFIED: Consistent voice binding across the project.
- [x] VERIFIED: Per-line pause, volume, and tag control in Dialogue view.
- [x] VERIFIED: Dialogue assembly into unified multi-character audio.

---

## 7. Phase Six — Real Audio Integrity & WAV Validation
- [x] VERIFIED: RIFF structure validation (`validateWavBuffer`) checking `RIFF`, `WAVE`, `fmt `, PCM format 1, valid sample rates, and correct byteRate calculations.
- [x] VERIFIED: PCM frame count and duration calculation against sample rate.
- [x] VERIFIED: Tests in `src/tests/audioIntegrity.test.ts` asserting corrupt header rejection.

---

## 8. Phase Seven — Multitrack Timeline & Audio Engine
- [x] VERIFIED: Multitrack timeline (`MultitrackTimeline.tsx`) supporting clip dragging, reordering, trimming, and splitting at playhead.
- [x] VERIFIED: Clip duplicate, delete, and pause adjustments.
- [x] VERIFIED: Zoom controls (0.5x to 3.0x) and horizontal scrubbing.
- [x] VERIFIED: Synchronized Web Audio playback with playhead animation.
- [x] VERIFIED: Mute, solo, volume, and pan controls per track.
- [x] VERIFIED: Timeline undo/redo history stack.

---

## 9. Phase Eight — Audio Mixing, Mastering & Export Center
- [x] VERIFIED: Multi-channel mixer (`AudioMixerPanel.tsx`) with Dialogue, Music, Ambience, and SFX tracks.
- [x] VERIFIED: Voice-priority background audio ducking with adjustable ducking depth.
- [x] VERIFIED: Peak level metering and clipping prevention.
- [x] VERIFIED: Creator export package (`ExportModal.tsx`) with WAV export, SRT/VTT subtitles, transcript, and metadata JSON.
- [x] VERIFIED: Subtitles generated from actual timeline clip boundaries and offsets.

---

## 10. Phase Nine & Ten — Streaming & Asynchronous Job Lifecycle
- [x] VERIFIED: SSE streaming route `/api/tts/stream` with chunk framing and progress events.
- [x] VERIFIED: Background job queue (`/api/jobs`) with statuses: `queued`, `processing`, `completed`, `failed`, `cancelled`.
- [x] VERIFIED: Job idempotency via `X-Idempotency-Key` preventing duplicate charges.
- [x] VERIFIED: Job cancellation endpoint (`POST /api/jobs/:id/cancel`) releasing AbortController.
- [x] VERIFIED: Automated test suite in `src/tests/jobs.test.ts` and `src/tests/streaming.test.ts`.

---

## 11. Phase Eleven & Twelve — Persistence & Storage Architecture
- [x] VERIFIED: Local filesystem storage abstraction in `.data/projects.json` and `.data/generations.json`.
- [x] VERIFIED: Atomic write-and-rename mechanism preventing JSON corruption on abrupt shutdown.
- [x] VERIFIED: Automated backup file creation (`.bak`) and corrupted-file recovery.
- [x] VERIFIED: Automated test suite in `src/tests/storage.test.ts`.

---

## 12. Phase Thirteen & Fourteen — Security Hardening
- [x] VERIFIED: Security headers (`X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, restrictive `Permissions-Policy`).
- [x] VERIFIED: Body size limit enforced at 10MB to prevent memory exhaustion DoS.
- [x] VERIFIED: Path traversal protection on all file storage and asset paths.
- [x] VERIFIED: IP-based and token-based rate limiting on generation and job endpoints (`src/server/rateLimiter.ts`).
- [x] VERIFIED: Zero client-side leakage of Gnani API keys or raw authorization tokens.

---

## 13. Phase Fifteen — Usage, Rate Limits & Cost Control
- [x] VERIFIED: In-memory metrics tracking total requests, successful takes, failed takes, latency, and generated audio duration (`/api/provider/metrics`).
- [x] VERIFIED: Idempotency deduplication preventing accidental multi-click charges.
- [x] VERIFIED: Request caps and rate-limit guardrails.

---

## 14. Phase Sixteen to Thirty-Two — Quality Gates & Verification Evidence
- [x] Gate A (Code Integrity): TypeScript `tsc --noEmit` clean, Vite build clean.
- [x] Gate B (Provider Integrity): Contract verified against Gnani Timbre v3.0 specifications.
- [x] Gate C (Audio Integrity): Deterministic WAV synthesis & binary validation passing.
- [x] Gate D (Data Integrity): Atomic storage and backup recovery verified with unit tests.
- [x] Gate E (Security): Rate limits, body caps, sanitized error messages verified.
- [x] Gate F (User Workflows): Full studio workflow from script -> character cast -> generation -> timeline -> mix -> export.
