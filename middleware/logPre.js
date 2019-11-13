module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    before: (handler, next) => {
      const { context } = handler;
      console.log(
        "PARSER_JSON",
        JSON.stringify({
          type: "START",
          env: process.env.NODE_ENV,
          account: context.account,
          data: {
            operation: context.parts.operationName,
            method: context.parts.methodName,
            user: { id: context.user.id, name: context.user.name }
          },
          metadata: {
            headers: { ...context.headers, "x-authorization": null }
          }
        })
      );
      next();
    },
    after: null,
    onError: null
  };
};
