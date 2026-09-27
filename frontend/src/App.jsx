import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import AIAssistantPanel from './components/AIAssistantPanel'
import LogDeviationForm from './components/LogDeviationForm'
import DeviationList from './components/DeviationList'

export default function App() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--color-surface-2)',
            color: 'var(--color-fg)',
            border: '1px solid var(--color-border)',
            fontSize: '0.8rem',
            padding: '0.5rem 0.75rem',
          },
          success: {
            iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-surface-2)' },
          },
          error: {
            iconTheme: { primary: 'var(--color-danger)', secondary: 'var(--color-surface-2)' },
          },
        }}
      />

      <Navbar />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8">
        <main className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <LogDeviationForm />
            <AIAssistantPanel />
          </div>
          <DeviationList />
        </main>
      </div>
    </div>
  )
}
