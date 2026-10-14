# VoxStory AI v2.0 — Production-Grade Expressive AI Voice Studio

> **"Your words. Your voice. Your emotion."**  
> Direct expressive AI voiceovers powered by **Gnani Timbre v3.0** with inline audio expression tags, multilingual Indic support, pacing controls, and broadcast-grade audio mastering.

---

## 1. Product Overview (v2.0 Upgrades)

**VoxStory AI v2.0** is an upgraded digital audio workstation designed for creators, developers, audio drama writers, and brands to direct AI speech performances. Unlike traditional text-to-speech tools that apply static emotion presets across entire paragraphs, VoxStory AI leverages Gnani's **Timbre v3.0** inline audio tags to direct voice inflection, pacing, and non-verbal gestures with sentence-by-sentence precision.

### Key Capabilities in v2.0:
- **13 Verified Audio Expression Tags**: Direct vocal delivery with `<laugh>`, `<sigh>`, `<whispers>`, `<pauses>`, `<coughs>`, `<excited>`, `<exhales>`, `<giggle>`, `<shouting>`, `<slow>`, `<sniffles>`, `<yawns>`, and `<clears throat>`.
- **Continuation Semantics Engine**: Faithfully adheres to the Timbre v3.0 model architecture where an expression tag governs subsequent vocal delivery continuously until the next tag is encountered.
- **Multi-Character Dialogue Studio**: Assign multiple characters (e.g. Elena, Rohan, Nexus AI) with unique voices, reorder lines, preview individual segments, and assemble full multi-actor scenes into a single unified broadcast WAV track with natural conversational pacing.
- **Real Acoustic Waveform Analysis**: Derives true normalized root-mean-square (RMS) acoustic amplitude peaks from decoded PCM audio via the Web Audio API — never fabricating mock waveforms.
- **Explicit Generation-Mode Badges**: Transparently flags every take with its true origin:
  - `Live Gnani Timbre` (`live-provider`)
  - `Procedural Demo` (`procedural-demo`)
  - `Showcase Track` (`prerecorded-showcase`)
- **Synchronized A/B Take Comparison**: Compare alternate voice takes (Take A vs Take B) with synchronized scrubbing and instant playback toggle.
- **Zero-Friction Studio Demo Mode**: Full functionality out of the box with procedural WAV speech synthesis and curated tracks when `GNANI_API_KEY` is not configured.
- **Production Reliability & Security**: Strict Zod schema validation, server-side credential isolation (API key never exposed to client bundles), object URL memory cleanup, and detailed error feedback.

---

## 2. Verified Gnani Timbre v3.0 Audio Tags

| Tag Syntax | Category | Spoken Gesture | Pacing & Acoustic Impact |
| :--- | :--- | :--- | :--- |
| `<excited>` | Delivery | High energy, dynamic enthusiasm | +15% tempo, elevated formant pitch |
| `<whispers>` | Delivery | Breathy, intimate proximity | Lowered amplitude, high breathiness |
| `<laugh>` | Reaction | Natural chuckle before dialogue | +1.2s chuckle gesture |
| `<giggle>` | Reaction | Light playful laughter | +0.8s playful chuckle |
| `<sigh>` | Reaction | Audible emotional release | +1.0s breath release, downward pitch |
| `<shouting>` | Delivery | Outward projection and urgency | Maximum projection, compressed dynamic |
| `<slow>` | Pacing | Deliberate gravitas & emphasis | -25% speech rate, elongated vowels |
| `<pauses>` | Pacing | Dramatic silence beat | +1.5s silent tension beat |
| `<coughs>` | Non-Verbal | Throat clearing interruption | +0.9s acoustic cough transient |
| `<exhales>` | Non-Verbal | Deep breath out / relief | +0.8s gentle breath release |
| `<clears throat>` | Non-Verbal | Polite vocal clearing | +0.7s polite throat clear gesture |
| `<sniffles>` | Non-Verbal | Subtle emotional sniffle | +0.6s subtle transient |
| `<yawns>` | Non-Verbal | Tired vocalization | +1.4s drawn-out yawn gesture |

---

## 3. Architecture & Tech Stack

```
                     ┌────────────────────────────────────────┐
                     │          VoxStory AI v2.0 UI           │
                     │  Solo Studio  |  Multi-Character Scene │
                     └───────────────────┬────────────────────┘
                                         │
                                         ▼
                     ┌────────────────────────────────────────┐
                     │        Full-Stack Express Server       │
                     │  /api/generations, /api/dialogue/...   │
                     └───────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
    [GNANI_API_KEY Present]                         [Demo Mode / Key Missing]
  Live REST API Inference                        Procedural WAV Synthesis Engine
  https://api.vachana.ai/api/v1/tts/inference     (Formant synthesis, tag gestures)
```

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Canvas Web Audio visualizer.
- **Backend**: Node.js, Express, Zod request schemas.
- **Audio Stitcher**: Pure 16-bit Mono PCM buffer splicer with RIFF headers for seamless multi-speaker assembly.
- **Provider Adapter**: `GnaniTimbreProvider` communicating with `api.vachana.ai`.
- **Testing**: Vitest unit test suite covering tags, continuation parser, WAV concatenation, and provider mock HTTP calls.

---

## 4. Setup & Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd voxstory-ai

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### Environment Configuration (`.env`)
```env
# Optional: Gnani Vachana / Timbre v3.0 API Key ID
# Header passed to api.vachana.ai: X-API-Key-ID
# When omitted, the studio operates in interactive Studio Demo Mode
GNANI_API_KEY="your_gnani_api_key_here"

PORT=3000
```

---

## 5. Development & Testing Commands

```bash
# Start local development server (Express + Vite on port 3000)
npm run dev

# Run Vitest test suite (16 tests across 3 suites)
npm test

# Run TypeScript linter
npm run lint

# Build production assets
npm run build

# Start production server
npm start
```

---

## 6. Official Gnani API Specifications

- **Inference Endpoint**: `POST https://api.vachana.ai/api/v1/tts/inference`
- **Streaming Endpoint**: `POST https://api.vachana.ai/api/v1/tts/sse`
- **Header**: `X-API-Key-ID: <GNANI_API_KEY>`
- **Content-Type**: `application/json`
- **Payload**:
```json
{
  "text": "<whispers> The night is silent. <pauses> Wait, did you hear that? <excited> It's them!",
  "voice": "Nalini",
  "language": "en-IN",
  "audio_config": {
    "container": "wav",
    "encoding": "linear_pcm",
    "sample_rate": 24000
  }
}
```
- **Response**: Binary audio stream (`audio/wav` or `audio/mpeg`) or chunked base64 SSE events.
