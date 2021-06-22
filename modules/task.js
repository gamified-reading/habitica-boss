const Ajv = require('ajv');
const ajv = new Ajv();

// Import the task schema
const validTask = ajv.compile(require('../schema/task.json'));

class Task {
  constructor(task) {
    // Check with the schema
    if (!validTask(task)) throw new Error(task.name + ' is an invalid task.');

    // Set variables
    this.name = task.name;
    this.positive = task.positive;
    this.negative = task.negative;
  }
}

module.exports = Task;
