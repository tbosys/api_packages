var moment = require("moment");
var queryString = require("querystring");
var Slack = require("./apiHelpers/slack");

class Log {
  constructor(event, context) {
    console.log("TimeStamp", moment());
    this.success = this.success.bind(this);
    this.save = this.save.bind(this);

    this.error = this.error.bind(this);
    console.log("event", event);
    this._event = event;
    this._context = context;
    this._user = {};
  }

  user(user = {}) {
    console.log("user", user.name || "Public");
    this._user = user;
  }

  parts(parts) {
    this._parts = `${parts.operationName}/${parts.methodName}`;
    console.log("user", this._user.name, parts.operationName, parts.methodName);
  }

  save(status, error) {
    var log = {
      createdAt: moment().format("YYYY-MM-DD HH:mm:ss"),
      namespaceId: process.env.NODE_ENV,

      status: status,
      remainingTimeInMillis: this._context.remainingTimeInMillis,
      functionName: this._context.functionName,
      requestId: this._context.invokeid,
      logGroupName: this._context.logGroupName,
      logStreamName: this._context.logStreamName,
      route: this._parts,
      usuarioNombre: this._user.name,
      evento: JSON.stringify(this._event),
      error: error ? error.message + " " + error.stack : "",
      usuarioId: this._user.id
    };

    return Promise.resolve({}); //this._knex.table("log").insert(log);
  }

  success(res) {
    return this.save(200);
  }

  slack(err) {
    if (["testing", "staging", "production"].indexOf(process.env.NODE_ENV) == -1) return new Promise({});
    return Slack(`Error en API *${process.env.NODE_ENV}*`, [
      {
        color: "danger",
        fallback: `de ${this._user.name} ${this._parts}`,
        author_name: this._user.name,
        title: err.message,
        title_link:
          "https://devops.efactura.io/api/log/fromCloudwatch?" +
          queryString.stringify({
            requestId: this._context.invokeid,
            logGroupName: this._context.logGroupName,
            logStreamName: this._context.logStreamName
          }),
        text: "Ocurrio un error inesperado en el API",
        fields: [
          { title: "User", value: this._user.name, short: true },
          { title: "Path", value: this._parts, short: true },
          { title: "Stack", value: err.stack, short: false }
        ],
        footer: `eFactura ${process.env.NODE_ENV}`
      }
    ]);
  }

  error(err) {
    var status = err.status || err.statusCode || 500;
    console.log(err.label, err.status, err.message);
    console.log(err.stack);
    var slackPromise = Promise.resolve({});
    if (process.env.NODE_ENV != "development" && (status > 499 || status == 403))
      slackPromise = this.slack(err);
    return slackPromise.then(() => {
      return this.save(status, err);
    });
  }
}

module.exports = Log;
