ServiceHelper.getApi = function(event, context) {
  if (!event.path) throw new errors.BadRequest("path not found in original event.");

  if (event.headers && process.env.NODE_ENV != "development")
    process.env.API_URL = "https://" + event.headers.Host || event.headers.host;
  else if (event.headers && process.env.NODE_ENV == "development")
    process.env.API_URL = "http://" + event.headers.host || event.headers.Host;

  //Merges the querystring and the body for get and post requests comming from API Gateway
  var payload = event.body;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {}

  payload = Merge(payload, event.queryStringParameters || {});

  var headerKeys = Object.keys(event.headers);
  payload.headers = {};
  headerKeys.forEach(function(key) {
    key = key.toLowerCase();
    if (key.indexOf("x-include") == 0) {
      var newKey = key.replace("x-include-", "");
      payload.headers[newKey] = event.headers[key];
    }
  });

  var parts = ServiceHelper.getParts(event.path);
  var Operation = ServiceHelper.getClassOperation(context, parts);
  if (!Operation) throw new errors.NotFound(`Operation Class ${event.path} not found`);
  var operationFunction = Operation[parts.methodName];
  if (!operationFunction) throw new errors.NotFound(`Operation Method ${event.path} not found`);

  if (
    context.user.isPublic &&
    (!Operation.allowPublic || Operation.allowPublic.indexOf(parts.methodName) == -1)
  ) {
    throw new errors.Unauthorized(`User is public and operation ${event.path} is not in allowPublic array`);
  }

  return operationFunction.bind(Operation)(payload, context);
};
