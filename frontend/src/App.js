import { BrowserRouter, Routes, Route, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { createContext, useState, useEffect, useContext } from "react";
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

function JoinPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [voiceGender, setVoiceGender] = useState("feminine");
  const { theme, toggleTheme } = useContext(ThemeContext);

  const createNewRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    navigate(`/call/${id}?voice=${voiceGender}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/call/${roomId.trim()}?voice=${voiceGender}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && roomId.trim()) {
      joinRoom();
    }
  };

  return (
    <div className="home-page">
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
          
          <div className="home-input-group" style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 500, 
              color: 'var(--text-primary)', 
              marginBottom: '8px', 
              display: 'block' 
            }}>
              Your voice type (what your partner hears)
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setVoiceGender("feminine")}
                className={`home-button ${voiceGender === "feminine" ? "primary" : "secondary"}`}
                style={{ flex: 1 }}
              >
                Feminine Voice
              </button>
              <button
                onClick={() => setVoiceGender("masculine")}
                className={`home-button ${voiceGender === "masculine" ? "primary" : "secondary"}`}
                style={{ flex: 1 }}
              >
                Masculine Voice
              </button>
            </div>
          </div>

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
