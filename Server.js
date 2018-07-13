const parseMessage = require('./parseMessage')
const messageSender = require('./messageSender')
const autoBind = require('./autoBind')

class SWoleServer {
  constructor(controller, listening=true) {
    autoBind(this)
    this.listening = false
    this.controller = controller
    this.clients = {}
    this.heartbeatRate = 1000
    this.eventListeners = {message: [], connection: [], event: []}
    this.heartbeatWatcher = null
    this.lastHeartbeats = {}
    this.listen()
  }
  listen() {
    if (this.listening === true) throw new Error('SWHellServer Already Listening')
    this.listening = true
    this.controller.addEventListener('message', this.onMessage)
    this.startHeartbeatWatcher()
  }
  close() {
    if (this.listening !== true) throw new Error('SWHellServer Not Listening')
    this.listening = false
    this.controller.removeEventListener('message', this.onMessage)
    this.stopHeartbeatWatcher()
  }
  send(client, message) {
    if (typeof client == 'string') {
      if (!this.clients.hasOwnProperty(client)) throw new Error('Invalid Client ID')
      client = this.clients[client]
    } else {
      if (typeof client != 'object' || client === null) throw new Error('Invalid Client')
      if (!this.clients.hasOwnProperty(client.id)) return console.warn('Client not connected')
    }
    message = parseMessage(message, false)
    if (!message) throw new Error('Malformed Message')
    //console.log(`Posting Message "${message}" to`, client)
    client.postMessage(message)
  }
  startHeartbeatWatcher() {
    if (this.heartbeatWatcher !== null) throw new Error('Heartbeat Watcher Already Running')
    this.heartbeatWatcher = this.createHeartbeatWatcher()
  }
  stopHeartbeatWatcher() {
    if (this.heartbeatWatcher === null) throw new Error('Heartbeat Watcher Not Running')
    clearInterval(this.heartbeatWatcher)
  }
  createHeartbeatWatcher() {
    return setInterval(()=>{
      const now = Date.now()
      Object.entries(this.lastHeartbeats).forEach(([clientID, lastBeat])=>{
        const difference = now - lastBeat
        if (difference > this.heartbeatRate) {
          this.disconnect(this.clients[clientID], "Heartbeat not recieved")
        }
      })
    }, this.heartbeatRate)
  }
  onMessage(event) {
    const message = parseMessage(event.data, true)
    const replyController = event.source
    if (!replyController) return console.warn('Got message with no source')
    const response = messageSender(replyController)
    if (!message) return response({type: "error", body: "Malformed Message"})
    if (!message.hasOwnProperty('type')) return response({type: "error", body: "Message Type Missing"})
    if (message.type === 'connect') {
      this.registerClient(replyController, response)
    } else if (message.type === 'heartbeat') {
      this.lastHeartbeats[replyController.id] = Date.now()
    } else {
      if (!this.clients.hasOwnProperty(replyController.id)) return response({type: "error", body: "Not Connected"})
      if (message.type === 'message') {
        this.eventListeners.message.forEach(listener => listener(message.body, replyController))
      } else {
        this.eventListeners.event.forEach(listener => listener(message, replyController))
      }
    }
  }
  registerClient(controller, response) {
    if (this.clients.hasOwnProperty(controller.id)) {
      this.disconnect(controller, "Already Connected!")
      return false
    } else {
      this.clients[controller.id] = controller
      this.lastHeartbeats[controller.id] = Date.now()
      controller.send = this.__proto__.send.bind(this, controller)
      this.eventListeners.connection.forEach(listener => listener(controller))
      controller.send({type: 'connected'})

      return true
    }
  }
  disconnect(client, reason="Unknown") {
    this.send(client, {type: "disconnected", body: reason})
    delete this.lastHeartbeats[client.id]
    delete this.clients[client.id]
  }
  on(eventType, callback) {
    if (typeof eventType != 'string' || !this.eventListeners.hasOwnProperty(eventType)) throw new Error('Invalid Event Type')
    this.eventListeners[eventType].push(callback)
  }
}

module.exports = SWoleServer
