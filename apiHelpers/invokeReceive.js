var AWS = require("aws-sdk");
var lambda = new AWS.Lambda({
  region: "us-east-1"
});

AWS.config.apiVersions = {
  stepfunctions: "2016-11-23"
};

var stepfunctions = new AWS.StepFunctions();

module.exports = function(event) {
  if (process.env.NODE_ENV != "production" && event.firma) {
    event.firma.username = event.firma.username_staging;
    event.firma.password = event.firma.password_staging;
    event.firma.pin = event.firma.pin_staging;
    event.firma.certificado = event.firma.certificado_staging;
  }
  if (process.env.NODE_ENV == "development" || process.env.NODE_ENV == "test") return Promise.resolve({});

  var payload = JSON.stringify(event);

  var params = {
    stateMachineArn: `arn:aws:states:us-east-1:177120553227:stateMachine:efactura-receive-${
      process.env.NODE_ENV
    }`,
    input: payload,
    name: `${event.payload.clave}-${Math.random() * 100}`
  };

  return stepfunctions.startExecution(params).promise();
};
