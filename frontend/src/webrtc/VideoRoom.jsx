import { useEffect, useRef, useState, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../App";
import "./VideoRoom.css";

const PC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoRoom({ roomId, voiceGender }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const ttsAudioRef = useRef(null); // For TTS playback

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // INPUT VOLUME MONITORING
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [inputVolume, setInputVolume] = useState(0);

  const [status, setStatus] = useState("Starting...");
  const [isInitiator, setIsInitiator] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [firstCallStarted, setFirstCallStarted] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState("english");
  const [remotePreferredLanguage, setRemotePreferredLanguage] = useState("english");
  const remotePreferredLanguageRef = useRef("english"); // Use ref to access latest value in closures
  const preferredLanguageRef = useRef("english"); // Use ref for stable access in WebSocket handlers
  const ttsEnabledRef = useRef(true); // Use ref for stable access in WebSocket handlers
  const translateAndPlayTTSRef = useRef(null); // Ref to hold the latest translateAndPlayTTS function
  const [partnerVoiceGender, setPartnerVoiceGender] = useState("masculine"); // Default to masculine
  const [isEnding, setIsEnding] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const SIGNAL_URL = "ws://35.183.199.110:8080";

  // TRANSCRIPTION + TRANSLATION
  const streamRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState("");
  const [remoteTranslation, setRemoteTranslation] = useState("");
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [ttsEnabled, setTTSEnabled] = useState(true); // Toggle for TTS
  const CHUNK_MS = 2500; // tune: 2000–4000

  // Keep refs in sync with state
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  useEffect(() => {
    preferredLanguageRef.current = preferredLanguage;
  }, [preferredLanguage]);

  async function sendBlob(blob) {
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");
    // Use ref to get the latest value (avoids closure stale value issue)
    form.append("remotePreferredLanguage", remotePreferredLanguageRef.current);

    console.log("YOOOOO MY PARTNERS PREFERRED LANGUAGE", remotePreferredLanguageRef.current);

    const res = await fetch("http://localhost:4000/translate_if_non_english", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function changePreferredLanguage(language) {
    try {
      setPreferredLanguage(language);
      preferredLanguageRef.current = language; // Update ref
      try {
        wsRef.current.send(JSON.stringify({
          type: "preferredLanguage",
          roomId,
          preferredLanguage: language,
        }));
        console.log("Preferred language changed to:", language);
      } catch (sendError) {
        console.error("Failed to send preferred language:", sendError);
      }
    } catch (error) {
      console.error("Failed to change preferred language:", error);
      throw error;
    }
  }

  // TTS Generation and Playback
  const generateAndPlayTTS = useCallback(async (text) => {
    try {
      console.log("🔊 Generating TTS for:", text);
      console.log("🎤 Using partner's voice preference:", partnerVoiceGender);
      setIsTTSPlaying(true);

      // Lower remote video volume
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = 0.15; // Lower to 15%
      }

      // Generate TTS using partner's voice preference
      const response = await fetch("http://localhost:4000/generate_tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          voice_gender: partnerVoiceGender, // Use partner's voice preference
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS generation failed: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create or reuse audio element
      if (!ttsAudioRef.current) {
        ttsAudioRef.current = new Audio();
      }

      const audio = ttsAudioRef.current;
      audio.src = audioUrl;
      audio.volume = 1.0;

      // Play TTS
      audio.onended = () => {
        // Restore remote video volume
        if (remoteVideoRef.current) {
          remoteVideoRef.current.volume = 1.0;
        }
        setIsTTSPlaying(false);
        URL.revokeObjectURL(audioUrl);
        console.log("✅ TTS playback completed");
      };

      audio.onerror = (e) => {
        console.error("TTS playback error:", e);
        // Restore remote video volume on error
        if (remoteVideoRef.current) {
          remoteVideoRef.current.volume = 1.0;
        }
        setIsTTSPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log("🔊 Playing TTS audio");

    } catch (error) {
      console.error("Failed to generate/play TTS:", error);
      // Restore remote video volume on error
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = 1.0;
      }
      setIsTTSPlaying(false);
    }
  }, [partnerVoiceGender]);

  // Translate text to user's preferred language and play TTS
  const translateAndPlayTTS = useCallback(async (englishText) => {
    try {
      const currentLanguage = preferredLanguageRef.current;
      console.log("🌍 Translating to", currentLanguage, ":", englishText);
      
      // Translate English text to user's preferred language using backend
      const translateResponse = await fetch("http://localhost:4000/translate_text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: englishText,
          target_language: currentLanguage,
        }),
      });

      if (!translateResponse.ok) {
        throw new Error(`Translation failed: ${translateResponse.statusText}`);
      }

      const translateData = await translateResponse.json();
      const translatedText = translateData.translated_text || englishText;
      console.log("✅ Translated text:", translatedText);

      // Now generate and play TTS for the translated text
      await generateAndPlayTTS(translatedText);

    } catch (error) {
      console.error("Failed to translate:", error);
      // Fallback to playing TTS with English text
      await generateAndPlayTTS(englishText);
    }
  }, [generateAndPlayTTS]);

  // Keep translateAndPlayTTS ref updated
  useEffect(() => {
    translateAndPlayTTSRef.current = translateAndPlayTTS;
  }, [translateAndPlayTTS]);

  function makeRecorder(stream) {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const mr = new MediaRecorder(stream, { mimeType });

    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      // When stopped, build a complete file blob and send it
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      // If we stopped because we're fully done, ignore final send
      if (!isRecordingRef.current) return;

      // Check if blob has minimum size (at least 1KB to avoid corrupted files)
      if (blob.size < 1024) {
        console.warn("Blob too small, skipping send:", blob.size, "bytes");
        return;
      }

      try {
        const data = await sendBlob(blob);
        const translation = data.english_translation_or_empty || "";
        const newLine = { transcript: data.transcript, en: translation };
        setLines((p) => [...p, newLine]);
        
        // Send the English translation to the other user if it exists
        if (translation && translation.trim() !== "" && wsRef.current?.readyState === WebSocket.OPEN && roomId) {
          try {
            wsRef.current.send(JSON.stringify({
              type: "translation",
              roomId,
              translation: translation,
            }));
            console.log("Sent translation to other user:", translation);
          } catch (sendError) {
            console.error("Failed to send translation:", sendError);
          }
        } else {
          if (!translation || translation.trim() === "") {
            console.log("No translation to send (empty)");
          } else if (wsRef.current?.readyState !== WebSocket.OPEN) {
            console.log("WebSocket not open, readyState:", wsRef.current?.readyState);
          } else if (!roomId) {
            console.log("RoomId not available");
          }
        }
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        // Start the next chunk if still recording
        // if (isRecordingRef.current) startChunk();
      }
    };

    mr.onerror = (e) => setErr(String(e.error?.message || e.message || e));
    return mr;
  }

  const isRecordingRef = useRef(false);

  async function startTranscriptionTranslation() {
    setErr("");
    setLines([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    isRecordingRef.current = true;
    setIsRecording(true);
  }

  function stop() {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
    mrRef.current = null;

    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // INPUT VOLUME MONITORING
  function calculateRMS(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    return Math.sqrt(sumSquares / dataArray.length);
  }

  const startInputVolumeMonitoring = useCallback((stream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      function monitor(lastVolume = 0) {
        if (!streamRef.current || !analyserRef.current) return;
        
        const volume = calculateRMS(analyserRef.current);
        setInputVolume(volume);
        
        // Start recording if volume goes above threshold and we're not already recording
        if (volume > 0.006 && (!mrRef.current || mrRef.current.state === "inactive")) {
          console.log("Volume above threshold, starting recording");
          mrRef.current = makeRecorder(streamRef.current);
          mrRef.current.start();
        }
        
        // Stop recording if volume drops below threshold and we're currently recording
        console.log("lastVolume", lastVolume, "volume", volume);
        if (lastVolume > 0.006 && volume < 0.006) {
          console.log("Volume dropped below threshold, stopping recording");
          if (mrRef.current && mrRef.current.state === "recording") {
            // Ensure we've recorded for at least a minimum duration
            setTimeout(() => {
              if (mrRef.current && mrRef.current.state === "recording") {
                mrRef.current.stop();
              }
            }, 500); // Give it at least 500ms of data
          }
        }
        
        animationFrameRef.current = setTimeout(monitor, 2500, volume);
      }
      monitor();
    } catch (e) {
      console.warn("Failed to setup input volume monitoring:", e);
    }
  }, []);

  function stopInputVolumeMonitoring() {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }

  // Helper function to ensure RTCPeerConnection is active
  const ensureActiveConnection = useCallback(() => {
    let pc = pcRef.current;
    const ws = wsRef.current;
    const localStream = localStreamRef.current;

    if (!ws || !localStream) return null;

    // If PC is closed, doesn't exist, or in a bad state, create a new one
    const needsNewConnection = !pc || 
      pc.signalingState === "closed" || 
      pc.connectionState === "closed" ||
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected";
    
    if (needsNewConnection) {
      // Close old connection if it exists
      if (pc) {
        try {
          pc.close();
        } catch (e) {
          console.warn("Error closing old PC:", e);
        }
      }

      pc = new RTCPeerConnection(PC_CONFIG);
      pcRef.current = pc;

      // Ensure local video element has the stream
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }

      // Re-add tracks - check if they're still live, if not, get new ones
      const tracksToAdd = [];
      localStream.getTracks().forEach((t) => {
        if (t.readyState === "live") {
          tracksToAdd.push(t);
        }
      });

      // If tracks are not live, we need to get new media
      if (tracksToAdd.length === 0) {
        console.warn("Local stream tracks are not live, need to get new media");
        return null;
      }

      tracksToAdd.forEach((t) => {
        try {
          pc.addTrack(t, localStream);
        } catch (e) {
          console.warn("Error adding track:", e);
        }
      });

      // Re-setup event handlers
      pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ice", roomId, candidate: e.candidate }));
        }
      };

      pc.onconnectionstatechange = () => {
        setStatus(`WebRTC: ${pc.connectionState}`);
      };
    }

    return pc;
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStatus("Getting camera/mic...");
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (cancelled) return;

      localStreamRef.current = localStream;
      localVideoRef.current.srcObject = localStream;

      // Start monitoring input volume
      startInputVolumeMonitoring(localStream);

      setStatus("Connecting to signaling...");
      const ws = new WebSocket(SIGNAL_URL);
      wsRef.current = ws;

      const pc = new RTCPeerConnection(PC_CONFIG);
      pcRef.current = pc;

      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      pc.ontrack = (e) => {
        remoteVideoRef.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          ws.send(JSON.stringify({ type: "ice", roomId, candidate: e.candidate }));
        }
      };

      pc.onconnectionstatechange = () => {
        setStatus(`WebRTC: ${pc.connectionState}`);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", roomId }));
        setStatus("Joined room. Waiting for peer...");
        
        // Send voice preference to partner
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "voicePreference",
              roomId,
              voiceGender: voiceGender,
            }));
            console.log("Sent voice preference to partner:", voiceGender);
          }
        }, 500);
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "joined") {
          setIsInitiator(!!msg.isInitiator);
          return;
        }

        if (msg.type === "promote_to_initiator") {
          setIsInitiator(true);
          setStatus("Became initiator. You can start the call.");
          return;
        }

        if (msg.type === "end") {
          setStatus("Call ended by peer");
          setCallActive(false);
          try {
            if (pcRef.current) {
              // Don't stop the tracks, just close the connection
              pcRef.current.close();
              // Don't set to null, we'll check if it's closed and recreate it
            }
          } catch {}
          // Clear remote video but keep local video stream
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          // Ensure local video is still showing
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          return;
        }

        if (msg.type === "offer") {
          // Ensure local video is showing
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Ensure connection is active before handling offer
          const activePc = ensureActiveConnection();
          if (!activePc) {
            setStatus("Failed to create connection. Please try again.");
            return;
          }
          
          setStatus("Received offer. Creating answer...");
          try {
            await activePc.setRemoteDescription(msg.sdp);
            const answer = await activePc.createAnswer();
            await activePc.setLocalDescription(answer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "answer", roomId, sdp: activePc.localDescription }));
            }
            setCallActive(true);
          } catch (error) {
            console.error("Failed to handle offer:", error);
            setStatus("Failed to handle offer. Please try again.");
          }
          return;
        }

        if (msg.type === "answer") {
          // Ensure local video is showing
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Ensure connection is active before handling answer
          const activePc = ensureActiveConnection();
          if (!activePc) {
            setStatus("Failed to create connection. Please try again.");
            return;
          }
          
          setStatus("Received answer. Connecting...");
          try {
            await activePc.setRemoteDescription(msg.sdp);
          } catch (error) {
            console.error("Failed to set remote description:", error);
            setStatus("Failed to set remote description. Please try again.");
          }
          return;
        }

        if (msg.type === "ice") {
          const activePc = ensureActiveConnection();
          if (!activePc) return;
          
          try {
            await activePc.addIceCandidate(msg.candidate);
          } catch (e) {
            console.warn("ICE add failed", e);
          }
          return;
        }

        if (msg.type === "translation") {
          const receivedTranslation = msg.translation || "";
          console.log("Received translation from other user:", receivedTranslation);
          setRemoteTranslation(receivedTranslation);
          
          // If the translation exists and we have a preferred language that's not English,
          // and TTS is enabled, generate and play TTS
          if (receivedTranslation && receivedTranslation.trim() !== "" && preferredLanguageRef.current !== "english" && ttsEnabledRef.current) {
            // Generate TTS for the translated text in the user's preferred language
            // First, translate the received English text to user's preferred language
            if (translateAndPlayTTSRef.current) {
              translateAndPlayTTSRef.current(receivedTranslation);
            }
          }
          return;
        }

        if (msg.type === "preferredLanguage") {
          const remoteUserPreferredLanguage = msg.preferredLanguage || "english";
          console.log("Received preferred language from other user:", remoteUserPreferredLanguage);
          setRemotePreferredLanguage(remoteUserPreferredLanguage);
          remotePreferredLanguageRef.current = remoteUserPreferredLanguage; // Update ref for closures
          return;
        }

        if (msg.type === "voicePreference") {
          const remoteVoiceGender = msg.voiceGender || "masculine";
          console.log("Received voice preference from partner:", remoteVoiceGender);
          setPartnerVoiceGender(remoteVoiceGender);
          return;
        }
      };

      ws.onerror = () => setStatus("WebSocket error (check server / URL)");
      ws.onclose = () => setStatus("WebSocket closed");
    }

    start();
    startTranscriptionTranslation();

    return () => {
      cancelled = true;
      stopInputVolumeMonitoring();
      try {
        wsRef.current?.close();
      } catch {}
      try {
        pcRef.current?.close();
      } catch {}
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
    // translateAndPlayTTS is intentionally not in deps - it uses refs to avoid recreating connection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, ensureActiveConnection, startInputVolumeMonitoring, voiceGender]);

  const startCall = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatus("WebSocket not ready. Please wait...");
      return;
    }

    // Ensure local video is showing
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    const pc = ensureActiveConnection();
    if (!pc) {
      setStatus("Failed to create connection. Please try again.");
      return;
    }

    if (!firstCallStarted) {
      setFirstCallStarted(true);
      setIsInitiator(true);
    }

    setStatus("Creating offer...");
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", roomId, sdp: pc.localDescription }));
      setCallActive(true);
    } catch (error) {
      console.error("Failed to create offer:", error);
      setStatus("Failed to start call. Please try again.");
    }
  };

  const copyLink = async () => {
    const link = `${window.location.origin}/call/${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const endCall = () => {
    setIsEnding(true);
    setStatus("Ending call...");
    setCallActive(false);
    
    try {
      if (pcRef.current) {
        // Don't stop the tracks, just close the connection
        pcRef.current.close();
        // Don't set to null, we'll check if it's closed and recreate it
      }
    } catch {}
    
    // Clear remote video but keep local video stream
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Ensure local video is still showing
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    
    // notify peer to end call
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "end", roomId }));
      }
    } catch {}
    
    // Show loading screen briefly, then navigate back
    setTimeout(() => {
      // Cleanup before navigating
      try {
        wsRef.current?.close();
      } catch {}
      try {
        pcRef.current?.close();
      } catch {}
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      stopInputVolumeMonitoring();
      stop();
      
      navigate('/join');
    }, 1500);
  };

  const canStart = (!firstCallStarted && isInitiator && !callActive) || (firstCallStarted && !callActive);

  // Show loading screen while ending
  if (isEnding) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Ending meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-room-wrap">
      {/* Header with Logo, Title, Status, and Theme Toggle */}
      <div className="video-room-header">
        <div className="video-room-logo-section">
          <button className="back-button" onClick={() => navigate('/join')} title="Back to join page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="video-room-logo">
            <img src="/logo.svg" alt="RealTalk Logo" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="video-room-title">
            <h1><strong>REAL</strong>TALK</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="video-room-pill">
                <span style={{ opacity: 0.7 }}>Room</span>
                <span style={{ fontWeight: 600 }}>{roomId}</span>
              </div>
              <button 
                className="copy-link-button" 
                onClick={copyLink}
                title="Copy meeting link"
              >
                {linkCopied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span>Copy Invite Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="video-room-header-right">
          <div className="video-room-status-pill">
            <span className={`video-room-dot ${canStart ? 'can-start' : 'cannot-start'}`} />
            <span>{status}</span>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Videos */}
      <div className="video-room-grid">
        <div className="video-room-card">
          <div className="video-room-card-header">
            <div className="video-room-label">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#3b82f6" }} />
              Local
            </div>
            <span className="video-room-badge">You</span>
          </div>
          <div className="video-room-video-container">
            <video ref={localVideoRef} autoPlay muted playsInline className="video-room-video" />
            {lines.length > 0 && lines[lines.length - 1].en && (
              <div className="video-room-translation">
                <div className="video-room-translation-label">YOUR TRANSLATION</div>
                <div>{lines[lines.length - 1].en}</div>
              </div>
            )}
          </div>
        </div>

        <div className="video-room-card">
          <div className="video-room-card-header">
            <div className="video-room-label">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#a855f7" }} />
              Remote
            </div>
            <span className="video-room-badge">Live</span>
          </div>
          <div className="video-room-video-container">
            <video ref={remoteVideoRef} autoPlay playsInline className="video-room-video" />
            {remoteTranslation && (
              <div className="video-room-translation">
                <div className="video-room-translation-label">
                  PARTNER'S TRANSLATION
                  {isTTSPlaying && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '11px', 
                      padding: '2px 6px', 
                      background: 'rgba(59, 130, 246, 0.2)', 
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      🔊 TTS Playing
                    </span>
                  )}
                </div>
                <div>{remoteTranslation}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="video-room-bottom">
        <div className="video-room-controls">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, whiteSpace: "nowrap" }}>
              Preferred Language:
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => changePreferredLanguage(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                outline: "none",
                fontFamily: "inherit",
              }}
            >
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="korean">Korean</option>
              <option value="arabic">Arabic</option>
              <option value="french">French</option>
              <option value="spanish">Spanish</option>
              <option value="portuguese">Portuguese</option>
              <option value="russian">Russian</option>
              <option value="turkish">Turkish</option>
              <option value="italian">Italian</option>
              <option value="german">German</option>
              <option value="japanese">Japanese</option>
            </select>

            <button 
              onClick={() => setTTSEnabled(!ttsEnabled)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: ttsEnabled ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                background: ttsEnabled ? "var(--accent-light)" : "var(--bg-card)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                outline: "none",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
              title={ttsEnabled ? "Click to disable TTS" : "Click to enable TTS"}
            >
              {ttsEnabled ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <line x1="23" y1="9" x2="17" y2="15"></line>
                  <line x1="17" y1="9" x2="23" y2="15"></line>
                </svg>
              )}
              <span>TTS {ttsEnabled ? 'On' : 'Off'}</span>
            </button>
          </div>

          <div className="video-room-button-group">
            <button 
              onClick={startCall} 
              disabled={!canStart} 
              className={`video-room-button ${canStart ? 'can-start' : 'cannot-start'}`}
            >
              Start Call
            </button>
            <button 
              onClick={endCall} 
              disabled={!callActive} 
              className={`video-room-end-button ${callActive ? 'active' : 'inactive'}`}
            >
              End Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
