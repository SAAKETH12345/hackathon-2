# Lumi - AI Tutor

Lumi is a next-generation live multimodal agent that you can talk to naturally. It uses the Gemini Live API to see what you see and hear what you say in real-time, functioning as an interactive AI tutor.

## Project Summary

### Features
- **Real-time Voice Interaction:** Talk to Lumi naturally with low-latency audio streaming.
- **Visual Understanding:** Toggle the camera to let Lumi see your environment, homework, or objects.
- **Immersive UI:** A glowing, reactive visualizer that pulses with the conversation.
- **Interruptible:** You can interrupt Lumi at any time, just like a real person.

### Technologies Used
- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Animations:** Motion (formerly Framer Motion)
- **AI Integration:** Google GenAI SDK (`@google/genai`)
- **Audio Processing:** Web Audio API (AudioContext, ScriptProcessor)

### Data Sources
- **Real-time Input:** The application uses the user's live microphone and camera feed as the primary data source.
- **Knowledge Base:** Powered by the Gemini 2.5 Flash model's extensive training data.

### Findings & Learnings
- **Real-time Latency:** Managing audio buffers and sample rate conversion (48kHz -> 16kHz) is critical for low-latency interaction.
- **Multimodal Flow:** Synchronizing video frames with audio input creates a much more "present" feeling agent than audio alone.
- **State Management:** Handling WebSocket connection states (connecting, connected, interrupted) requires robust error handling and UI feedback.

---

## Spin-up Instructions

Follow these steps to run the project locally:

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A Google AI Studio API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <https://github.com/SAAKETH12345/hackathon-2.git>
   cd lumi-ai-tutor
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   - Create a `example.env` file in the root directory.
   - Add your API key:
     ```env
     GEMINI_API_KEY=AIzaSyAwYGZhwp6mOPm3H5EBNLFzlZ0TURk0Mw0
     ```
   - *Note: For deployment (e.g., Netlify), add this variable in the platform's dashboard.*

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   - Visit `http://localhost:3000` (or the port shown in your terminal).

---

## Google Cloud Deployment Proof

This application's backend intelligence is fully powered by **Google Cloud**.

- **Code Evidence:** The connection to Google Cloud's Gemini API is established in `src/App.tsx`.
- **API Usage:** We use the `GoogleGenAI` client to connect to the `gemini-2.5-flash-native-audio-preview-09-2025` model via WebSockets.

**Key Code Snippet (`src/App.tsx`):**
```typescript
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const session = await ai.live.connect({
  model: "gemini-2.5-flash-native-audio-preview-09-2025",
  // ... configuration
});
```

This demonstrates direct usage of Google Cloud's Generative AI infrastructure.
