
var AWS = require("aws-sdk");

module.exports = function (contact, namespace_id) {
  //  if (process.env.NODE_ENV == "development" || process.env.ION_CI_TEST) return Promise.resolve({});

  var ses = new AWS.SES({
    region: "us-east-1"
  });
  var params = {
    Destination: { /* required */
      BccAddresses: [],
      CcAddresses: [],
      ToAddresses: [
        contact.email
      ]
    },
    Source: "login@efactura.io",
    /* required */
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `<h1>Hola amig@,</h1><p>Su codigo para hacer login es ${contact.code}</p>. <p>Que tenga un muy buen día<./p>`
        },
        Text: {
          Charset: "UTF-8",
          Data: `Hola amig@, Su codigo para hacer login es ${contact.code}.`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Información de Ingreso"
      }
    }

  };
  return ses.sendEmail(params).promise();


}
