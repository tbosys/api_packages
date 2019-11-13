var request = require("superagent");

module.exports = function(url, message, attachments = {}) {
  if (!url) url = "https://hooks.slack.com/services/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";
  return request.post(url).send({ text: message, attachments: attachments });
};

module.exports.postMessage = function(accessToken, channelId, message, attachments = {}, blocks = {}) {
  var url = "https://slack.com/api/chat.postMessage";
  return request
    .post(url)
    .set("Authorization", "Bearer " + accessToken)
    .send({ channel: channelId, text: message, attachments: attachments, blocks });
};

module.exports.getUser = function(accessToken, email) {
  var url = "https://slack.com/api/users.lookupByEmail?email=" + email;
  return request
    .post(url)
    .set("Authorization", "Bearer " + accessToken)
    .send()
    .then(res => {
      if (!res.body.ok) return null;
      return res.body.user;
    });
};

module.exports.getUsers = function(accessToken) {
  var url = "https://slack.com/api/users.list";
  return request
    .post(url)
    .set("Authorization", "Bearer " + accessToken)
    .send()
    .then(res => {
      if (!res.body.ok) return {};
      var userMapByEmail = {};

      res.body.members.forEach(item => {
        userMapByEmail[item.profile.email] = item;
      });

      return userMapByEmail;
    });
};

module.exports.openChannel = function(accessToken, users) {
  var url = "https://slack.com/api/conversations.open";
  console.log(users);
  return request
    .post(url)
    .set("Authorization", "Bearer " + accessToken)
    .send({ users: users.join(",") })
    .then(res => {
      console.log(res.body);
      if (!res.body.ok) return null;
      return res.body.channel.id;
    });
};
module.exports.postMessageToChannel = async function(accessToken, user, creator, text, message) {
  var slackUserMap = await module.exports.getUsers(accessToken);

  if (user.id != creator.createdById) {
    var userSlack = slackUserMap[user.email == "dev@dev" ? "roberto@rodcocr.com" : user.email];
    var creatorSlack = slackUserMap[creator.email == "dev@dev" ? "roberto@rodcocr.com" : creator.email];
    console.log(userSlack);
    console.log("********");
    console.log(creatorSlack);
    var channelId = await module.exports.openChannel(
      accessToken,
      [userSlack.id, creatorSlack.id].filter(item => item != null)
    );
    console.log(channelId);
    return module.exports.postMessage(accessToken, channelId, text, message);
  }
};

module.exports.postMessageToSingleChannel = async function(accessToken, user, text, message) {
  var slackUserMap = await module.exports.getUsers(accessToken);
  var userSlack = slackUserMap[user.email == "dev@dev" ? "roberto@rodcocr.com" : user.email];
  console.log(userSlack);

  return module.exports.postMessage(accessToken, userSlack.id, text, message);
};
