const request = require('./habiticaRequest.js');

class Bot {
  queue = [];
  constructor(challenges, credentials) {
    if (!(challenges instanceof (require('./challengeSet.js')))) throw new Error('Pass a ChallengeSet.');
    this.challenges = challenges;
    this.credentials = credentials;

    this.#runQueue();
  }
  //Manages the task queue
  async #runQueue() {
    while (this.queue.length) {
      await this.queue.shift()();
    }
  }
  //Updates all the member stats, including task completion history
  async updateMembers() {
    async function addToMemberCount(challenge, lastId) {
      const result = await request(
        `/challenges/${challenge.challengeId}/members${lastId ? `?lastId=${lastId}` : ''}`,
        'get',
        {},
        this.credentials
      );

      if (result.success) {
        challenge.members = challenge.members.concat(result.data);
      } else {
        if (result.status === 429) {
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => resolve("done!"), 10000)
            });

            await promise;

            await addToMemberCount.bind(this, challenge, lastId)
          });
        } else {
          throw new Error(result);
        }
      }
    }
    async function fetchMemberStats(member, challenge) {
      const result = await request(
        `/challenges/${challenge.challengeId}/members/${member.id}`,
        'get',
        {},
        this.credentials
      );

      if (result.success) {
        member.stats = result.data;
      } else {
        if (result.status === 429) {
          this.queue.splice(0, 0, async () => {
            let promise = new Promise((resolve, reject) => {
              setTimeout(() => resolve("done!"), 10000)
            });

            await promise;

            await fetchMemberStats.bind(this, member, challenge);
          });
        } else {
          throw new Error(result);
        }
      }
    }

    for (let challenge of this.challenges.challenges) {
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
        challenge.members = challenge.members.map(m => m.stats);
      });
    }

    await this.#runQueue();
  }
}

module.exports = Bot;
