const Habitica = require('habitica');
const api = new Habitica();

async function habiticaRequest(path, method, payload, credentials) {
  // Each request needs its own credentials, because some applications may want to have a bot separate from the main account challenges are run with
  api.setOptions(credentials);

  try {
    switch (method.toLowerCase()) {
      case 'get':
        // GET requests are easy
        return await api.get(path);
        break;
      case 'post':
        return await api.post(path, payload)
        break;
      case 'put':
        return await api.post(path, payload)
        break;
      case 'delete':
        return await api.post(path, payload)
        break;
    }
  } catch(err) {
    return err;
  }
}

module.exports = habiticaRequest;
