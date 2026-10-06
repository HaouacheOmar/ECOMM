import 'bootstrap/dist/css/bootstrap.min.css'
import './theme/theme.css'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { store } from './store.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <MotionConfig reducedMotion="user">
        <HashRouter>
          <App />
        </HashRouter>
      </MotionConfig>
    </Provider>
  </StrictMode>,
)
