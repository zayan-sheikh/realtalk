import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import VideoRoom from "./webrtc/VideoRoom";

function CallPage() {
  const { roomId } = useParams();
  return <VideoRoom roomId={roomId} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/call/:roomId" element={<CallPage />} />
      </Routes>
    </BrowserRouter>
  );
}
