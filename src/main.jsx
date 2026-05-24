import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Entry point for the Vite React app.
// This file mounts the React `App` component into the DOM element with id "root".
// Keep this file minimal — it only bootstraps the application.
const root = createRoot(document.getElementById('root'))
root.render(<App />)
