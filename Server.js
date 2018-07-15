const parseMessage = require('./parseMessage')
const autoBind = require('./autoBind')

class TooSWeetServer {
  constructor(controller, listening=true) {
    autoBind(this)
    this.listening = false
    this.controller = controller
    this.clients = {}
    this.heartbeatRate = 1000
    this.listeners = {message: [], connection: [], event: []}
    this.eventListeners = {}
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
          const client = this.clients[clientID]
          if (client) this.disconnect(client, "Heartbeat not recieved")
        }
      })
    }, this.heartbeatRate)
  }
  onMessage(event, warn=true) {
    if (event.source === this.controller) return // Prevent Messaging itself
    const message = parseMessage(event.data, true)
    const replyController = event.source
    if (warn && !replyController) return console.warn('Got message with no source')
    const response = this.__proto__.send.bind(this, replyController)
    if (!message) return response({type: "error", body: "Malformed Message"})
    if (!message.hasOwnProperty('type')) return response({type: "error", body: "Message Type Missing"})
    if (this.eventListeners.hasOwnProperty(message.type)) this.eventListeners[message.type].forEach(listener => listener(message, replyController))
    if (message.type === 'connect') {
      this.registerClient(replyController, response)
    } else if (message.type === 'heartbeat') {
      this.lastHeartbeats[replyController.id] = Date.now()
    } else {
      if (!this.clients.hasOwnProperty(replyController.id)) return response({type: "error", body: "Not Connected"})
      if (message.type === 'message') {
        this.listeners.message.forEach(listener => listener(message.body, replyController))
      } else {
        this.listeners.event.forEach(listener => listener(message, replyController))
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
      controller.send({type: 'connected'})
      this.listeners.connection.forEach(listener => listener(controller, replyController))

      return true
    }
  }
  disconnect(client, reason="Unknown") {
    if (client) this.send(client, {type: "disconnected", body: reason})
    delete this.lastHeartbeats[client.id]
    delete this.clients[client.id]
  }
  on(eventType, callback) {
    if (typeof eventType != 'string' || !this.listeners.hasOwnProperty(eventType)) throw new Error('Invalid Event Type')
    this.listeners[eventType].push(callback)
  }
  onEvent(eventType, callback) {
    if (typeof eventType != 'string' || eventType.length < 1) throw new Error('Invalid Event Type')
    if (!this.eventListeners.hasOwnProperty(eventType)) this.eventListeners[eventType] = []
    this.eventListeners[eventType].push(callback)
  }
}

module.exports = TooSWeetServer
