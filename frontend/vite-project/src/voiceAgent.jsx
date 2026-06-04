import { useState, useRef, useCallback, useEffect } from "react";

const STATES = {
    IDLE: "idle",
    LISTENING: "listening",
};


// const speak = async (text) => {
//     const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

// //   const response = await fetch(
// //     `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
// //     {
// //       method: "POST",
// //       headers: {
// //         "xi-api-key": "sk_394223ed261c8b30d4e125b4b18d77c2db6e8a4427d51909",
// //         "Content-Type": "application/json",
// //       },
// //       body: JSON.stringify({
// //         text,
// //         model_id: "eleven_multilingual_v2",
// //       }),
// //     }
// //   );

//   const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb", {
//   method: "POST",
//   headers: {
//     "Accept": "audio/mpeg",
//     "Content-Type": "application/json",
//     "xi-api-key": "sk_394223ed261c8b30d4e125b4b18d77c2db6e8a4427d51909"
//   },
//   body: JSON.stringify({
//     text, // Ensure this is not undefined or empty
//     model_id: "eleven_monolingual_v1",
//     voice_settings: {
//       stability: 0.5,
//       similarity_boost: 0.5
//     }
//   })
// });

//   const blob = await response.blob();
//   const url = URL.createObjectURL(blob);

//   const audio = new Audio(url);
//   audio.play();
// };

const speak = (text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
};

const BAR_COUNT = 18;
const BASE_HEIGHTS = [18, 32, 26, 42, 14, 38, 28, 48, 20, 36, 16, 44, 30, 22, 40, 12, 34, 24];

export default function VoiceAgent() {
    const [status, setStatus] = useState(STATES.IDLE);
    const [partialTranscript, setPartialTranscript] = useState("");
    const [finalTranscript, setFinalTranscript] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [barHeights, setBarHeights] = useState(BASE_HEIGHTS);

    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const analyserRef = useRef(null);
    const statusRef = useRef(status);
    const silenceTimerRef = useRef(null);
    const transcriptRef = useRef("");

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Animate bars while listening
    useEffect(() => {
        const animate = () => {
            if (analyserRef.current) {
                const data = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(data);
                setBarHeights(BASE_HEIGHTS.map((base, i) => {
                    const freq = data[Math.floor((i / BAR_COUNT) * data.length)] || 0;
                    return Math.max(5, base * 0.3 + (freq / 255) * 52);
                }));
            } else {
                const t = Date.now() / 450;
                setBarHeights(BASE_HEIGHTS.map((base, i) =>
                    5 + Math.abs(Math.sin(t + i * 0.38)) * (base - 5)
                ));
            }
            animFrameRef.current = requestAnimationFrame(animate);
        };

        if (status === STATES.LISTENING) {
            animFrameRef.current = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animFrameRef.current);
            setBarHeights(BASE_HEIGHTS);
        }
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [status]);

    // ---------------- TOKEN ----------------
    const fetchTemporaryToken = async () => {
        const response = await fetch("http://127.0.0.1:8000/token");
        const data = await response.json();
        if (!data.token) throw new Error("Token not found");
        return data.token;
    };

    // ---------------- CREATE WEBSOCKET ----------------
    const createWebSocket = useCallback(async () => {
        const token = await fetchTemporaryToken();
        const socket = new WebSocket(
            `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&token=${token}`
        );
        socket.binaryType = "arraybuffer";
        socket.onopen = () => console.log("WebSocket Connected");
        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log("Received:", data);
            console.log("TYPE:", data.type);
            console.log("FULL DATA:", data);

            if (data.type === "PartialTranscript") {
                setPartialTranscript(data.text);
            }



if (
    data.type === "Turn" &&
    data.end_of_turn === true &&
    data.transcript
){
    setFinalTranscript(data.transcript);

    transcriptRef.current += " " + data.transcript;

    clearTimeout(silenceTimerRef.current);

    silenceTimerRef.current = setTimeout(async () => {
        console.log("Sending:", transcriptRef.current);

      const respone = await fetch("http://127.0.0.1:8000/transcribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transcript: transcriptRef.current.trim(),
            }),
        });

        transcriptRef.current = "";
        const result = await respone.json();
        console.log("Response from backend:", result);
        await speak(result.response);
    }, 2000);

    

}
        };
        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setErrorMessage("WebSocket connection failed");
        };
        socket.onclose = (event) => {
            console.log("Socket Closed:", event.code, event.reason);
            setStatus(STATES.IDLE);
        };
        socketRef.current = socket;
    }, []);

    // ---------------- AUDIO CONVERT ----------------
    const floatTo16BitPCM = (float32Array) => {
        const output = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return output;
    };

    // ---------------- DOWNSAMPLE ----------------
    const downsampleBuffer = (buffer, inputSampleRate, outputSampleRate) => {
        if (inputSampleRate === outputSampleRate) return buffer;
        const sampleRateRatio = inputSampleRate / outputSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i]; count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    };

    // ---------------- SEND AUDIO ----------------
    const sendAudioChunk = (inputData) => {
        const socket = socketRef.current;
        const audioContext = audioContextRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        const downsampledData = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
        const pcmData = floatTo16BitPCM(downsampledData);
        socket.send(pcmData.buffer);
    };

    // ---------------- START LISTENING ----------------
    const startListening = async () => {
        try {
            setErrorMessage("");
            setPartialTranscript("");
            setFinalTranscript("");
            setStatus(STATES.LISTENING);
            await createWebSocket();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            // Analyser for real bar animation
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            source.connect(analyser);

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (event) => {
                sendAudioChunk(event.inputBuffer.getChannelData(0));
            };
            source.connect(processor);
            processor.connect(audioContext.destination);
            processorRef.current = processor;
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
        }
    };

    // ---------------- STOP ----------------
    const stopListening = () => {
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        audioContextRef.current?.close();
        socketRef.current?.close();
        analyserRef.current = null;
        setStatus(STATES.IDLE);
    };

    // ---------------- BUTTON ----------------
    const handleClick = () => {
        if (status === STATES.IDLE) startListening();
        else stopListening();
    };

    const isListening = status === STATES.LISTENING;

    // ---------------- UI ----------------
    return (
        <div style={S.root}>
            <style>{css}</style>

            {/* Ambient glow */}
            <div style={{ ...S.glow, opacity: isListening ? 1 : 0 }} />

            <div style={S.card}>
                {/* Title */}
                <p style={S.eyebrow}>AssemblyAI</p>
                <h1 style={S.title}>Voice Agent</h1>

                {/* Mic button */}
                <div style={S.micWrap}>
                    {/* Ripple rings */}
                    {isListening && [0, 1, 2].map((i) => (
                        <span key={i} className="ripple" style={{ animationDelay: `${i * 0.6}s` }} />
                    ))}

                    <button
                        onClick={handleClick}
                        aria-label={isListening ? "Stop recording" : "Start recording"}
                        className={isListening ? "mic-btn listening" : "mic-btn"}
                    >
                        {isListening ? <StopIcon /> : <MicIcon />}
                    </button>
                </div>

                {/* 3 dots while listening */}
                <div style={S.dotsRow}>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className={isListening ? "dot dot-active" : "dot"}
                            style={{ animationDelay: `${i * 0.16}s` }}
                        />
                    ))}
                </div>

                {/* Waveform bars */}
                <div style={S.barsRow}>
                    {barHeights.map((h, i) => (
                        <span
                            key={i}
                            style={{
                                ...S.bar,
                                height: isListening ? h : 4,
                                opacity: isListening ? 1 : 0.18,
                                transition: isListening
                                    ? "height 0.1s ease, opacity 0.4s"
                                    : "height 0.4s ease, opacity 0.4s",
                                animationDelay: `${i * 0.04}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Status label */}
                <p style={{ ...S.statusLabel, color: isListening ? "#ff4b4b" : "#555" }}>
                    {isListening ? "listening…" : "tap to speak"}
                </p>

                {/* Transcripts */}
                <div style={S.transcriptBox}>
                    {partialTranscript && (
                        <div style={S.partialBlock}>
                            <span style={S.tag}>partial</span>
                            <p style={S.partialText}>{partialTranscript}</p>
                        </div>
                    )}
                    {finalTranscript && (
                        <div style={S.finalBlock}>
                            <span style={{ ...S.tag, background: "#1d9e75", color: "#fff" }}>final</span>
                            <p style={S.finalText}>{finalTranscript}</p>
                        </div>
                    )}
                </div>

                {/* Error */}
                {errorMessage && (
                    <p style={S.error}>{errorMessage}</p>
                )}
            </div>
        </div>
    );
}

// ── Icons ──────────────────────────────────────────────────────
function MicIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="9" y1="22" x2="15" y2="22" />
        </svg>
    );
}

function StopIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
    );
}

// ── CSS ────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@300;400&display=swap');

  @keyframes rippleOut {
    0%   { opacity: 0.3; transform: scale(0.9); }
    100% { opacity: 0;   transform: scale(2.4); }
  }
  @keyframes dotBounce {
    0%, 100% { transform: translateY(0) scale(1);    opacity: 0.6; }
    50%       { transform: translateY(-6px) scale(1.3); opacity: 1;   }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50%       { opacity: 0.6;  transform: scale(1.08); }
  }

  .ripple {
    position: absolute;
    width: 80px; height: 80px;
    border-radius: 50%;
    background: rgba(255,75,75,0.22);
    animation: rippleOut 1.8s ease-out infinite;
  }

  .mic-btn {
    position: relative; z-index: 2;
    width: 80px; height: 80px;
    border-radius: 50%; border: none;
    background: #1a1a1a;
    color: #ccc;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.25s, color 0.25s, transform 0.15s, box-shadow 0.25s;
    box-shadow: 0 0 0 1.5px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.6);
    outline: none;
  }
  .mic-btn:hover { transform: scale(1.06); }
  .mic-btn:active { transform: scale(0.95); }
  .mic-btn.listening {
    background: #ff4b4b;
    color: white;
    box-shadow: 0 0 0 2px rgba(255,75,75,0.4), 0 8px 32px rgba(255,75,75,0.3);
  }

  .dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #ff4b4b;
    opacity: 0;
    transform: scale(0);
    transition: opacity 0.2s, transform 0.2s;
  }
  .dot-active {
    opacity: 1;
    transform: scale(1);
    animation: dotBounce 0.65s ease-in-out infinite;
  }
`;

// ── Styles ─────────────────────────────────────────────────────
const S = {
    root: {
        minHeight: "100vh",
        background: "#0c0c0c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Mono', monospace",
        position: "relative",
        overflow: "hidden",
    },
    glow: {
        position: "absolute",
        width: "500px", height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,75,75,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
        transition: "opacity 0.6s",
        animation: "glowPulse 2.5s ease-in-out infinite",
    },
    card: {
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        padding: "52px 60px",
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: "28px",
        backdropFilter: "blur(16px)",
        minWidth: "360px",
        maxWidth: "480px",
        width: "100%",
    },
    eyebrow: {
        margin: 0,
        fontSize: "11px",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.25)",
        fontFamily: "'DM Mono', monospace",
    },
    title: {
        margin: 0,
        fontSize: "28px",
        fontWeight: 400,
        color: "rgba(255,255,255,0.88)",
        fontFamily: "'DM Serif Display', serif",
        letterSpacing: "-0.02em",
    },
    micWrap: {
        position: "relative",
        width: "80px", height: "80px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: "8px",
    },
    dotsRow: {
        display: "flex",
        gap: "10px",
        alignItems: "center",
        height: "18px",
    },
    barsRow: {
        display: "flex",
        alignItems: "flex-end",
        gap: "3px",
        height: "56px",
    },
    bar: {
        width: "4px",
        borderRadius: "2px",
        background: "linear-gradient(to top, #ff4b4b, #ff8a8a)",
        display: "inline-block",
    },
    statusLabel: {
        margin: 0,
        fontSize: "12px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
        transition: "color 0.3s",
    },
    transcriptBox: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minHeight: "20px",
    },
    partialBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        animation: "fadeIn 0.3s ease",
    },
    finalBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        animation: "fadeIn 0.3s ease",
    },
    tag: {
        fontSize: "10px",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.4)",
        padding: "2px 8px",
        borderRadius: "4px",
        alignSelf: "flex-start",
        fontFamily: "'DM Mono', monospace",
    },
    partialText: {
        margin: 0,
        fontSize: "14px",
        color: "rgba(255,255,255,0.45)",
        lineHeight: 1.6,
        fontStyle: "italic",
        fontFamily: "'DM Mono', monospace",
    },
    finalText: {
        margin: 0,
        fontSize: "15px",
        color: "rgba(255,255,255,0.88)",
        lineHeight: 1.6,
        fontFamily: "'DM Mono', monospace",
    },
    error: {
        margin: 0,
        fontSize: "13px",
        color: "#ff4b4b",
        fontFamily: "'DM Mono', monospace",
    },
};