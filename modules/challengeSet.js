const Boss = require('./boss.js');

class ChallengeSet {
  constructor(challenges) {
    if (!Array.isArray(challenges)) throw new Error('You must pass an array of challenges.');
    // Each challenge is stored as an instance of the Boss class
    this.list = challenges.map(challenge => new Boss(challenge));
  }
  find(name) { // I didn't end up using this method, but it's public in case you want it
    return this.challenges.find(c => c.name === name);
  }
}

module.exports = ChallengeSet
