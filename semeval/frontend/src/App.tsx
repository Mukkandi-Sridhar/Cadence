import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './routes/HomePage'
import EventDetail from './routes/EventDetail'
import RecordPresentation from './routes/RecordPresentation'
import PresentationResults from './routes/PresentationResults'
import { warmUpBackend } from './lib/warmup'

export default function App() {
  // Start waking the (sleeping) free-tier backend immediately, so the cold
  // start overlaps with the user reading the first screen rather than
  // stalling their first tap.
  useEffect(() => {
    warmUpBackend()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/events/:eventId/presentations/:presId/record" element={<RecordPresentation />} />
        <Route path="/events/:eventId/presentations/:presId/results" element={<PresentationResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
