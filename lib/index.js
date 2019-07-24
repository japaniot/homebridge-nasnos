const net = require('net')
const packageJson = require('../package.json')

// Lazy-initialized.
let Service, Characteristic

// Called by homebridge.
module.exports = (homebridge) => {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic

  // Register the accessory.
  homebridge.registerAccessory(packageJson.name, "NasnosCurtain", NasnosCurtain)
}

// PositionState.
const CLOSING = 0
const OPENING = 1
const STOPPED = 2

class NasnosCurtain {
  constructor(log, config, api) {
    this.log = log
    this.config = config

    this._position = 0
    this._targetPostion = 0
    this._positionState = STOPPED

    this._interval = null

    this._service = new Service.WindowCovering(this.name)

    this._service.getCharacteristic(Characteristic.CurrentPosition)
    .on('get', (callback) => callback(null, this._position))

    this._service.getCharacteristic(Characteristic.PositionState)
    .on('get', (callback) => callback(null, this._positionState))

    this._service.getCharacteristic(Characteristic.TargetPosition)
    .on('get', (callback) => callback(null, this._targetPostion))
    .on('set', this._setTargetPosition.bind(this))
  }

  getServices() {
    return [this._service]
  }

  _setPositionState(state) {
    this._positionState = state
    this._service.updateCharacteristic(Characteristic.PositionState, state)
  }

  async _setTargetPosition(pos, callback) {
    clearInterval(this._interval)
    this._targetPostion = pos

    if (this._targetPostion === this._position) {
      this._setPositionState(STOPPED)
      callback(null)
      return
    }

    try {
      await this._sendCommand(this._positionState)
    } catch (e) {
      callback(e)
      return
    }

    this._setPositionState(this._targetPostion > this._position ? OPENING : CLOSING)
    this._interval = setInterval(() => {
      if (this._positionState === OPENING)
        this._position += 1
      else if (this._positionState === CLOSING)
        this._position -= 1
      else
        throw new Error('In timer while curtain is stopped')
      this._service.updateCharacteristic(Characteristic.CurrentPosition, this._position)

      if (this._targetPostion === this._position) {
        this._setPositionState(STOPPED)
        clearInterval(this._interval)
      }
    }, this.config.period / 100)

    callback(null)
  }

  _sendCommand(mode) {
    return new Promise((resolve, reject) => {
      let command
      if (this.config.index <= 5)
        command = `@CR${this.config.index - 1}${mode === OPENING ? 'OP' : 'CL'}000`
      else
        command = `@LC${this.config.index - 6}${mode === OPENING ? 'UP' : 'DW'}000`

      const client = new net.Socket
      client.connect(8000, this.config.ip, () => {
        client.end(command)
        resolve()
      })
      client.on('error', (e) => {
        this.log(`Error sending command: ${e.message}`)
        reject(e)
      })
    })
  }
}
