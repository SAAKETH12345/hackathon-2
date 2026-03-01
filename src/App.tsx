import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Video, VideoOff, Power, Loader2 } from "lucide-react";
import { AudioVisualizer } from "./components/audio-visualizer";

// Audio Context & Processing
const SAMPLE_RATE = 16000;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Initialize Audio Context (must be user triggered)
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Output sample rate
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const connectToGemini = async () => {
    try {
      setError(null);
      ensureAudioContext();

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const config = {
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            console.log("Connected to Gemini Live");
            setConnected(true);
            startAudioInput();
          },
          onmessage: (message: any) => {
            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              queueAudio(audioData);
            }
            
            // Handle interruption
            if (message.serverContent?.interrupted) {
              clearAudioQueue();
            }
          },
          onclose: () => {
            console.log("Disconnected");
            setConnected(false);
            stopAudioInput();
          },
          onerror: (err: any) => {
            console.error("Gemini Error:", err);
            setError("Connection failed. Please try again.");
            setConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
      };

      const session = await ai.live.connect(config);
      sessionRef.current = session;

    } catch (err) {
      console.error("Connection error:", err);
      setError("Failed to connect to Gemini Live.");
    }
  };

  const disconnect = () => {
    // Clean up session
    // sessionRef.current?.close(); 
    sessionRef.current = null;
    
    stopAudioInput();
    setConnected(false);
    setIsRecording(false);
    setIsVideoOn(false);
  };

  // Audio Output Logic
  const queueAudio = (base64Data: string) => {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    playAudioChunk(float32);
  };

  const playAudioChunk = (audioData: Float32Array) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const buffer = ctx.createBuffer(1, audioData.length, 24000);
    buffer.getChannelData(0).set(audioData);
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    const currentTime = ctx.currentTime;
    // Schedule next chunk
    const startTime = Math.max(currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const clearAudioQueue = () => {
    if (audioContextRef.current) {
        nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  // Audio Input Logic
  const startAudioInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        } 
      });
      mediaStreamRef.current = stream;
      setIsRecording(true);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(Math.min(1, rms * 5)); 

        // Convert to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Base64 encode
        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        // Send to Gemini
        if (sessionRef.current) {
            sessionRef.current.sendRealtimeInput([{
                mimeType: "audio/pcm;rate=16000",
                data: base64
            }]);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      
      sourceRef.current = source;
      processorRef.current = processor;

    } catch (err) {
      console.error("Mic error:", err);
      setError("Microphone access denied.");
    }
  };

  const stopAudioInput = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setVolume(0);
  };

  // Video Logic
  const toggleVideo = async () => {
    if (isVideoOn) {
      // Stop video
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsVideoOn(false);
    } else {
      // Start video
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsVideoOn(true);
        startVideoFrameSending();
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
  };

  const startVideoFrameSending = () => {
    const sendFrame = () => {
      if (!isVideoOn || !sessionRef.current || !videoRef.current || !canvasRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
      
      sessionRef.current.sendRealtimeInput([{
        mimeType: "image/jpeg",
        data: base64
      }]);

      requestAnimationFrame(sendFrame); 
    };
    
    const interval = setInterval(() => {
        if (!isVideoOn) {
            clearInterval(interval);
            return;
        }
        if (sessionRef.current && videoRef.current && canvasRef.current) {
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) {
                // Downscale for performance
                const w = videoRef.current.videoWidth / 4;
                const h = videoRef.current.videoHeight / 4;
                canvasRef.current.width = w;
                canvasRef.current.height = h;
                ctx.drawImage(videoRef.current, 0, 0, w, h);
                const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                sessionRef.current.sendRealtimeInput([{
                    mimeType: "image/jpeg",
                    data: base64
                }]);
             }
        }
    }, 500); // 2 FPS
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans overflow-hidden relative">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#1a1a2e_0%,_#000000_100%)] z-0" />
      
      {/* Main Content */}
      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-md">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-light tracking-widest text-white/80 uppercase">Lumi</h1>
          <p className="text-xs text-white/40 tracking-widest mt-2">Multimodal Live Agent</p>
        </motion.div>

        {/* Visualizer Stage */}
        <div className="relative w-full aspect-square max-w-[300px] flex items-center justify-center">
            <AudioVisualizer volume={volume} active={connected} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-300 ${
              isVideoOn ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            disabled={!connected}
          >
            {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          <button
            onClick={connected ? disconnect : connectToGemini}
            className={`p-6 rounded-full transition-all duration-500 shadow-lg ${
              connected 
                ? "bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30" 
                : "bg-white text-black hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            }`}
          >
            {connected ? <Power size={32} /> : <Mic size={32} />}
          </button>

          <button
            className={`p-4 rounded-full transition-all duration-300 ${
              isRecording ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            disabled={!connected}
          >
            {isRecording ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
        </div>

        {/* Status / Error */}
        <div className="h-6 text-center">
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {!error && !connected && <p className="text-white/30 text-xs">Tap microphone to start</p>}
            {!error && connected && <p className="text-emerald-400/70 text-xs animate-pulse">Live Connection Active</p>}
        </div>

      </div>

      {/* Hidden Video/Canvas for processing */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
