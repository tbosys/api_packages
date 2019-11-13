var BaseAction = require("./baseAction");
var Errors = require("../errors");
var Security = require("../apiHelpers/security");
var moment = require("moment-timezone");

module.exports = class DefaultCreateAction extends BaseAction {
  execute(table, body) {
    this.table = table;
    this.body = body;
    this.metadata = this.getMetadata(this.table);
    return this.create();
  }

  preTransform() {
    this.json = {};

    var columnKeys = Object.keys(this.metadata.properties);

    columnKeys.forEach(columnKey => {
      if (this.metadata.properties[columnKey].isJSON) {
        if (this.body[columnKey] && typeof this.body[columnKey] != "string") {
          this.json[columnKey] = this.body[columnKey];
          this.body[columnKey] = JSON.stringify(this.body[columnKey]);
        }
      }
    });
  }

  preValidate() {}

  async preInsert() {}

  async postInsert() {
    this.body.id = this.results[0];
    this.results = this.body;
  }

  checkSecurity() {
    if (!this.securityChecked)
      Security.checkCreate(this.metadata, this.user, this.getDeltaFields());
  }

  getDeltaFields() {
    var fields = Object.keys(this.body);
    fields.forEach(field => {
      if (this.body[field] == null) delete this.body[field];
      if (field.indexOf("__") == 0) delete this.body[field];
      else if (field.indexOf("_") == 0) delete this.body[field];
    });
    return fields;
  }

  _validate() {
    this.validate(this.table, this.body);
  }

  setDefaultValues() {
    if (this.metadata.properties.namespaceId)
      this.body.namespaceId = process.env.NODE_ENV;
    if (this.metadata.properties.createdBy)
      this.body.createdBy = this.user.name;
    if (!this.body.ownerId && this.metadata.properties.ownerId)
      this.body.ownerId = this.user.id;
    if (this.metadata.properties.updatedAt)
      this.body.updatedAt = moment().format("YYYY-MM-DD HH:mm:ss");
    if (
      this.metadata.properties.ownerName &&
      this.context.userMap[this.body.ownerId]
    )
      this.body.ownerName = this.context.userMap[this.body.ownerId].name;
  }

  async create(body) {
    try {
      this._ = {};
      var fields = Object.keys(this.body);
      fields.forEach(field => {
        if (field.indexOf("__") == 0) {
          this._[field.replace("__", "")] = this.body[field];
          delete this.body[field];
        } else if (field.indexOf("_") == 0) {
          this._[field.replace("_", "")] = this.body[field];
          delete this.body[field];
        }
      });

      this.setDefaultValues();

      this.preTransform();
      this.preValidate();
      this._validate();

      await this.preInsert();
      this.checkSecurity();

      this.results = await this.knex.table(this.table).insert(this.body);
      await this.postInsert();
      await this.saveAudit(this.body.id, "create", this.body);

      return this.results;
    } catch (e) {
      if (e.code == "ER_DUP_ENTRY")
        throw new Errors.DUPLICATE_ERROR(e, this.body);
      throw e;
    }
  }
};
