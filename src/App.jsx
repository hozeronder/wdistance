import './App.css'
import IsochroneMap from './IsochroneMap';
import CircleMap from './CircleMap';

function App() {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: '50%' }}>
        <IsochroneMap />
      </div>
      <div style={{ width: '50%' }}>
        <CircleMap />
      </div>
    </div>
  )
}

export default App
