const packageJson = require('../package.json')

const fs = require('fs')
const path = require('path')
const send = require('./send')

// Lazy-initialized.
let homebridgeApi, Service, Characteristic

// Called by homebridge.
module.exports = (homebridge) => {
  homebridgeApi = homebridge
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

    // Read settings.
    this.storagePath = path.join(homebridgeApi.user.storagePath(), 'persist', `NasnosCurtain-${config.name}.json`)
    this._position = 100
    try {
      const {position} = JSON.parse(String(fs.readFileSync(this.storagePath)))
      if (position >= 0 && position <= 100)
        this._position = position
    } catch {}

    this._targetPostion = this._position
    this._positionState = STOPPED

    this._interval = null
    this._inProcess = false

    this._service = new Service.WindowCovering(this.name)

    this._service.getCharacteristic(Characteristic.CurrentPosition)
    .on('get', (callback) => callback(null, this._position))

    this._service.getCharacteristic(Characteristic.PositionState)
    .on('get', (callback) => callback(null, this._positionState))

    this._service.getCharacteristic(Characteristic.TargetPosition)
    .on('get', (callback) => callback(null, this._targetPostion))
    .on('set', (pos, callback) => {
      // Do not interrupt currently running call.
      if (this._inProcess) {
        callback(null)
        return
      }
      this._inProcess = true
      this._setTargetPosition(pos, (error) => {
        this._inProcess = false
        callback(error)
      })
    })
  }

  getServices() {
    return [this._service]
  }

  _setPositionState(state) {
    this._positionState = state
    this._service.updateCharacteristic(Characteristic.PositionState, state)
  }

  async _setTargetPosition(pos, callback) {
    // Duplicate calls.
    if (pos === this._targetPostion) {
      callback(null)
      return
    }

    // Right there.
    if (pos === this._position) {
      await this._stop()
      this._writeSettings()
      callback(null)
      return
    }

    // No need to change command if the direction is not changed.
    if ((this._positionState === OPENING && pos > this._targetPostion) ||
        (this._positionState === CLOSING && pos < this._targetPostion)) {
      this._targetPostion = pos
      this._writeSettings()
      callback(null)
      return
    }

    // When changing direction, stop first.
    await this._stop()

    const open = pos > this._position
    try {
      await send(this, open)
      this._targetPostion = pos
      this._writeSettings()
    } catch (e) {
      callback(e)
      return
    }

    this._setPositionState(open ? OPENING : CLOSING)
    this._interval = setInterval(() => {
      if (this._positionState === OPENING)
        this._position += 1
      else if (this._positionState === CLOSING)
        this._position -= 1
      else
        throw new Error('In timer while curtain is stopped')
      this._service.updateCharacteristic(Characteristic.CurrentPosition, this._position)

      if (this._targetPostion === this._position) {
        // When finished, when curtain is fully opened/closed there is nothing
        // to be done, but when curtain is half-opened we have to send a signal
        // to stop curtain.
        if (this._position === 0 || this._position === 100) {
          clearInterval(this._interval)
          this._interval = null
          this._setPositionState(STOPPED)
        } else {
          this._stop()
        }
      }
    }, this.config.period / 100)
    callback(null)
  }

  async _stop() {
    clearInterval(this._interval)
    this._interval = null

    // When curtain is running, sending arbitrary command stops it.
    if (this._positionState !== STOPPED)
      await send(this, true)

    this._targetPostion = this._position
    this._setPositionState(STOPPED)
  }

  _writeSettings() {
    try {
      const settings = JSON.stringify({position: this._targetPostion})
      fs.writeFileSync(this.storagePath, settings)
    } catch (e) {
      this.log(`Failed to write settings: ${e}`)
    }
  }
}
