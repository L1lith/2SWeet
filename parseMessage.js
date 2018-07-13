function parseMessage(message, inDirection) {
  if (typeof inDirection != 'boolean') throw new Error('InDirection must be a boolean')
  if (inDirection) {
    try {
      message = JSON.parse(message)
    } catch(error) {
      return null
    }
    if (message.SWHellMessage !== true) return true
    delete message.SWHellMessage
    return message
  } else {
    if (typeof message === 'string') message = {type: 'message', body: message}
    message.SWHellMessage = true
    return JSON.stringify(message)
  }
}

module.exports = parseMessage
