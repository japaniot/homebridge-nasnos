const net = require('net')

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
