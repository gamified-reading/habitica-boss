const Boss = require('./boss.js');

class ChallengeSet {
  constructor(challenges) {
    if (!Array.isArray(challenges)) this.#error('You must pass an array of challenges.');
    this.challenges = challenges.map(challenge => new Boss(challenge));
  }
  #error(msg) {
    throw new Error(msg);
  }
  find(name) {
    return this.challenges.find(c => c.name === name);
  }
}

module.exports = ChallengeSet
