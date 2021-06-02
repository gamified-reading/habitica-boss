const Ajv = require('ajv');
const ajv = new Ajv();

const validChallenge = ajv.compile(require('../schema/challenge.json'));

class Boss {
  constructor(challenge) {
    if (challenge.altReport && typeof challenge.altReport === 'string') true;
    else if (!validChallenge(challenge)) throw new Error(challenge.name + ' is not a valid challenge.');
    this.name = challenge.name;
    this.challengeId = challenge.challengeId;
    if (challenge.altReport) this.altReport = challenge.altReport;
    this.maxPower = challenge.maxPower;
    this.maxHealth = challenge.maxHealth;
    this.status = {
      health: this.maxHealth,
      power: 0
    }
    this.members = [];
    // Attacks and tasks need their own classes
  }
  updateMembers(members) {
    this.members = members;
  }
}

module.exports = Boss;
