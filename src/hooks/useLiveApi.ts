import { useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Types
export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseLiveApiParams {
  apiKey: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function useLiveApi({ apiKey, videoRef }: UseLiveApiParams) {
  const [status, setStatus] = useState<LiveStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0); // 0-100 for visualizer
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  // Refs for cleanup
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  // Check if AI is speaking loop
  useEffect(() => {
    let interval: any;
    if (status === 'connected') {
      interval = setInterval(() => {
        if (audioContextRef.current) {
          const isSpeaking = audioContextRef.current.currentTime < nextPlayTimeRef.current;
          setIsAiSpeaking(isSpeaking);
        }
      }, 100);
    } else {
      setIsAiSpeaking(false);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Initialize Audio Context
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Gemini output rate
      });
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play audio chunk
  const playAudioChunk = useCallback((base64Audio: string) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    // Convert base64 to Float32Array
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert PCM16 to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Schedule playback
    const buffer = ctx.createBuffer(1, float32Array.length, 24000);
    buffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    // If next play time is in the past, reset it to now
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
    
    source.start(nextPlayTimeRef.current);
    // Advance time for next chunk
    nextPlayTimeRef.current += buffer.duration;
  }, [ensureAudioContext]);

  // Connect to Gemini Live
  const connect = useCallback(async () => {
    if (!apiKey) {
      setError("API Key is required");
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      const ai = new GoogleGenAI({ apiKey });
      
      // Setup audio input
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
        video: {
          width: 640,
          height: 480,
        }
      });
      
      mediaStreamRef.current = stream;
      
      // Connect video to preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      // Setup Audio Input Processing
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      processorRef.current = processor;
      
      // Connect to Gemini
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setStatus('connected');
            console.log("Connected to Gemini Live");
            
            // Start sending audio
            processor.onaudioprocess = (e) => {
              if (isMuted) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(100, rms * 1000));

              // Convert Float32 to PCM16
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: "audio/pcm;rate=16000",
                    data: base64
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(ctx.destination);

            // Start sending video frames
            const sendVideoFrame = () => {
              if (videoRef.current && status === 'connected') {
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth * 0.5; // Downscale for performance
                canvas.height = videoRef.current.videoHeight * 0.5;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                  
                  sessionPromise.then(session => {
                    session.sendRealtimeInput({
                      media: {
                        mimeType: "image/jpeg",
                        data: base64
                      }
                    });
                  });
                }
              }
              if (sessionRef.current) {
                 // Loop handled by interval in component or recursive requestAnimationFrame
                 // For now, we'll use a simple interval in the effect
              }
            };
            
            // Send frames every 1 second (adjust as needed for rate limits/latency)
            // Actually, for "Live" feeling, 1-2fps is often enough for context, 
            // but let's do it via a separate interval in the main component to keep this clean.
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              playAudioChunk(base64Audio);
            }
            
            if (message.serverContent?.turnComplete) {
              // Turn complete
            }
          },
          onclose: () => {
            setStatus('disconnected');
          },
          onerror: (err) => {
            console.error("Gemini Live Error:", err);
            setError(err.message || "Unknown error");
            setStatus('error');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are Lumi, a friendly and knowledgeable AI tutor. You can see what the user shows you. Help them solve problems, explain concepts, and learn. Keep your responses concise and conversational. If you see a math problem, guide them through it rather than just giving the answer.",
        },
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection failed:", err);
      setError(err.message);
      setStatus('error');
    }
  }, [apiKey, isMuted, playAudioChunk, videoRef, status]);

  const disconnect = useCallback(async () => {
    if (sessionRef.current) {
      const session = await sessionRef.current;
      session.close();
      sessionRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setStatus('disconnected');
    setVolume(0);
  }, []);

  // Video frame loop
  useEffect(() => {
    let interval: any;
    if (status === 'connected' && sessionRef.current) {
      interval = setInterval(() => {
        if (videoRef.current) {
          const canvas = document.createElement('canvas');
          const scale = 0.5;
          canvas.width = videoRef.current.videoWidth * scale;
          canvas.height = videoRef.current.videoHeight * scale;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
            
            sessionRef.current.then((session: any) => {
              session.sendRealtimeInput({
                media: {
                  mimeType: "image/jpeg",
                  data: base64
                }
              });
            });
          }
        }
      }, 1000); // 1 FPS for video context is usually sufficient for "tutor" tasks and saves bandwidth
    }
    return () => clearInterval(interval);
  }, [status]);

  return {
    connect,
    disconnect,
    status,
    error,
    volume,
    isMuted,
    setIsMuted,
    isAiSpeaking
  };
}
