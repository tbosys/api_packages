var BaseAction = require("./baseAction");
var Security = require("../apiHelpers/security");

module.exports = class DefaultUpdateFieldAction extends BaseAction {
  execute(table, body, current, metadata) {
    this.table = table;
    this.body = body;
    this.metadata = this.getMetadata(this.table);
    return this.destroy(table, body, current, metadata);
  }

  checkSecurity() {
    if (!this.securityChecked) Security.checkDestroy(this.metadata, this.user);
  }

  async preDestroy() {
    return true;
  }

  async destroy(table, body, current, metadata) {
    //var id = this.enforceSingleId(body);
    await this.enforceNotStatus(body, ["por archivar", "archivado"]);

    try {
      this.checkSecurity();

      await this.preDestroy();

      await this.knex
        .table(table)
        .delete()
        .whereIn("id", body.ids);

      var indexIds = 0;
      while (indexIds < body.ids.length) {
        await this.saveAudit(body.ids[indexIds], "destroy");
        indexIds++;
      }
      return {};
    } catch (e) {
      throw e;
    }
  }
};
