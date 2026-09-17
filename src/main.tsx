import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AgencyPortal } from './AgencyPortal'
import { RiderPortal } from './RiderPortal'
import './styles.css'

const App = import.meta.env.VITE_APP_MODE === 'agency' ? AgencyPortal : RiderPortal

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
