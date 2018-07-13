function autoBind(instance, exclude=[]) {
  if (!Array.isArray(exclude)) throw new Error('Exclude must be an array')
  const keys = Object.getOwnPropertyNames(instance.__proto__).filter(name => name !== 'constructor' && !exclude.includes(name)).filter(key => typeof instance.__proto__[key] == 'function')
  keys.forEach(prop => instance[prop] = instance.__proto__[prop].bind(instance))
}

module.exports = autoBind
