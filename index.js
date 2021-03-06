const ChallengeSet = require('./modules/challengeSet.js');
const Bot = require('./modules/bot.js');
const Boss = require('./modules/boss.js');
const Task = require('./modules/task.js');
const habiticaRequest = require('./modules/habiticaRequest.js');
const getChallengeIDs = require('./modules/getChallengeIDs.js');

module.exports = {
  ChallengeSet,
  Bot,
  habiticaRequest,
  getChallengeIDs,
  Boss,
  Task
};
