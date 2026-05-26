import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Analytics } from '@vercel/analytics/react'

// Entry point for the Vite React app.
// This file mounts the React `App` component into the DOM element with id "root".
// We also render Vercel Analytics (requires installing `@vercel/analytics`).
const root = createRoot(document.getElementById('root'))
root.render(
	<>
		<App />
		<Analytics />
	</>
)
