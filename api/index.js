var BaseApiOperation = require("../operation/baseOperation");
var fs = require("fs");
var path = require("path");

module.exports = class Api {
  static getOperation(operationName) {
    var Operation;

    var exists = fs.existsSync(path.resolve(__dirname, operationName + ".js"));

    if (exists) Operation = require(`./${operationName}`);
    else
      Operation = class Op extends BaseApiOperation {
        constructor(context, user, knex) {
          super(context, user, knex);
          this._user = user;
          this.context = context;
          this._knex = knex;
        }
        get table() {
          return operationName;
        }
      };
    return Operation;
  }
};
