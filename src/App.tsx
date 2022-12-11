import './App.scss'
import ForceGraph3D from 'react-force-graph-3d'
import { useEffect, useRef, useState } from 'react'
import { APP_ID, network } from './network'
import { Message } from '@browser-network/network'
import { Connection } from '@browser-network/network/dist/src/Connection'

const sendConnectionInfoMessage = () => {
  network.broadcast({
    type: 'connection-info',
    appId: APP_ID,
    data: {
      address: network.address,
      activeConnections: network.activeConnections.reduce((ac, con) => {
        ac[con.address] = true
        return ac
      }, {} as { [address: string]: true }),
    }
  })
}

type InitialGraphData = {
  nodes: { id: string }[]
  links: {
    source: string,
    target: string
  }[]
}

type ProcessedGraphData = {
  nodes: { id: string }[]
  links: {
    source: { id: string },
    target: { id: string }
  }[]
}

// See the problem is the graph library requires a shape like InitialGraphData
// but then mutates the objects into ProcessedGraphData and then to reference them
// for link particles requires direct references to those processed ones.
type GraphData = InitialGraphData | ProcessedGraphData

type StoredGraphData = {
  [address: string]: {
    [address: string]: true
  }
}

const transformStoredGraphData = (storedGraphData: StoredGraphData): InitialGraphData => {
  const graphData: InitialGraphData = { nodes: [], links: [] }

  for (const address in storedGraphData) {
    graphData.nodes.push({ id: address })
    for (const addy in storedGraphData[address]) {

      // We don't want to have any links that we don't have in our nodes,
      // otherwise we'll get fat errors in the console and it won't render anyways.
      if (addy in storedGraphData) {
        graphData.links.push({
          source: address,
          target: addy
        })
      }
    }
  }

  return graphData
}

function App() {

  const [shouldDraw, setShouldDraw] = useState(false)
  const [storedGraphData, setStoredGraphData] = useState<StoredGraphData>({})
  const fgRef = useRef<any>()
  const sendConInfoTimerRef = useRef<NodeJS.Timer>()

  // @ts-ignore
  window.toggleDraw = () => setShouldDraw(!shouldDraw)

  const graphData = transformStoredGraphData(storedGraphData)

  const handleMessage = (message: Message) => {

    // Emit them message particles
    (graphData as unknown as ProcessedGraphData).links.forEach(link => {
      const shouldSend =  (
        [link.source.id, link.source].includes(message.address)
      )

      if (shouldSend) { fgRef.current?.emitParticle(link) }
    })

    if (message.appId !== APP_ID) { return }

    // Update the graph itself
    if (message.type === 'connection-info') {
      const extentData = storedGraphData[message.data.address]

      // If we already have this node and there hasn't been any connection changes let's not trigger
      // a rerender
      if (extentData && Object.keys(extentData).length === Object.keys(message.data.activeConnections).length) { return }

      setStoredGraphData({ ...storedGraphData, ...{ [message.data.address]: message.data.activeConnections } })
    }
  }

  const handleDestroyConnection = ((connection: Connection) => {
    const update = { ...storedGraphData }

    // get rid of the top level address
    delete update[connection.address]

    for (const address in update) {
      delete update[address][connection.address]
    }

    setStoredGraphData(update)
  })

  useEffect(() => {
    // handle other people's updates
    network.on('message', handleMessage)
    // handle our own updates
    network.on('broadcast-message', handleMessage)
    network.on('destroy-connection', handleDestroyConnection)

    // Send messages at a rate inversely proportional to the size of the network
    // soas not to destroy bandwidth
    const numNodes = Object.keys(storedGraphData).length
    const interval = (numNodes) * 1000
    sendConInfoTimerRef.current = setInterval(sendConnectionInfoMessage, interval)

    return () => {
      network.removeListener('message', handleMessage)
      network.removeListener('broadcast-message', handleMessage)
      network.removeListener('destroy-connection', handleDestroyConnection)
      window.clearInterval(sendConInfoTimerRef.current!)
    }
  }, [storedGraphData])

  return (
    <div className="App">
      <h3>{network.address}</h3>
      <span>{Object.keys(storedGraphData[network.address] || {}).length} connections</span>
      {shouldDraw && <ForceGraph3D
        graphData={graphData}
        ref={fgRef}
        linkDirectionalParticleColor={() => 'red'}
        linkDirectionalParticleWidth={2}
      />
      }
    </div>
  )
}

export default App
