import type Network from '@browser-network/network'
import type { generateSecret as GenerateSecret } from '@browser-network/crypto'

const Net = require('@browser-network/network/umd/network').default as typeof Network
const { generateSecret } = require('@browser-network/crypto/umd/crypto') as { generateSecret: typeof GenerateSecret }

export const network = new Net({
  secret: generateSecret(),
  networkId: 'topology-net-ygai3r8ywfoih',
  switchAddress: 'https://switchboard.aaronik.com'
  // switchAddress: 'http://localhost:5678'
})

// @ts-ignore
window.network = network

// network.on('connection-process', message => console.log(`${(new Date()).toLocaleTimeString()}: ${message}`))

window.addEventListener('beforeunload', () => {
  network.teardown()
})

export const APP_ID = 'topology-net'
