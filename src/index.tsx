/* @refresh reload */
import { render } from 'solid-js/web'
import './main.css'
import App from './App'

const root = document.getElementById('root')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or change the id of the root element?'
  )
}

render(() => <App />, root!)
