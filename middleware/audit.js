const moment = require("moment");

module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    after: async (handler, next) => {
      const { context } = handler;
      if (handler.response.statusCode > 300) next();
      else {
        var count = (context.audit || []).length - 1;
        var momentTime = moment().unix();
        while (count > -1) {
          try {
            if (!process.env.TESTING && ["staging", "production"].indexOf(process.env.NODE_ENV) > -1)
              await context.DynamoDB.table(process.env.NODE_ENV + "Audit").insert({
                ...context.audit[count],
                typeid:
                  context.audit[count].typeid +
                  "/" +
                  moment
                    .unix(momentTime)
                    .add(count, "seconds")
                    .format("YYYY-MM-DD-HH-MM-ss-SSS"),
                ttl: moment()
                  .add(12, "months")
                  .unix()
              });
          } catch (e) {
            console.log("CRITICAL", e.stack);
          }
          count--;
        }

        next();
      }
    },

    onError: null
  };
};
