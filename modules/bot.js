const request = require('./habiticaRequest.js');

class Bot {
  queue = [];
  constructor(challenges, credentials) {
    // Must be passed a ChallengeSet class.
    if (!(challenges instanceof (require('./challengeSet.js')))) throw new Error('Pass a ChallengeSet.');
    // Set variables
    this.challenges = challenges;
    this.credentials = credentials;
  }
  // Manages the task queue
  async #runQueue() {
    // While there are still tasks to complete
    while (this.queue.length) {
      // Remove the first item from the queue and perform it
      await this.queue.shift()();
    }
  }
  // Updates all the member stats, including task completion history
  async updateMembers() {
    // Runs recursively until the entire member list is fetched
    async function addToMemberCount(challenge, lastId) {
      // Request the next (or first) set of members
      const result = await request(
        `/challenges/${challenge.id}/members${lastId ? `?lastId=${lastId}` : ''}`,
        'get',
        {},
        this.credentials
      );

      if (result.success) {
        // Add the received members to the member list
        challenge.members = challenge.members.concat(result.data);
        // If the full maximum thirty members are returned, there's probably more in the list
        if (result.data.length === 30) {
          // Add another call of this funciton (with an updated lastId) to the beginning of the queue
          this.queue.splice(0, 0, addToMemberCount.bind(this, challenge, result.data.slice(-1)[0].id));
        }
      } else { // There was a problem
        if (result.status === 429) { // HTTP 429 means rate limiting
          console.info('Rate limited. Trying again in 60 seconds.');
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => {
                console.info('Continuing...');
                resolve("done!");
              }, 60000)
            });

            await promise;

            await addToMemberCount.bind(this, challenge, lastId)
          });
        } else {
          console.error(challenge, lastId.length);
          throw new Error(JSON.stringify(result));
        }
      }
    }
    async function fetchMemberStats(member, challenge) {
      const result = await request(
        `/challenges/${challenge.id}/members/${member.id}`,
        'get',
        {},
        this.credentials
      );

      if (result.success) {
        member.stats = result.data;
      } else {
        if (result.status === 429) {
          console.info('Rate limited. Trying again in 60 seconds.');
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => {
                console.info('Continuing...');
                resolve("done!");
              }, 60000)
            });

            await promise;

            await fetchMemberStats.bind(this, member, challenge);
          });
        } else {
          throw new Error(result);
        }
      }
    }

    for (let challenge of this.challenges.list) {
      if (challenge.altReport) continue;

      // Get challenge members
      challenge.members = [];
      this.queue.push(addToMemberCount.bind(this, challenge, ''));

      // For each member, fetch challenge stats
      this.queue.push((() => {
        for (const member of challenge.members) {
          this.queue.splice(0, 0, fetchMemberStats.bind(this, member, challenge));
        }
      }).bind(this));

      // Map each member to be the stats
      this.queue.push(() => {
        challenge.members = challenge.members.map(m => {
          return m.stats;
        });
      });
    }

    // Run the queue
    await this.#runQueue();
  }

  // Calculate the stats from the already-fetdched member list
  updateStats() {
    // Initialize variables
    let dataTask = null;

    // Every challenge without an altReport
    for (let challenge of this.challenges.list.filter(c => typeof c.altReport === 'undefined')) {
      // Reset the status
      challenge.status = {
        health: challenge.maxHealth,
        power: 0
      }
      // Every member with valid stats
      for (let member of challenge.members.filter(m => typeof m !== 'undefined')) {
        // Every task in the list
        for (let task of challenge.tasks) {
          // Set the version of the task from the member stats
          dataTask = member.tasks.find(t => t.text === task.name);
          switch (dataTask.type) { // Different tasks store positive/negative clicks in different ways
            case 'todo':
              // If it's completed, the task is positive
              if (dataTask.completed) {
                challenge.status.health += task.positive;
              }
              break;
            case 'habit':
            case 'daily':
              // With habits and dailies, the change in value is tracked over time
              const value = 0;
              dataTask.history.map(h => {
                if (value === h.value) return 0;
                if (value > h.value) {
                  challenge.status.health += task.negative;
                  challenge.status.power++;
                  return -1;
                } else {
                  challenge.status.health += task.positive;
                  return 1;
                }
              });
              break;
            default:
              console.warn(dataTask.type + ' is not a supported task type.');
              break;
          }
        }
      }

      // Check how many attacks should be factored in
      const numAttacks = Math.floor(challenge.status.power / challenge.maxPower);
      challenge.status.power = challenge.status.power % challenge.maxPower;

      // For each attack
      for (let a = 0; a < numAttacks; a++) {
        // Perform the next attack
        challenge.status.health += challenge.attacks[a % challenge.attacks.length].bonus;
      }

      // Update the report
      challenge.report = `## [${challenge.name}](https://habitica.com/challenges/${challenge.id})

Health: ${challenge.status.health}/${challenge.maxHealth}
Power: ${challenge.status.power}/${challenge.maxPower}`;

      if (numAttacks) {
        challenge.report += `\n\nLast attack: \`${challenge.attacks[numAttacks % challenge.attacks.length].message}\``
      }
    }
    console.log(
      '## Challenge Statuses\n\n' +
      this.challenges.list.map(c => c.report).join('\n\n')
    );
  }
}

module.exports = Bot;
