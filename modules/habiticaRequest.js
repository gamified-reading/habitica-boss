const Habitica = require('habitica');
const api = new Habitica();

async function habiticaRequest(path, method, payload, credentials) {
  // Each request needs its own credentials, because some applications may want to have a bot separate from the main account challenges are run with
  api.setOptions(credentials);

  // GET requests are easy
  if (method.toLowerCase() === 'get') {
    try {
      return await api.get(path);
    } catch(err) {
      return err;
    }
  }

  // I need to add the others-- I haven't had a case yet where I need them, but I will once I start applying the bot practically
}

module.exports = habiticaRequest;
