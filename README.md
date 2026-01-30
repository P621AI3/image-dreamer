# Image Dreamer

Voice-driven AI image generation and video creation. Speak to generate images, evolve them with your words, then bring them to life as videos.

## How It Works

1. **Speak** -- click the mic and describe what you want to see
2. **Generate** -- your words are transcribed and sent to Gemini, which generates an image
3. **Evolve** -- keep speaking to refine the image. Each new phrase builds on the full conversation history
4. **Animate** -- click the filmstrip button to generate a video from your image using Veo 3.1
5. **Edit videos** -- speak while in video mode to describe edits. The app describes the current video, combines it with your edit, and regenerates

The mic listens continuously and auto-detects when you stop speaking (2 seconds of silence). Filler words like "um", "uh", "like" are filtered out.

## Architecture

```
Browser (React + Vite)          Server (Express + Node.js)
┌─────────────────────┐         ┌──────────────────────────┐
│ useAudioRecorder    │         │                          │
│   ↓ audio blob      │         │  POST /api/transcribe    │
│ useImageDreamer     │────────>│    → OpenAI Whisper      │
│   ↓ text prompt     │         │                          │
│                     │────────>│  POST /api/generate-image│
│   ↓ image           │         │    → Gemini (Nano Banana)│
│                     │         │                          │
│ ImageDisplay        │────────>│  POST /api/video/generate│
│ VideoDisplay        │         │    → Veo 3.1             │
│                     │         │                          │
│                     │────────>│  POST /api/video/edit    │
│                     │         │    → Gemini describe     │
│                     │         │    → Veo 3.1 regenerate  │
└─────────────────────┘         └──────────────────────────┘
```

**Client** -- React 18 with TypeScript, built with Vite. State management via custom hooks (`useImageDreamer` orchestrates the full flow, `useAudioRecorder` handles mic input with silence detection). Session state persists across page refreshes via `sessionStorage`. A gallery of saved images lives in `localStorage`.

**Server** -- Express with TypeScript, run via `tsx`. Stateless -- every request is independent. Routes delegate to service modules for each external API. Centralized error handling middleware maps errors to typed codes the client can categorize.

## Tech Stack

| Layer            | Tech                                                       |
| ---------------- | ---------------------------------------------------------- |
| Frontend         | React 18, TypeScript, Vite                                 |
| Backend          | Express, TypeScript, Node.js 22                            |
| Image Generation | Google Gemini (`gemini-3-pro-image-preview` / Nano Banana) |
| Video Generation | Google Veo 3.1 (`veo-3.1-generate-preview`)                |
| Transcription    | OpenAI Whisper                                             |
| Dev Tooling      | ESLint, Prettier, Husky, lint-staged, GitHub Actions CI    |

## Setup

```bash
# Clone
git clone https://github.com/P621AI3/image-dreamer.git
cd image-dreamer

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY  -- for Whisper transcription
#   GEMINI_API_KEY  -- for Gemini image gen + Veo video gen

# Start dev server
npm run dev
```

The client runs on HTTPS (required for microphone access). Open the URL shown in the terminal (usually `https://localhost:5173`).

## Environment Variables

| Variable         | Required | Description                                                    |
| ---------------- | -------- | -------------------------------------------------------------- |
| `OPENAI_API_KEY` | Yes      | OpenAI API key for Whisper transcription                       |
| `GEMINI_API_KEY` | Yes      | Google AI API key for Gemini and Veo                           |
| `GEMINI_MODEL`   | No       | Image generation model (default: `gemini-3-pro-image-preview`) |
| `PORT`           | No       | Server port (default: `3001`)                                  |

## Scripts

```bash
npm run dev        # Start both server and client
npm run build      # Build for production
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checks
npm run format     # Format with Prettier
```

## Project Structure

```
├── client/                 # React frontend
│   └── src/
│       ├── components/     # React components
│       ├── hooks/          # useImageDreamer, useAudioRecorder, useGallery
│       ├── services/       # API client, session/gallery persistence, image utils
│       └── types/          # Shared TypeScript types
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # transcribe, generate, video
│       ├── services/       # whisper, gemini, veo
│       └── middleware/     # Error handler
├── .github/workflows/      # CI pipeline
└── .husky/                 # Pre-commit hooks
```

## Key Design Decisions

- **Custom hooks over state libraries** -- `useImageDreamer` manages the full app state machine. Refs mirror state values for safe access inside async callbacks without stale closures.
- **Silence-based chunking** -- The audio recorder auto-detects 2 seconds of silence to finalize a speech chunk, so the user never needs to press a button to submit.
- **Retry logic for Gemini** -- Image generation retries up to 3 times on transient `finishReason: OTHER` failures (a known intermittent issue with Gemini preview models).
- **Video editing via description** -- Since Veo can't directly edit videos, the app uploads the video, asks Gemini to describe it, then combines the description with the user's edit prompt to regenerate.
- **Stateless server** -- No database or server sessions. The client owns all state, making the server trivially scalable.
