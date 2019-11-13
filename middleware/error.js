var errors = require("../errors");
var request = require("superagent");
var queryString = require("querystring");

module.exports = opts => {
  const defaults = {};
  const options = Object.assign({}, defaults, opts);

  return {
    onError: (handler, next) => {
      const { context, event } = handler;

      var status = handler.error.status || 500;
      var parts = context.parts || { operationName: "*", methodName: "*" };
      var user = context.user || { id: "*" };

      var logError = {
        apiStatusOperationMethodUserId: `${context.functionName}_/_${status}_/_${parts.operationName}_/_${
          parts.methodName
        }_/_${user.id}`,
        type: "ERROR",
        error: handler.error,
        stack: handler.error.stack,
        env: process.env.NODE_ENV,
        account: context.account || "*",
        api: context.functionName,
        ownerId: user.id,
        ownerName: user.name,
        status: status,
        operation: parts.operationName,
        method: parts.methodName,
        referer: context.headers.referer,
        origin: context.headers.origin,
        userAgent: handler.context.userAgent,
        ip: context.headers.ip,
        awsRequestId: context.awsRequestId,
        logGroupName: context.logGroupName,
        logStreamName: context.logStreamName
      };

      console.log("PARSER_JSON", JSON.stringify(logError));

      if (!handler.error.status || handler.error.status > 499) {
        handler.response = {
          statusCode: handler.error.status || 500,
          body: JSON.stringify(new errors.SERVER_ERROR(handler.error.message + " " + handler.error.stack)),
          headers: {
            "Content-Type": "application/json"
          }
        };
      } else
        handler.response = {
          statusCode: handler.error.status,
          body: JSON.stringify(handler.error),
          headers: {
            "Content-Type": "application/json"
          }
        };

      next();
    }
  };
};
