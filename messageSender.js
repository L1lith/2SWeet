const parseMessage = require('./parseMessage')

function messageSender(controller) {
  return (message, onReply, timeout=3000) => {
    if (typeof onReply == 'function') {
      const messageChannel = new MessageChannel()
      let timedOut = false
      let replied = false
      if (timeout > 0) {
        setTimeout(()=>{
          timedOut = true
          if (replied === false) {
            onReply(new Error('Reply Timed Out'), null)
          }
        }, timeout)
      }
      messageChannel.port1.onmessage = event => {
        if (timedOut === true) return
        if (replied === false) {
          replied = true
        } else {
          return
        }
        if (typeof event.data == 'object' && event.data !== nul && event.data.error) {
          onReply(event.data.error, null, null)
        } else {
          const data = parseMessage(event.data, false)
          if (data) {
            onReply(null, data, event)
          } else {
            onReply(new Error('Response Data Invalid'), null, null)
          }
        }
      }
      controller.postMessage(parseMessage(message, false), [messageChannel.port2])
    } else {
      controller.postMessage(parseMessage(message, false))
    }
  }
}

module.exports = messageSender
