var BaseAction = require("./baseAction");
var Errors = require("../errors");
var moment = require("moment-timezone");
var Security = require("../apiHelpers/security");
var Pusher = require("../apiHelpers/pusher");

module.exports = class DefaultUpdateAction extends BaseAction {
  async execute(table, body, current) {
    this.table = table;
    this.body = body;
    console.log(body);
    if (!body.id)
      throw new Errors.VALIDATION_ERROR(
        `El API request debe tener el id y no lo tiene. ${this.table} ${body.id}`
      );

    this.current = await this.knex
      .table(this.table)
      .select()
      .where("id", this.body.id)
      .first();
    if (!this.current || !this.current.id)
      throw new Errors.VALIDATION_ERROR("No se encontro una fila con ese id: " + this.body.id);

    this.metadata = this.getMetadata(this.table);
    return this.update();
  }

  _validate() {
    this.validate(this.table, this.body, false);
  }

  checkSecurity() {
    if (!this.securityChecked) Security.checkUpdate(this.metadata, this.user, this.getDeltaFields());
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

  preTransform() {
    this.json = {};
    var keys;
    var columnKeys = Object.keys(this.metadata.properties);

    keys = Object.keys(this.body);

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

  async preUpdate() {}

  async postUpdate() {
    return true;
  }

  async update() {
    try {
      this._ = {};
      var fields = Object.keys(this.body);
      fields.forEach(field => {
        if (field.indexOf("__") == 0) {
          this._[field.replace("__", "_")] = this.body[field];
          delete this.body[field];
        } else if (field.indexOf("_") == 0) {
          this._[field.replace("_", "")] = this.body[field];
          delete this.body[field];
        }
      });

      if (this.current && this.current.estado == "archivado")
        throw new Errors.VALIDATION_ERROR(
          `La fila ${this.current.id} seleccionada en ${
            this.metadata.key
          } ya esta archivada, no se puede modificar.`
        );

      this.preTransform();
      this.preValidate();
      this._validate();
      await this.preUpdate();

      var simpleBody = { ...this.body };
      if (this.metadata.properties.updatedAt) simpleBody.updatedAt = moment().format("YYYY-MM-DD HH:mm:ss");
      if (this.metadata.properties.updatedBy) simpleBody.updatedBy = this.user.name;
      delete simpleBody.id;
      var where = { id: this.body.id };

      if (this.metadata.properties.updatedAt && this._.forceUpdate != true) {
        where.updatedAt = this.body.updatedAt;
      }

      this.checkSecurity();

      this.result = await this.knex
        .table(this.table)
        .update(simpleBody)
        .where(where);

      if (this.result.length == 0) throw new Errors.UPDATE_WITHOUT_RESULT(this.table, this.body.id);

      await this.saveAudit(this.body.id, "update", simpleBody);

      var final = await this.knex
        .table(this.table)
        .select()
        .where("id", this.body.id)
        .first();

      await this.postUpdate(final);

      var columnKeys = Object.keys(this.metadata.properties);

      let keys = Object.keys(final);
      keys.forEach(key => {
        if (final[key] == null) delete final[key];
      });

      columnKeys.forEach(columnKey => {
        if (this.metadata.properties[columnKey].isJSON) {
          if (final[columnKey]) {
            final[columnKey] = JSON.parse(final[columnKey]);
          } else {
            final[columnKey] = [];
          }
        }
      });

      await Pusher(this.table, "general", final);

      return this.result;
    } catch (e) {
      if (e.code == "ER_DUP_ENTRY") throw new Errors.DUPLICATE_ERROR(e, this.body);
      throw e;
    }
  }
};
