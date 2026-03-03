# System Architecture

This diagram illustrates how the Lumi AI Tutor connects the user's browser to Google's Gemini Live API.

```mermaid
graph TD
    subgraph Client [User's Browser]
        UI[React UI]
        Mic[Microphone Input]
        Cam[Camera Input]
        AudioProc[Audio Processor]
        Speaker[Speaker Output]
    end

    subgraph Cloud [Google Cloud Platform]
        Gemini[Gemini 2.5 Flash Model]
    end

    %% Data Flow
    Mic -->|Raw Audio| AudioProc
    AudioProc -->|16kHz PCM Audio| UI
    Cam -->|Video Frames| UI
    
    UI <-->|"WebSocket (Bidi Streaming)"| Gemini
    
    Gemini -->|Generated Audio| UI
    UI -->|Playback| Speaker

    %% Styling
    style Gemini fill:#4285F4,stroke:#fff,stroke-width:2px,color:#fff
    style Client fill:#f9f9f9,stroke:#333,stroke-width:2px
```

## Data Flow Description

1.  **Input Capture:**
    *   **Audio:** The browser captures audio via `navigator.mediaDevices.getUserMedia`.
    *   **Video:** Video frames are captured from the camera feed.

2.  **Processing:**
    *   Audio is downsampled to 16kHz PCM (required by Gemini).
    *   Video frames are resized and compressed to JPEG base64.

3.  **Transmission:**
    *   The React app establishes a persistent WebSocket connection using the `@google/genai` SDK.
    *   Audio chunks and video frames are streamed in real-time to the Gemini model on Google Cloud.

4.  **Response:**
    *   Gemini processes the multimodal input and streams back generated audio chunks.
    *   The app queues and plays these chunks using the Web Audio API for seamless playback.
