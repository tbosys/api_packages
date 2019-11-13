var JWT = require("../apiHelpers/jwt");
var errors = require("../errors");
var moment = require("moment");

module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    before: (handler, next) => {
      let { context } = handler;

      const User = new UserModel(handler.context);
      return User.check(handler.context.headers)
        .then(userResponse => {
          context.user = userResponse.user;
          context.users = userResponse.users;
          context.userMap = userResponse.usersMap;
          handler.context = context;
          console.log("USER", JSON.stringify(context.user));
          return;
        })
        .catch(e => {
          console.log("Auth Exception", e.stack);
          throw new errors.AUTH_ERROR(e.label || e.message);
        });
    },
    after: null,
    onError: null
  };
};

class UserModel {
  constructor(context) {
    this.context = context;
    this.check = this.check.bind(this);
  }

  async getUserData(ownerId) {
    let users = await this.context.knex
      .table("owner")
      .select(
        "user.email",
        "user.id",
        "user.avatar",
        "user.name",
        "user.active",
        "user.shareLevel"
      )
      .where("active", true);

    //This soft limit is in place, if it's ever triggered consider changes to the authentication and user architecture. Hard limnit should be 500 users.
    if (users.length > 100)
      throw new errors.AUTH_ERROR(
        "You have reached a soft user limit. Ask your team to comment line 56 of the auth middleware"
      );

    const lineProfiles = await this.context.knex
      .table("profile")
      .select("profile.id, profile.roles, profile.name")
      .innerJoin("ownerProfile", "ownerProfile.profileId", "profile.id")
      .where({ ownerId: ownerId });

    const user = users.filter(item => item.id == ownerId);
    user.roles = lineProfiles.map(item => item.roles);

    return { users, user };
  }

  async check(headers) {
    if (headers["Authorization"]) {
      var userToken = JWT.decode(headers["Authorization"]);
      const { user, users } = await this.getUserData(userToken.id);
      if (!user) throw new errors.AUTH_ERROR("Expired Token, login again");
      if (!user.timestamp || !moment().isSame(user.timestamp, "day"))
        throw new errors.AUTH_ERROR("Expired Token, login again");

      const usersMap = users.reduce(function(map, obj) {
        map[obj.id] = obj.val;
        return map;
      }, {});
      return { user, users, usersMap };
    }
    return {};
  }
}
