module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    after: (handler, next) => {
      const { context, event } = handler;
      var status = handler.response.statusCode || 200;
      var parts = context.parts || { operationName: "*", methodName: "*" };
      var user = context.user || { id: "*" };

      console.log(
        "PARSER_JSON",
        JSON.stringify({
          type: "SUCCESS",
          env: process.env.NODE_ENV,
          account: context.account || "*",
          api: context.functionName,
          apiStatusOperationMethodUserId: `${context.functionName}_/_${status}_/_${parts.operationName}_/_${
            parts.methodName
          }_/_${user.id}`,
          ownerId: user.id,
          ownerName: user.name,
          status: handler.response.statusCode,
          operation: parts.operationName,
          method: parts.methodName,
          awsRequestId: context.awsRequestId,
          logGroupName: context.logGroupName,
          logStreamName: context.logStreamName,
          referer: context.headers.referer,
          origin: context.headers.origin,
          userAgent: handler.context.userAgent,
          ip: context.headers.ip
        })
      );
      next();
    },
    before: null,
    onError: null
  };
};
