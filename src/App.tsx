import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from './lib/app'
import { Layout } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import Home from './pages/Home'
import NewPolicy from './pages/NewPolicy'
import PolicyPage from './pages/PolicyPage'
import Me from './pages/Me'
import Guide from './pages/Guide'
import Docs from './pages/Docs'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/new" element={<NewPolicy />} />
              <Route path="/p/:id" element={<PolicyPage />} />
              <Route path="/me" element={<Me />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
