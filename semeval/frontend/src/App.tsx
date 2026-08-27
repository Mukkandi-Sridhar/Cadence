import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SessionSetup from './routes/SessionSetup'
import LiveRecording from './routes/LiveRecording'
import Evaluating from './routes/Evaluating'
import Results from './routes/Results'
import SessionDashboard from './routes/SessionDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/sessions/new" replace />} />
        <Route path="/sessions/new" element={<SessionSetup />} />
        <Route path="/sessions/:sessionId/record" element={<LiveRecording />} />
        <Route path="/sessions/:sessionId/evaluating" element={<Evaluating />} />
        <Route path="/sessions/:sessionId/results/:presenterId" element={<Results />} />
        <Route path="/sessions/:sessionId/dashboard" element={<SessionDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
