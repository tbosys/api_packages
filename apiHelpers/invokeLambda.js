var AWS = require("aws-sdk");

var lambda = new AWS.Lambda();

module.exports = function(service, name, event) {
  if (process.env.NODE_ENV == "development" || process.env.NODE_ENV == "test" || process.env.TESTING)
    return localInvoke(payload);

  var payload = JSON.stringify(event);

  var params = {
    FunctionName: `${service}-${process.env.NODE_ENV}-${name}`,
    InvokeArgs: payload
  };

  return lambda.invokeAsync(params).promise();
};

function localInvoke() {
  return Promise.resolve({});
}
