const net = require('net')
const Bobolink = require('bobolink')

// Task pool.
const queue = new Bobolink({concurrency: 1})

// Records the last time a command succeeds.
// (index => time)
const lastTime = {}
for (let i = 1; i <= 10; ++i)
  lastTime[i] = 0

module.exports = (curtain, open) => {
  let type, index, cmd
  if (curtain.config.index <= 5) {
    type = 'CR'
    index = curtain.config.index - 1
    cmd = open ? 'OP' : 'CL'
  } else {
    type = 'LC'
    index = curtain.config.index - 6
    cmd = open ? 'UP' : 'DW'
  }
  const command = `@${type}${index}${cmd}000`

  // Only send one message at one time.
  return queue.put(async () => {
    // Must not send commands too often to one curtain.
    if (Date.now() - lastTime[curtain.config.index] < 600)
      await sleep(600)

    await send(curtain, command)
    lastTime[curtain.config.index] = Date.now()
  })
}

async function send(curtain, command) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket
    client.connect(8000, curtain.config.ip, () => {
      client.end(command)
      resolve()
    })
    client.on('error', (e) => {
      curtain.log(`Error sending command: ${e.message}`)
      reject(e)
    })
  })
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
