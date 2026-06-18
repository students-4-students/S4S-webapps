import { AuthGuard } from './components/AuthGuard'
import Dashboard from './pages/Dashboard'


export default function App() {
  return (
    <div style={{width:"100%", height:"100%"}}>
      <AuthGuard>
        <Dashboard />
      </AuthGuard>
      <img src='agep.svg'  style={{width:"10vw", position:"absolute", top:10, left:10}}/>
      <img src='s4s-logo.svg'  style={{width:"5vw", position:"absolute", top:0, right:10}}/>
    </div>
  )
}