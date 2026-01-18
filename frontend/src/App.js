import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { createContext, useState, useEffect, useContext } from "react";
import VideoRoom from "./webrtc/VideoRoom";
import "./App.css";

export const ThemeContext = createContext();

function HomePage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const { theme, toggleTheme } = useContext(ThemeContext);

  const createNewRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    navigate(`/call/${id}`);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      navigate(`/call/${roomId.trim()}`);
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
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </div>
  );
}

function CallPage() {
  const { roomId } = useParams();
  return <VideoRoom roomId={roomId} />;
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
          <Route path="/" element={<HomePage />} />
          <Route path="/call/:roomId" element={<CallPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}
