import { BrowserRouter, Routes, Route, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { createContext, useState, useEffect, useContext, useRef } from "react";
import VideoRoom from "./webrtc/VideoRoom";
import "./App.css";

export const ThemeContext = createContext();

function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <div className="landing-nav-logo">
            <img src="/logo.svg" alt="RealTalk Logo" />
            <span><strong>REAL</strong>TALK</span>
          </div>
          <div className="landing-nav-actions">
            <button className="theme-toggle-landing" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
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
            <button className="landing-nav-button" onClick={() => navigate('/join')}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">Live Translation</div>
          <h1 className="landing-hero-title">
            Break Language Barriers<br />in <span className="landing-hero-highlight">Real Time</span>
          </h1>
          <p className="landing-hero-subtitle">
            Connect with anyone, anywhere, in any language. RealTalk provides instant translation
            during video calls, making global communication effortless.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-cta-primary" onClick={() => navigate('/join')}>
              Start a Free Call
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button className="landing-cta-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              Learn More
            </button>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-card">
            <img src="/grandma.png" alt="RealTalk" className="landing-hero-logo" />
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-header">
          <h2>Powerful Features</h2>
          <p>Everything you need for seamless multilingual communication</p>
        </div>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3>Live, On-Call Translation</h3>
            <p>Real-time speech-to-text translation during live video calls with minimal latency.</p>
          </div>
          {/* <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                <polyline points="17 2 12 7 7 2"></polyline>
              </svg>
            </div>
            <h3>HD Video Quality</h3>
            <p>Crystal-clear video and audio for professional conversations across the globe.</p>
          </div> */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3>Secure & Private</h3>
            <p>End-to-end encryption ensures your conversations remain confidential.</p>
          </div>
          {/* <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h3>Zero Setup</h3>
            <p>No downloads or installations required. Start calling instantly from your browser.</p>
          </div> */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <h3>Live Captions</h3>
            <p>On-screen captions display translations in real-time for easy reading.</p>
          </div>
          {/* <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <h3>Cross-Platform</h3>
            <p>Works seamlessly on desktop, tablet, and mobile devices.</p>
          </div> */}
        </div>
      </section>

      <section className="landing-use-cases">
        <div className="landing-section-header">
          <h2>Perfect For</h2>
          <p>Empowering communication across industries and borders</p>
        </div>
        <div className="landing-use-cases-grid">
          <div className="landing-use-case">
            <div className="landing-use-case-number">01</div>
            <h3>International Business</h3>
            <p>Conduct meetings with global partners without language barriers. Close deals faster with real-time translation.</p>
          </div>
          <div className="landing-use-case">
            <div className="landing-use-case-number">02</div>
            <h3>Remote Education</h3>
            <p>Connect students and teachers worldwide. Make learning accessible regardless of native language.</p>
          </div>
          <div className="landing-use-case">
            <div className="landing-use-case-number">03</div>
            <h3>Healthcare Consultations</h3>
            <p>Enable doctors to communicate with international patients clearly and accurately.</p>
          </div>
          <div className="landing-use-case">
            <div className="landing-use-case-number">04</div>
            <h3>Family & Friends</h3>
            <p>Stay connected with loved ones abroad. Share moments without language getting in the way.</p>
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="landing-cta-content">
          <h2>Ready to Connect?</h2>
          <p>Start your first call in seconds. No sign-up required.</p>
          <button className="landing-cta-primary" onClick={() => navigate('/join')}>
            Get Started Now
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-logo">
            <img src="/logo.svg" alt="RealTalk Logo" />
            <span><strong>REAL</strong>TALK</span>
          </div>
          <p className="landing-footer-text">Breaking language barriers, one call at a time.</p>
        </div>
      </footer>
    </div>
  );
}

function VoiceSetupModal({ onComplete, onCancel, defaultVoiceGender, setDefaultVoiceGender }) {
  const [step, setStep] = useState('choice'); // 'choice', 'recording', 'processing'

  const handleChoice = (custom) => {
    if (custom) {
      setStep('recording');
    } else {
      setStep('default');
    }
  };

  const handleRecordingComplete = async (voiceId) => {
    onComplete(voiceId);
  };

  const handleDefaultVoiceSelected = () => {
    onComplete(null); // Use default voice (voiceGender)
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {step === 'choice' && (
          <div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Voice Setup</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Choose how your partner will hear your translated speech
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => handleChoice(false)}
                style={{
                  padding: '20px',
                  border: '2px solid var(--accent-primary)',
                  borderRadius: '12px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--accent-light)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--bg-primary)'}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎤</div>
                <div>Default Voice</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Use a pre-made voice (masculine or feminine)
                </div>
              </button>

              <button
                onClick={() => handleChoice(true)}
                style={{
                  padding: '20px',
                  border: '2px solid var(--accent-primary)',
                  borderRadius: '12px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--accent-light)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--bg-primary)'}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✨</div>
                <div>Custom Voice Clone</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Record your voice for a personalized experience
                </div>
              </button>
            </div>

            <button
              onClick={onCancel}
              style={{
                marginTop: '24px',
                padding: '12px',
                width: '100%',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'default' && (
          <div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Select Default Voice</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Choose the voice type for your partner's translated speech
            </p>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={() => setDefaultVoiceGender("feminine")}
                style={{
                  flex: 1,
                  padding: '16px',
                  border: `2px solid ${defaultVoiceGender === "feminine" ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  background: defaultVoiceGender === "feminine" ? 'var(--accent-light)' : 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500
                }}
              >
                Feminine Voice
              </button>
              <button
                onClick={() => setDefaultVoiceGender("masculine")}
                style={{
                  flex: 1,
                  padding: '16px',
                  border: `2px solid ${defaultVoiceGender === "masculine" ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  background: defaultVoiceGender === "masculine" ? 'var(--accent-light)' : 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500
                }}
              >
                Masculine Voice
              </button>
            </div>

            <button
              onClick={handleDefaultVoiceSelected}
              style={{
                padding: '16px',
                width: '100%',
                border: 'none',
                borderRadius: '8px',
                background: 'var(--accent-primary)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Continue
            </button>

            <button
              onClick={() => setStep('choice')}
              style={{
                marginTop: '12px',
                padding: '12px',
                width: '100%',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Back
            </button>
          </div>
        )}

        {step === 'recording' && (
          <VoiceRecorder 
            onComplete={handleRecordingComplete}
            onBack={() => setStep('choice')}
          />
        )}
      </div>
    </div>
  );
}

function VoiceRecorder({ onComplete, onBack }) {
  const [currentSentence, setCurrentSentence] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const sentences = [
    "Hello, my name is speaking to you in my natural voice.",
    "I'm excited to use this technology for real-time translation.",
    "This voice clone will help my conversation partner understand me better."
  ];

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordings(prev => [...prev, audioBlob]);
        
        if (currentSentence < sentences.length - 1) {
          setCurrentSentence(prev => prev + 1);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError("Failed to access microphone. Please grant permission.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const createVoiceClone = async () => {
    setIsProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('name', `Voice_${Date.now()}`);
      
      recordings.forEach((blob, index) => {
        formData.append(`sample_${index}`, blob, `sample_${index}.webm`);
      });

      const response = await fetch('http://localhost:4000/create_voice_clone', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create voice clone');
      }

      const data = await response.json();
      onComplete(data.voice_id);
    } catch (err) {
      setError(err.message || 'Failed to create voice clone');
      setIsProcessing(false);
    }
  };

  const allRecorded = recordings.length === sentences.length;

  return (
    <div>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Record Your Voice</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
        Record yourself reading these {sentences.length} sentences. Speak clearly and naturally.
      </p>

      <div style={{ marginBottom: '24px' }}>
        <div style={{
          background: 'var(--bg-primary)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '16px',
          border: '2px solid var(--accent-primary)'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-secondary)', 
            marginBottom: '8px',
            fontWeight: 600
          }}>
            SENTENCE {currentSentence + 1} OF {sentences.length}
          </div>
          <div style={{ 
            fontSize: '18px', 
            color: 'var(--text-primary)', 
            lineHeight: '1.6'
          }}>
            "{sentences[currentSentence]}"
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          {sentences.map((_, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: '8px',
                borderRadius: '4px',
                background: recordings[index] ? 'var(--accent-primary)' : 'var(--border-color)',
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>

        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={allRecorded}
            style={{
              padding: '16px',
              width: '100%',
              border: 'none',
              borderRadius: '8px',
              background: allRecorded ? 'var(--border-color)' : 'var(--accent-primary)',
              color: 'white',
              cursor: allRecorded ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            {recordings[currentSentence] ? 'Re-record' : 'Start Recording'}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: '16px',
              width: '100%',
              border: 'none',
              borderRadius: '8px',
              background: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              animation: 'pulse 2s infinite'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
            Stop Recording
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {allRecorded && (
        <button
          onClick={createVoiceClone}
          disabled={isProcessing}
          style={{
            padding: '16px',
            width: '100%',
            border: 'none',
            borderRadius: '8px',
            background: isProcessing ? 'var(--border-color)' : '#10b981',
            color: 'white',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '12px'
          }}
        >
          {isProcessing ? 'Creating Voice Clone...' : 'Create Voice Clone'}
        </button>
      )}

      <button
        onClick={onBack}
        disabled={isProcessing}
        style={{
          padding: '12px',
          width: '100%',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }}
      >
        Back
      </button>
    </div>
  );
}

function JoinPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [voiceGender, setVoiceGender] = useState("feminine");
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'create' or 'join'
  const { theme, toggleTheme } = useContext(ThemeContext);

  const handleCreateOrJoin = (action) => {
    setPendingAction(action);
    setShowVoiceSetup(true);
  };

  const handleVoiceSetupComplete = (voiceId = null) => {
    setShowVoiceSetup(false);
    const voiceParam = voiceId || voiceGender;
    
    if (pendingAction === 'create') {
      const id = Math.random().toString(36).substring(2, 9);
      navigate(`/call/${id}?voice=${voiceParam}`);
    } else if (pendingAction === 'join' && roomId.trim()) {
      navigate(`/call/${roomId.trim()}?voice=${voiceParam}`);
    }
  };

  const createNewRoom = () => handleCreateOrJoin('create');

  const joinRoom = () => {
    if (roomId.trim()) {
      handleCreateOrJoin('join');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && roomId.trim()) {
      joinRoom();
    }
  };

  return (
    <div className="home-page">
      {showVoiceSetup && (
        <VoiceSetupModal 
          onComplete={handleVoiceSetupComplete}
          onCancel={() => setShowVoiceSetup(false)}
          defaultVoiceGender={voiceGender}
          setDefaultVoiceGender={setVoiceGender}
        />
      )}
      
      <div className="home-container">
        <div className="home-header">
          <div className="home-logo">
            <img src="/logo.svg" alt="Logo" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = 'RT'; }} />
          </div>
          <h1><strong>REAL</strong>TALK</h1>
          <p>Real-time video calls with live translation</p>
        </div>

        <div className="home-card">
          <h2>Join or Create a Room</h2>

          <div className="home-input-group">
            <input
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="home-input"
            />
            <button onClick={joinRoom} disabled={!roomId.trim()} className="home-button primary">
              Join Room
            </button>
          </div>
          <div className="home-divider">
            <span>or</span>
          </div>
          <button onClick={createNewRoom} className="home-button secondary">
            Create New Room
          </button>
        </div>

        <button className="theme-toggle-home" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
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
  );
}

function CallPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const voiceGender = searchParams.get("voice") || "feminine";
  return <VideoRoom roomId={roomId} voiceGender={voiceGender} />;
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/call/:roomId" element={<CallPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}
