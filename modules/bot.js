const request = require('./habiticaRequest.js');
const cron = require('node-cron');
const ProgressBar = require('progress');
let bar = null;

// HTTP reqeuests
const https = require('https');

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
    const startTime = Date.now();
    let tempChallenges = this.challenges.list.map(original =>
      Object.assign(
        Object.create(
          Object.getPrototypeOf(original)
        ),
        original
      )
    );
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
          const options = {
            method: 'HEAD',
            host: 'habitica.com',
            port: 443,
            path: '/api/v3/user',
            headers: {
              'x-api-user': this.credentials.id,
              'x-api-key': this.credentials.apiToken
            }
          };
          let timeToWait = 0;
          let requesting = new Promise((resolveRequest, rejectMain) => {
            const req = https.request(options, function(res) {
              timeToWait = (new Date(res.headers['x-ratelimit-reset'])) - Date.now() + 1000;
              resolveRequest(true);
            });
            req.end();
          });
          await requesting;
          console.info('Rate limited. Trying again in ' + Math.round(timeToWait / 1000) + ' seconds.');
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => {
                console.info('Continuing...');
                resolve("done!");
              }, timeToWait)
            });

            await promise;

            await addToMemberCount.bind(this, challenge, lastId)();
          });
        } else {
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
        bar.tick();
      } else {
        if (result.status === 429) {
          const options = {
            method: 'HEAD',
            host: 'habitica.com',
            port: 443,
            path: '/api/v3/user',
            headers: {
              'x-api-user': this.credentials.id,
              'x-api-key': this.credentials.apiToken
            }
          };
          let timeToWait = 0;
          let requesting = new Promise((resolveRequest, rejectMain) => {
            const req = https.request(options, function(res) {
              timeToWait = (new Date(res.headers['x-ratelimit-reset'])) - Date.now() + 1000;
              resolveRequest(true);
            });
            req.end();
          });
          await requesting;
          try{
            bar.interrupt('Rate limited. Trying again in ' + Math.round(timeToWait / 1000) + ' seconds.');
          } catch(err) {
            console.warn('Rate limited. Trying again in ' + Math.round(timeToWait / 1000) + ' seconds.');
          }
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  bar.interrupt('Continuing...');
                } catch(err) {
                  console.info('Continuing...');
                }
                resolve("done!");
              }, timeToWait)
            });

            await promise;

            await fetchMemberStats.bind(this, member, challenge)();
          });
        } else {
          console.error(result);
          console.info(`Retrying user "${member.auth.local.username}"`);

          this.queue.splice(0, 0, async () => {
            await fetchMemberStats.bind(this, member, challenge)();
          });
        }
      }
    }
    console.info('Getting member counts...');
    for (let challenge of tempChallenges) {
      if (challenge.altReport) continue;

      // Get challenge members
      challenge.members = [];
      this.queue.push(addToMemberCount.bind(this, challenge, ''));

      // For each member, fetch challenge stats
      this.queue.push((() => {
        console.info('Getting member info for ' + challenge.name + '...');
        bar = new ProgressBar(':bar', {total: challenge.members.length});
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

    this.challenges.list = tempChallenges;

    console.info('All stats fetched. Elapsed time: ' + (Math.floor((Date.now() - startTime) / 10) / 100) + 's');
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
        // Personal stats
        member.personal = {
          positive: 0,
          negative: 0,
          health: 0,
          power: 0
        }

        // Every task in the list
        for (let task of challenge.tasks) {
          // Set the version of the task from the member stats
          dataTask = member.tasks.find(t => t.text === task.name);
          switch (dataTask.type) { // Different tasks store positive/negative clicks in different ways
            case 'todo':
              // If it's completed, the task is positive
              if (dataTask.completed) {
                member.personal.positive++;
                member.personal.health += task.positive;
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
                  member.personal.negative++;
                  member.personal.health += task.negative;
                  member.personal.power++;
                  challenge.status.health += task.negative;
                  challenge.status.power++;
                  return -1;
                } else {
                  member.personal.positive++;
                  member.personal.health += task.positive;
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
      challenge.report = `### [${challenge.name}](https://habitica.com/challenges/${challenge.id})

Health: ${challenge.status.health}/${challenge.maxHealth}
Power: ${challenge.status.power}/${challenge.maxPower}`;

      // If monster is defeated...
      if (challenge.status.health < 0) {
        challenge.report = `### [${challenge.name}](https://habitica.com/challenges/${challenge.id})\n\n${challenge.name} has been defeated. `;
      }

      if (numAttacks) {
        challenge.report += `\n\nLast attack: \`${challenge.attacks[numAttacks % challenge.attacks.length].message}\``
      }
    }
  }

  // Send the already-generated reports to a specified guild chat
  async sendReport(guildId, prepend = '', append = '') {
    async function makeRequest(guildId, report) {
      const result = await request(
        `/groups/${guildId}/chat`,
        'post',
        {
          message: compiledReport
        },
        this.credentials
      );

      if (result.success) {
        console.info('Message sent!');
      } else { // There was a problem
        if (result.status === 429) { // HTTP 429 means rate limiting
          try {
            bar.interrupt('Rate limited. Trying again in 60 seconds.');
          } catch(err) {
            console.warn('Rate limited. Trying again in 60 seconds.');
          }
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  bar.interrupt('Continuing...');
                } catch(err) {
                  console.info('Continuing...');
                }
                resolve("done!");
              }, 60000)
            });

            await promise;

            await this.bind(this, guildId, report)
          });
        } else {
          throw new Error(JSON.stringify(result));
        }
      }
    }

    let compiledReport = prepend + `\n\n` + this.challenges.list.map(c => c.report).join('\n\n');

    if (append.length) compiledReport += '\n\n---\n\n' + append;

    this.queue.push(makeRequest.bind(this, guildId, compiledReport))

    await this.#runQueue();
  }

  chooseRaffleWinners(challengeId, n = 1) {
    const challenge = this.challenges.list.find(c => c.id === challengeId);
    if (challenge === undefined) throw new Error('Could not find challenge ' + challengeId);

    if (n > challenge.members.length) throw new Error(
      `Cannot choose ${n} winners out of ${challenge.members.length} total members.`
    );

    // Create raffle
    let tickets = [];
    for (var member of challenge.members) {
      tickets.push(...
        ' '
          .repeat(
            Math.max(
              (member.personal.positive - member.personal.negative), 1
            )
          )
          .split('') // Create an empty array item for each ticket
          .map(m => member.auth.local.username) // Set the value of each item to the member's username
      );
    }

    // Pick winners
    let winners = [];
    while (winners.length < n) {
      const chosen = tickets[Math.floor(Math.random() * tickets.length)];
      if (winners.indexOf(chosen) === -1) winners.push(chosen);
    }

    return winners;
  }

  // Schedule a task to run repeatedly (takes a cron schedule--default daily)
  scheduleTask(task, schedule = '0 0 * * *') {
    cron.schedule(schedule, task);
  }
}

module.exports = Bot;
