import './App.scss'
import ForceGraph3D from 'react-force-graph-3d'
import { useEffect, useState } from 'react'
import { APP_ID, network } from './network'
import { Message } from '@browser-network/network'
import { Connection } from '@browser-network/network/dist/src/Connection'

setInterval(() => {
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
}, 500)

type GraphData = {
  nodes: { id: string }[]
  links: { source: string, target: string }[]
}

type StoredGraphData = {
  [address: string]: {
    [address: string]: true
  }
}

const transformStoredGraphData = (storedGraphData: StoredGraphData): GraphData => {
  const graphData: GraphData = { nodes: [], links: [] }

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

  const [storedGraphData, setStoredGraphData] = useState<StoredGraphData>({})

  const handleMessage = (message: Message) => {
    if (message.appId !== APP_ID) { return }

    if (message.type === 'connection-info') {
      const extentData = storedGraphData[message.data.address]

      // If we already have this node and there hasn't been any connection changes let's not trigger
      // a rerender
      if (extentData && Object.keys(extentData).length === Object.keys(message.data.activeConnections).length) { return }

      setStoredGraphData({ ...storedGraphData, ...{ [message.data.address]: message.data.activeConnections } })
    }
  }

  const handleDestroyConnection = ((connection: Connection) => {
    console.log('handleDestroyConnection, con:', connection)

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

    return () => {
      network.removeListener('message', handleMessage)
      network.removeListener('broadcast-message', handleMessage)
      network.removeListener('destroy-connection', handleDestroyConnection)
    }
  }, [storedGraphData])

  console.log("storedGraphData:", storedGraphData)

  const graphData = transformStoredGraphData(storedGraphData)

  console.log("graphData:", graphData)

  return (
    <div className="App">
      <h3>{network.address}</h3>
      <span>{Object.keys(storedGraphData[network.address] || {}).length} connections</span>
      <ForceGraph3D
        graphData={graphData}
      />
    </div>
  )
}

export default App
