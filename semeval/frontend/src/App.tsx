import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './routes/HomePage'
import EventDetail from './routes/EventDetail'
import RecordPresentation from './routes/RecordPresentation'
import PresentationResults from './routes/PresentationResults'

export default function App() {
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
