module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    onError: (handler, next) => {
      if (handler.context.knex) return handler.context.knex.destroy();
      else next();
    },
    after: (handler, next) => {
      if (handler.context.knex) return handler.context.knex.destroy();
      else next();
    },
    before: (handler, next) => {
      var Knex = require("../apiHelpers/knex");

      handler.context.knex = Knex();

      next();
    }
  };
};
