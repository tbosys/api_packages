var errors = require("../errors");
var AWS = require("aws-sdk");
var s3 = new AWS.S3({
  region: "us-east-1"
});

var moment = require("moment-timezone");
moment.tz.setDefault("America/Guatemala");
var uuid = require("uuid");

module.exports = opts => {
  const defaults = {};

  const options = Object.assign({}, defaults, opts);

  return {
    after: async handler => {
      const { response } = handler;
      let modifiedResponse = {};

      if (!handler.response)
        throw new errors.SERVER_ERROR(
          "The operation returned null, there is probasbly and error in the API Method"
        );

      if (
        response.headers &&
        response.headers["Content-Type"] &&
        response.headers["Content-Type"] != "application/json"
      ) {
        modifiedResponse = {
          statusCode: response.code || response.statusCode || 200,
          headers: response.headers,
          body: response.body
        };
      } else {
        const body = JSON.stringify(response);
        const byteLength = Buffer.byteLength(body, "utf8");
        if (byteLength < 3000000)
          modifiedResponse = {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json"
            },
            body: body
          };
        else {
          var key = uuid.v4() + ".json";
          await s3
            .putObject({
              Bucket: "response.efactura.io",
              Key: key,
              Body: body,
              ACL: "public-read",
              ContentType: "application/json"
            })
            .promise();

          modifiedResponse = {
            statusCode: 303,
            headers: {
              Location: `https://response.efactura.io/${key}`
            }
          };
        }
      }

      handler.response = modifiedResponse;
      return;
    }
  };
};
