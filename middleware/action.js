var errors = require("../errors");

module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    before: (handler, next) => {
      var Api = require("../api");

      var Operation = Api.getOperation(handler.context.parts.operationName);
      if (!Operation)
        throw new Error("[402] no se encontro la operacion " + handler.context.parts.operationName);
      var operation = new Operation(handler.context, handler.context.user, handler.context.knex);
      if (operation.secure && !handler.context.user)
        throw new errors.AUTH_ERROR(
          `Operation ${handler.context.parts.operationName} is secure and user is not authenticated`
        );

      var method = operation[handler.context.parts.methodName];
      if (!method) {
        var action = operation.checkAction(handler.context.parts.methodName);
        if (!action) throw new Error("[402] no se encontro el metodo " + handler.context.parts.methodName);
        method = operation.executeAction(handler.context.parts.methodName, action);
      }
      handler.context.method = method;
      handler.context.operation = operation;
      next();
    },
    after: null,
    onError: null
  };
};
