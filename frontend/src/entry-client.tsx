import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydrationBoundary, QueryClientProvider, type DehydratedState } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { createQueryClient } from './queryClient'
import './styles.css'

function initialState(): DehydratedState | undefined {
  const element = document.getElementById('__INITIAL_STATE__')
  if (!element?.textContent) return undefined
  try {
    return JSON.parse(element.textContent) as DehydratedState
  } catch {
    return undefined
  }
}

const client = createQueryClient()
const router = createBrowserRouter([{ path: '*', element: <App /> }])
const root = document.getElementById('root')

if (!root) throw new Error('Root element is missing')

hydrateRoot(root,
  <StrictMode>
    <QueryClientProvider client={client}>
      <HydrationBoundary state={initialState()}>
        <RouterProvider router={router} />
      </HydrationBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
