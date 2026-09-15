import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 20_000 } } })
const router = createBrowserRouter([{ path: '*', element: <App /> }])
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)
