const Habitica = require('habitica');
const api = new Habitica();

async function habiticaRequest(path, method, payload, credentials) {
  api.setOptions(credentials);
  if (method.toLowerCase() === 'get') {
    try {
      return await api.get(path);
    } catch(err) {
      return err;
    }
  }
}

module.exports = habiticaRequest;
