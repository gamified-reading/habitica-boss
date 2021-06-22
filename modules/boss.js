const Ajv = require('ajv');
const ajv = new Ajv();
const Task = require('./task.js');

// Import the schema for valid challenges
const validChallenge = ajv.compile(require('../schema/challenge.json'));

class Boss {
  constructor(challenge) {
    // altReports are exempt from the usual schema
    if (challenge.altReport && typeof challenge.altReport === 'string') true;
    else if (!validChallenge(challenge)) throw new Error(challenge.name + ' is not a valid challenge.');

    // Set variables
    this.name = challenge.name;
    this.id = challenge.id;
    this.maxPower = challenge.maxPower;
    this.maxHealth = challenge.maxHealth;
    this.status = {
      health: this.maxHealth,
      power: 0
    }
    this.members = [];
    this.attacks = challenge.attacks;
    // Tasks get their own class
    if (challenge.tasks) {
      this.tasks = challenge.tasks.map(task => new Task(task));
    }
    // If there's an alt report, go ahead and set the final report
    if (challenge.altReport) this.altReport = challenge.altReport;
    this.report = (challenge.altReport ? `## [${challenge.name}](https://habitica.com/challenges/${challenge.id})\n\n${challenge.altReport}` : '');
  }
}

module.exports = Boss;
