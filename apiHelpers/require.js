var ServiceHelper = {};

ServiceHelper.getParts = function(path) {
  var parts = path.split("/"); //Parts of the URL
  var last = -1;
  if (
    !parts[parts.length + last] ||
    parts[parts.length + last] == "/" ||
    parts[parts.length + last].length == 0
  )
    last--;

  var method = parts[parts.length + last];
  var operation = parts[parts.length + last - 1];

  return {
    methodName: method,
    operationName: operation
  };
};

ServiceHelper.getClassOperation = function(context, parts) {
  var Operation;
  var pathPrefix = context.opertionPathPrefix || process.cwd();

  var path = pathPrefix + "/operations/" + parts.operationName;

  var probableOperations = RequireAll({
    dirname: pathPrefix + "/operations/",
    recursive: true
  });
  //if (process.env.NODE_ENV == "development") probableOperations["metadata"] = MetadataOperation;
  //probableOperations["profile"] = ProfileOperation;
  //probableOperations["root"] = RootOperation;
  //probableOperations["menu"] = Menu;

  var ClassOperations = {};
  var Operations = {};
  var operationKeys = Object.keys(probableOperations);
  operationKeys.forEach(function(operationKey) {
    var operation = probableOperations[operationKey];

    if (operation.index && ServiceHelper.isClass(operation.index)) {
      ClassOperations[operationKey] = operation.index;
    } else if (ServiceHelper.isClass(operation)) ClassOperations[operationKey] = operation;
  });

  Object.keys(ClassOperations).forEach(function(operationKey) {
    Operations[operationKey] = new ClassOperations[operationKey](
      ServiceHelper.knex || null,
      context.user,
      context.config
    );
  });

  Object.keys(Operations).forEach(function(operationKey) {
    Operations[operationKey].models = Operations;
  });

  return Operations[parts.operationName];
};

ServiceHelper.isClass = function(obj) {
  const isCtorClass = obj.constructor && obj.constructor.toString().substring(0, 5) === "class";
  if (obj.prototype === undefined) {
    return isCtorClass;
  }
  const isPrototypeCtorClass =
    obj.prototype.constructor &&
    obj.prototype.constructor.toString &&
    obj.prototype.constructor.toString().substring(0, 5) === "class";
  return isCtorClass || isPrototypeCtorClass;
};

ServiceHelper.getAllMethodNames = function(obj) {
  let methods = new Set();
  try {
    while ((obj = Reflect.getPrototypeOf(obj))) {
      let keys = Reflect.ownKeys(obj);
      keys.forEach(k => methods.add(k));
    }
  } catch (e) {}
  return methods;
};

module.exports = ServiceHelper;
