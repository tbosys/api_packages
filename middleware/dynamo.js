module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    before: handler => {
      var $db = require("serverless-dynamodb-client").raw;
      const DynamodbFactory = require("@awspilot/dynamodb");
      DynamodbFactory.config({ empty_string_replace_as: undefined });
      var DynamoDB = new DynamodbFactory($db);
      handler.context.Dynamo = $db;
      handler.context.DynamoDB = DynamoDB;

      return handler.context.DynamoDB.table(process.env.NODE_ENV + "Config")
        .where("account")
        .eq(handler.context.account)
        .descending()
        .query()
        .then(results => {
          handler.context.config = results[0];
          return;
        });
    },
    after: null,
    onError: null
  };
};
