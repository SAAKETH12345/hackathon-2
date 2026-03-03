# Lumi - AI Tutor

Lumi is a next-generation live multimodal agent that you can talk to naturally. It uses the Gemini Live API to see what you see and hear what you say in real-time, functioning as an interactive AI tutor.

## Features

- **Real-time Voice Interaction:** Talk to Lumi naturally with low-latency audio streaming.
- **Visual Understanding:** Toggle the camera to let Lumi see your environment, homework, or objects.
- **Immersive UI:** A glowing, reactive visualizer that pulses with the conversation.
- **Interruptible:** You can interrupt Lumi at any time, just like a real person.

## Technical Implementation

- **Gemini Live API:** Uses `ai.live.connect` with `gemini-2.5-flash-native-audio-preview-09-2025` for bidirectional streaming.
- **Audio Processing:** Captures microphone input (16kHz PCM) and plays back model audio using the Web Audio API.
- **Video Streaming:** Captures video frames and sends them to the model for multimodal context.
- **Tech Stack:** React, Vite, Tailwind CSS, Motion.

## How to Use

1. **Add your API Key:** Ensure your `GEMINI_API_KEY` is set in the AI Studio Secrets panel.
2. **Start:** Click the **Microphone** button to initialize the connection.
3. **Talk:** Speak naturally. Lumi will respond.
4. **See:** Click the **Video** icon to enable the camera. Lumi will describe what it sees or answer questions about it.

The application is ready to use!
