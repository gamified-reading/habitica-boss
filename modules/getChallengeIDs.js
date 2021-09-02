const habiticaRequest = require('./habiticaRequest.js');

module.exports = async (challenges, auth) => {
  for (let challenge of challenges) {
    // Replace the id field with the id of the first challenge the owner has created with the given title
    const response = (await habiticaRequest(
      '/challenges/user?page=0&owned=owned&search=' + encodeURIComponent(challenge.title),
      'get',
      {},
      auth
    ));
    if (
      !response.data.length ||
      response.data.find(
        c => c.name.toLowerCase() === challenge.title.toLowerCase()
      ) === undefined
    ) challenge.exists = false;
    else {
      const foundChallenge = response.data.find(
        c => c.name.toLowerCase() === challenge.title.toLowerCase()
      );
      challenge.id = foundChallenge.id;
      challenge.exists = true;
    }
  }

  return challenges.filter(c => c.exists !== false);
}
