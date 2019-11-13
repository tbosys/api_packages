var BigNumber = require("bignumber.js");
const Dinero = require("dinero.js");
Dinero.globalLocale = "es-CR";
Dinero.defaultPrecision = 5;

const Errors = require("../errors");
var path = require("path");
var moment = require("moment");
var BaseQuery = require("./baseQuery");

var Security = require("../apiHelpers/security");
var fs = require("fs");

class ApiOperation {
  constructor(context, user, knex) {
    this.context = context;
    this._user = user;
    this._knex = knex;
  }

  get table() {
    return "";
  }

  set table(a) {}

  get schema() {
    return null;
  }

  set schema(a) {}

  get secure() {
    return true;
  }

  set secure(ignore) {}

  destroy(body) {
    return this._destroy(body);
  }

  async _destroy(body) {
    if (body.ids[0] == null)
      throw new Errors.VALIDATION_ERROR(
        "Debe escoger al menos una fila por borrar"
      );

    var trx = await this.createTransaction();
    try {
      var current = await this.one({ id: body.ids[0] });
      var metadata = this.getMetadata();
      var Action = this.getActionFor(this.table, "destroy", "Destroy");
      var action = new Action(this.user, trx, this.context);
      var resultBody = await action.execute(
        this.table,
        body,
        current,
        metadata
      ); //should contain { field: newValue, ... }
      await trx.commit();
      return resultBody;
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  }

  preUpdateHook(payload) {
    return payload;
  }

  async _update(body) {
    if (!body.id)
      throw new Errors.VALIDATION_ERROR(
        "El API request debe tener el id y no lo tiene."
      );
    var trx = await this.createTransaction();
    try {
      var Action = this.getActionFor(this.table, "update", "Update");
      var action = new Action(this.user, trx, this.context);
      body = this.preUpdateHook(body);
      var resultBody = await action.execute(this.table, body);
      var one = this.one(body);
      await trx.commit();
      return one;
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  }

  update(body) {
    if (Object.keys(body).length == 1) return Promise.resolve({});
    return this._update(body);
  }

  batchCount(body) {
    var metadata = this.getMetadata();

    var knexOperation = this.knex(this.table).count(
      metadata.key + ".id as count"
    );
    var parsedFields = [];
    knexOperation = this.processQueryFilter(knexOperation, body);

    if (metadata.belongsTo && metadata.belongsTo.length > 0) {
      var joins = [];

      metadata.belongsTo.forEach(relation => {
        if (relation.indexOf(">") > -1) {
          var parts = relation.split(">");
          joins.push([
            parts[1],
            `${parts[1]}.id`,
            `${[parts[0]]}.${parts[1]}Id`
          ]);
          //var fieldOps = metadata.properties[`${parts[1]}Id`] ? metadata.properties[`${parts[1]}Id`] : {};
          //if (fieldOps.fields) fieldOps.fields.forEach((relatedFieldArray) => {
          //            parsedFields.push(`${parts[1]}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`)
          //        })
        } else {
          var fieldOps = metadata.properties[`${relation}Id`]
            ? metadata.properties[`${relation}Id`]
            : {};
          var alias = fieldOps.tableAlias || relation;
          joins.push([
            `${relation} as ${alias}`,
            `${alias}.id`,
            `${this.table}.${relation}Id`
          ]);
        }
      });

      joins.forEach(function(join) {
        knexOperation = knexOperation.leftJoin(join[0], join[1], join[2]);
      });
    }
    return knexOperation.then(res => {
      if (res[0]) return res[0].count;
      else return 0;
    });
  }

  batch(body) {
    var metadata = this.getMetadata();

    var update = {};
    Object.keys(body.update).forEach(key => {
      update[`${metadata.key}.${key}`] = body.update[key];
    });

    var knexOperation = this.knex(this.table).update(update);

    knexOperation = this.processQueryFilter(knexOperation, body);

    if (metadata.belongsTo && metadata.belongsTo.length > 0) {
      var joins = [];

      metadata.belongsTo.forEach(relation => {
        if (relation.indexOf(">") > -1) {
          var parts = relation.split(">");
          joins.push([
            parts[1],
            `${parts[1]}.id`,
            `${[parts[0]]}.${parts[1]}Id`
          ]);
          //var fieldOps = metadata.properties[`${parts[1]}Id`] ? metadata.properties[`${parts[1]}Id`] : {};
          //if (fieldOps.fields) fieldOps.fields.forEach((relatedFieldArray) => {
          //parsedFields.push(`${parts[1]}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`)
          //})
        } else {
          var fieldOps = metadata.properties[`${relation}Id`]
            ? metadata.properties[`${relation}Id`]
            : {};
          var alias = fieldOps.tableAlias || relation;
          joins.push([
            `${relation} as ${alias}`,
            `${alias}.id`,
            `${this.table}.${relation}Id`
          ]);
        }
      });

      joins.forEach(function(join) {
        knexOperation = knexOperation.leftJoin(join[0], join[1], join[2]);
      });
    }
    return knexOperation;
  }

  isMultiRowAction() {
    var metadata = this.getMetadata();
    return metadata.multiRowAction != true;
  }

  executeAction(actionName, Action) {
    var _this = this;
    return async body => {
      if (this.isMultiRowAction() && body.ids && body.ids.length > 1)
        throw new Errors.VALIDATION_ERROR(
          "La acciones solo pueden tener un fila"
        );

      var trx = await this.createTransaction();
      try {
        var action = new Action(this.user, trx, this.context);
        action.table = this.table;
        Security.checkAction(this.table, this.user, Action, actionName, action);

        var resultBody = await action.execute(this.table, body);
        await trx.commit();
        return resultBody;
      } catch (e) {
        console.log(e);
        await trx.rollback();
        throw e;
      }
    };
  }

  async _create(body) {
    var trx = await this.createTransaction();
    try {
      var Action = this.getActionFor(this.table, "create", "Create");
      var action = new Action(this.user, trx, this.context);
      var resultBody = await action.execute(this.table, body);
      await trx.commit();
      return resultBody;
    } catch (e) {
      console.log(e);
      await trx.rollback();
      throw e;
    }
  }

  create(body) {
    return this._create(body);
  }

  async _aprobar(body) {
    var trx = await this.createTransaction();
    try {
      var Action = this.getActionFor(this.table, "aprobar", "Aprobar");
      var action = new Action(this.user, trx, this.context);
      Security.checkAction(this.table, this.user, Action, "aprobar", action);

      var resultBody = await action.execute(this.table, body);
      await trx.commit();
      return resultBody;
    } catch (e) {
      console.log(e);
      await trx.rollback();
      throw e;
    }
  }

  aprobar(body) {
    return this._aprobar(body);
  }

  async _aplicar(body) {
    var trx = await this.createTransaction();
    try {
      var Action = this.getActionFor(this.table, "aplicar", "Aplicar");
      var action = new Action(this.user, trx, this.context);
      Security.checkAction(this.table, this.user, Action, "aplicar", action);
      var resultBody = await action.execute(this.table, body);
      await trx.commit();
      return resultBody;
    } catch (e) {
      console.log(e);
      await trx.rollback();
      throw e;
    }
  }

  aplicar(body) {
    return this._aplicar(body);
  }

  getExternalMetadata(key) {
    try {
      var metadata = require("../schema/" + key + ".json");
      metadata = this.validateMetadata(this._metadata);
      return metadata;
    } catch (e) {
      console.log(e);
      throw new Errors.ITEM_NOT_FOUND(`Metadata ${this.table} no se encontro`);
    }
  }

  getMetadata() {
    if (this._metadata) return this._metadata;
    try {
      this._metadata = require("../schema/" +
        (this.schema || this.table) +
        ".json");
      this._metadata = this.validateMetadata(this._metadata);
      return this._metadata;
    } catch (e) {
      console.log(e);
      throw new Errors.ITEM_NOT_FOUND(`Metadata ${this.table} no se encontro`);
    }
  }

  validateMetadata(metadata) {
    if (metadata.actions)
      metadata.actions = metadata.actions.map(action => {
        const mapThenActions = { Borrar: "confirm", Imprimir: "openUrl" };
        var validAction = {
          title: action.title || action,
          key: action.key,
          constraint: action.constraint, // single, multiple,
          type: action.type || "checkButton", // modal || checkButton || actionButton
          then: action.then || mapThenActions[action.title] || "reload", // reload || "confirm" || openUrl
          icon: action.icon || action.title || action,
          subscribe: action.subscribe || null
        };
        return validAction;
      });
    else metadata.actions = [];
    Object.keys(metadata.properties).forEach(key => {
      metadata.properties[key].key = key;
    });
    return metadata;
  }

  getFields(as) {
    var metadata = this.getMetadata();
    if (as == "keys") return Object.keys(metadata.properties);
    if (as == "array") {
      var fields = [];
      Object.keys(metadata.properties).map(function(propertyName) {
        var property = metadata.properties[propertyName];
        property.key = propertyName;
        if (!property.excludeFromQuery) fields.push(property);
      });
      return fields;
    }
    return metadata.properties;
  }

  async metadata(body) {
    var metadata = this.getMetadata();
    var item = null;
    var recent = null;

    if (this.context.headers.referer) {
      var referer = this.context.headers.referer;
      var realReferer =
        referer.lastIndexOf("/") == referer.length - 1
          ? referer.substr(0, referer.length - 1)
          : referer.substr(0);
      var refererParts = realReferer.split("/");
      referer = refererParts[refererParts.length - 2];
    }

    metadata.count = (await this.knex(this.table).count("id as id"))[0].id;

    if (body.id && parseInt(body.id) >= 0) item = await this.one(body);
    else if (body.inProgress)
      recent = await this.query(
        this.getQueryForInProgress() || { inProgress: true }
      );
    else if (body.relatedTo)
      recent = await this.query({
        filters: [[body.relatedTo, "=", body.relatedId]]
      });
    else if (body.filters) recent = await this.query(body);

    metadata.user = this.user;
    metadata.item = item;
    metadata.recent = recent;

    if (recent) {
      var reports = await this.knex
        .table("reporte")
        .select()
        .where("table", this.table);
      metadata.reports = reports.map(item => {
        return {
          ...item,
          fields: JSON.parse(item.fields || "[]"),
          sums: JSON.parse(item.sums || "[]"),
          sort: JSON.parse(item.sort || "[]"),
          groups: JSON.parse(item.groups || "[]"),
          filters: JSON.parse(item.filters || "[]")
        };
      });
    }

    if (metadata.tableOverride && metadata.tableOverride[referer])
      metadata.table = metadata.tableOverride[referer];

    return this.postMetadata(metadata);
  }

  async postMetadata(metadata) {
    return metadata;
  }

  async one(body) {
    var results = await this.query({
      fromOne: true,
      filter: { [`${this.table}.id`]: body.id },
      fields: body.fields
    });
    if (body.activo == false) return body;
    else if (!results || !results[0] || !results[0].id)
      throw new Errors.ITEM_NOT_FOUND(body.id, this.table);
    return results[0];
  }

  checkAction(name) {
    return this.getActionFor(this.table, name, false);
  }

  allWithName(body) {
    return this.query({ fields: ["id", "name"] }, true);
  }

  findLikeName(body) {
    var metadata = this.getMetadata();
    var filters = [[`${metadata.key}.name`, "like", `%${body.name}%`]];
    var keys = Object.keys(body);
    keys.forEach(key => {
      if (key != "name") filters.push([key, "=", body[key]]);
    });
    return this.query({ filters: filters, limit: 10 }, true);
  }

  getQueryForInProgress() {
    return null;
  }

  async postQuery(allItems, body) {
    var keys;
    var metadata = this.getMetadata();
    var columnKeys = Object.keys(metadata.properties);

    let items = allItems.filter(result => {
      if (!keys) keys = Object.keys(result);
      keys.forEach(key => {
        if (result[key] == null) delete result[key];
      });

      if (this._postQuery) this._postQuery(result);

      columnKeys.forEach(columnKey => {
        if (metadata.properties[columnKey].isJSON && result[columnKey]) {
          result[columnKey] = JSON.parse(result[columnKey]);
        }
      });

      if (metadata.properties.ownerId) {
        if (metadata.shareLevel) {
          if ((this.user.nivel || 100) >= metadata.shareLevel)
            return result.ownerId == this.user.id;
          //If owner is me, then filter true else false.
          else return true; // in case nivel user < 5 then return true
        }
      }
      return true;
    });

    if (body.filterOwnerName && body.filterOwnerName.length > 0) {
      items = items.filter(item => {
        var ownerName = item.__ownerId || "";
        return (
          ownerName.toLowerCase().indexOf(body.filterOwnerName.toLowerCase()) >
          -1
        );
      });
    }

    if (metadata.sort)
      items.sort(function(a, b) {
        if (a[metadata.sort] > b[metadata.sort]) return 1;
        if (a[metadata.sort] < b[metadata.sort]) return -1;
        return 0;
      });

    return items;
  }

  async get(body) {
    var Query = new BaseQuery(this.context, this.user, this.knex, this.table);
    return Query.query(body);
  }

  async query(body, doNotCheckSecurity) {
    var metadata = this.getMetadata();

    var results = await this._query(body, doNotCheckSecurity);

    results = await this.postQuery(results, body);

    if (
      results.length > 0 &&
      metadata.restrictedQuery &&
      metadata.restrictedQuery.length > -1
    ) {
      var fields = Object.keys(results[0]);
      results = results.map(result => {
        fields.forEach(field => {
          if (metadata.restrictedQuery.indexOf(field) > -1) {
            var restricted = Security.checkQueryField(
              this.table,
              this.user,
              field
            );
            if (restricted) delete result[field];
          }
        });
        return result;
      });
    }

    return results;
  }

  _query(body, doNotCheckSecurity = false) {
    var metadata = this.getMetadata();
    var isSecure = metadata.secure || true;
    if (doNotCheckSecurity == false && isSecure)
      Security.checkQuery(this.table, this.user);

    var knexOperation = this.knex(this.table);
    knexOperation = this.getSelectQuery(knexOperation, body);
    knexOperation = this.toMultiTenantQuery(knexOperation);

    knexOperation = this.processQueryFilter(knexOperation, body);
    if (body.id)
      knexOperation = knexOperation.where({ [`${this.table}.id`]: body.id });
    if (body.inProgress && metadata.properties.estado)
      knexOperation = knexOperation.whereNot(
        `${this.table}.estado`,
        "archivado"
      );

    if (
      !body.fromOne &&
      metadata.properties.activo &&
      JSON.stringify(body.filters || "").indexOf("activo") == -1 &&
      body.source != "edit"
    )
      knexOperation = knexOperation.where(
        metadata.properties.activo.select || `${this.table}.activo`,
        1
      );

    //TODO FIX THIS
    if (body.order) knexOperation = knexOperation.orderBy(body.order, "ASC");
    else if (metadata.properties.estado) {
      var order = `FIELD(${
        this.table
      }.estado, ${metadata.properties.estado.enum
        .map(item => `"${item}"`)
        .join(",")} ) ASC`;
      knexOperation = knexOperation.orderByRaw(order);
    } else if (metadata.orderBy)
      knexOperation = knexOperation.orderBy(
        metadata.orderBy[0],
        metadata.orderBy[1]
      );

    if (body.limit) knexOperation = knexOperation.limit(body.limit);
    else {
      if (!body.inProgress && !body.limitless)
        knexOperation = knexOperation.limit(2000);

      if (body.inProgress && !body.limitless && !metadata.properties.estado)
        knexOperation = knexOperation.limit(metadata.limit || 100);
    }
    //console.log(knexOperation.toString());
    return knexOperation;
  }

  groupBy(body) {
    var metadata = this.getMetadata();
    var isSecure = metadata.secure || true;
    Security.checkQuery(this.table, this.user);

    var knexOperation = this.knex(this.table);
    knexOperation = this.getSumQuery(knexOperation, body);

    knexOperation = this.processQueryFilter(knexOperation, body);
    if (body.id)
      knexOperation = knexOperation.where({ [`${this.table}.id`]: body.id });
    if (body.inProgress && metadata.properties.estado)
      knexOperation = knexOperation.whereNot(
        `${this.table}.estado`,
        "archivado"
      );

    if (
      metadata.properties.activo &&
      JSON.stringify(body.filters || "").indexOf("activo") == -1
    )
      knexOperation = knexOperation.where(
        metadata.properties.activo.select || `${this.table}.activo`,
        1
      );
    console.log(knexOperation.toString());

    //TODO FIX THIS
    //if (body.order) knexOperation = knexOperation.orderBy(body.order, "DESC");

    //if (!body.inProgress && !body.limitless) knexOperation = knexOperation.limit(100);

    return knexOperation;
  }

  parseAsField(field) {
    var parts = field.split(".");
    return parts[parts.length - 1];
  }

  parseField(field) {
    var metadata = this.getMetadata();
    if (field.indexOf(".") == -1) return `${metadata.key}.${field}`;
    return field;
  }

  getSumQuery(knexOperation, body) {
    var metadata = this.getMetadata();
    if (body.sumFields)
      knexOperation = knexOperation.sum(
        `${this.parseField(body.sumFields)} as ${this.parseAsField(
          body.sumFields
        )}`
      );
    else if (body.count) {
      knexOperation = knexOperation.count(`${this.parseField("id")} as count`);
    } else
      throw new Errors.VALIDATION_ERROR("Debe escoger un campo para sumar");
    var parsedGroupBy = [];
    var parsedSelect = [];
    if (!body.groupBy) body.groupBy = [];
    body.groupBy.forEach(groupFieldBy => {
      var fieldOptions = metadata.properties[groupFieldBy];
      var groupBy;
      if (!fieldOptions) groupBy = groupFieldBy;
      else if (fieldOptions.select) {
        groupBy = fieldOptions.select;
      } else if (fieldOptions.metadataType) {
        groupBy = `${fieldOptions.metadataType}.${
          fieldOptions.elementOptions
            ? fieldOptions.elementOptions.primary
            : "name"
        }`;
      } else groupBy = groupFieldBy;
      parsedGroupBy.push(groupBy);
      parsedSelect.push(
        `${this.parseField(groupBy)} as ${this.parseAsField(groupFieldBy)}`
      );
    });

    if (body.dateGroup && body.dateGroup.length > 2) {
      var parts = body.dateGroup.split("-");
      var dateField = `${metadata.key}.${parts[0]}`;
      var groupType = parts[1];
      var dateGroup;
      if (groupType == "mes") dateGroup = `DATE_FORMAT(${dateField}, '%Y-%m')`;
      else if (groupType == "año") dateGroup = `YEAR(${dateField})`;
      else if (groupType == "semana") dateGroup = `YEARWEEK(${dateField})`;
      else if (groupType == "día")
        dateGroup = `DATE_FORMAT(${dateField}, '%Y-%m-%d')`;
      if (process.env.NODE_ENV != "development")
        knexOperation = knexOperation.orderBy(dateField, "ASC");
      parsedGroupBy.push(dateGroup);
      parsedSelect.push(
        `${this.parseField(dateGroup)} as ${this.parseAsField(groupType)}`
      );
    }
    var joins = [];
    if (metadata.belongsTo && metadata.belongsTo.length > 0) {
      metadata.belongsTo.forEach(relation => {
        if (relation.indexOf(">") > -1) {
          var parts = relation.split(">");
          joins.push([
            parts[1],
            `${parts[1]}.id`,
            `${[parts[0]]}.${parts[1]}Id`
          ]);
        } else if (relation.indexOf("[") > -1) {
          var parts = relation.split("[");
          var key = parts[1].replace("]", "");
          joins.push([
            parts[0],
            `${parts[0]}.${key}`,
            `${[metadata.key]}.${key}`
          ]);
        } else {
          joins.push([
            relation,
            `${relation}.id`,
            `${[metadata.key]}.${relation}Id`
          ]);
        }
      });
    }

    joins.forEach(function(join) {
      knexOperation = knexOperation.leftJoin(join[0], join[1], join[2]);
    });

    knexOperation = knexOperation
      .select(this.knex.raw(parsedSelect.join(",")))
      .groupBy(this.knex.raw(parsedGroupBy.join(",")));

    console.log(knexOperation.toString());

    return knexOperation;
  }

  getSelectQuery(knexOperation, body) {
    var metadata = this.getMetadata();
    var fields = body.fields || this.getFields("array");
    var parsedFields = [];

    if (metadata.properties.ownerId) fields.push("ownerId");
    parsedFields = fields
      .filter(field => {
        if (field.query == false) return false;

        return true;
      })
      .map(field => {
        var fieldName = field.key;
        if (!fieldName && typeof field == "string") fieldName = field;
        if (field.select)
          return this.knex.raw(`${field.select} as ${fieldName}`);
        return `${this.table}.${fieldName}`;
      });
    var joins = [];
    if (metadata.belongsTo && metadata.belongsTo.length > 0) {
      metadata.belongsTo.forEach(relation => {
        if (relation.indexOf(">") > -1) {
          var parts = relation.split(">");
          joins.push([
            parts[1],
            `${parts[1]}.id`,
            `${[parts[0]]}.${parts[1]}Id`
          ]);
          var fieldOps = metadata.properties[`${parts[1]}Id`]
            ? metadata.properties[`${parts[1]}Id`]
            : {};
          if (fieldOps.fields)
            fieldOps.fields.forEach(relatedFieldArray => {
              parsedFields.push(
                `${parts[1]}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`
              );
            });
        } else if (relation.indexOf("[") > -1) {
          var parts = relation.split("[");
          var key = parts[1].replace("]", "");
          joins.push([
            parts[0],
            `${parts[0]}.${key}`,
            `${[metadata.key]}.${key}`
          ]);
          var fieldOps = metadata.properties[`${parts[0]}Id`]
            ? metadata.properties[`${parts[0]}Id`]
            : {};
          if (fieldOps.fields)
            fieldOps.fields.forEach(relatedFieldArray => {
              parsedFields.push(
                `${parts[0]}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`
              );
            });
        } else {
          var names = [];
          var fieldOps = metadata.properties[`${names[0]}Id`];
          if (relation.indexOf("[") > -1) {
            var parts = relation.replace("]", "").split("[")[1];
            names = parts.split(",");
            fieldOps = metadata.properties[`${names[0]}`];
          } else {
            names = [relation];
            fieldOps = metadata.properties[`${names[0]}Id`];
          }

          var alias = fieldOps.tableAlias || fieldOps.table;
          if (fieldOps.fields)
            fieldOps.fields.forEach(relatedFieldArray => {
              parsedFields.push(
                `${alias}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`
              );
            });
          else {
            names.forEach(name => {
              var adjustedName =
                name.indexOf("Id") > -1 ? `__${name}` : `__${name}Id`;
              parsedFields.push(`${alias}.name as ${adjustedName}`);
            });
          }
          names.forEach(name => {
            var adjustedName =
              name.indexOf("Id") > -1 ? `${name}` : `${name}Id`;

            joins.push([
              `${fieldOps.table} as ${alias}`,
              `${alias}.id`,
              `${this.table}.${adjustedName}`
            ]);
          });
        }
      });

      knexOperation = knexOperation.select(parsedFields);
      knexOperation.selectFields = parsedFields;
      joins.forEach(function(join) {
        knexOperation = knexOperation.leftJoin(join[0], join[1], join[2]);
      });
    } else {
      knexOperation = knexOperation.select(parsedFields);
      knexOperation.selectFields = parsedFields;
    }

    if (metadata.belongsIn && metadata.belongsIn.length > 0) {
      metadata.belongsIn.forEach(relation => {
        knexOperation = knexOperation.leftJoin(
          relation,
          `${relation}.${metadata.key}Id`,
          `${[metadata.key]}.id`
        );
      });
    }
    return knexOperation;
  }

  processQueryFilter(knexOperation, body) {
    if (!body.filter && !body.filters) return knexOperation;

    if (body.filters) return this.proccessArrayFilters(knexOperation, body);
    var keys = Object.keys(body.filter);
    if (keys.length == 0) return knexOperation;

    if (!body.filter[keys[0]].column)
      return this.processDirectFilter(knexOperation, body, keys);
    else return this.processTableFilter(body);
  }

  processDirectFilter(knexOperation, body) {
    return knexOperation.where(body.filter);
  }

  proccessArrayFilters(knexOperation, body) {
    var metadata = this.getMetadata();

    body.filters.forEach(filter => {
      if (filter[0].indexOf("ownerId") > -1)
        return (body.filterOwnerName = filter[2]);
      var parts = filter[0].split(".");
      var key = parts[1] || parts[0];
      var column = metadata.properties[key];
      if (parts[1] && metadata.key == parts[0])
        column = metadata.key == parts[0];
      else if (parts[1]) {
        var otherMetadata = this.getExternalMetadata(parts[0]);
        column = otherMetadata[key];
      }

      if (column && column.excludeFromQuery) return;
      else if (column && column.select)
        knexOperation.whereRaw(`${column.select} ${filter[1]} ?`, filter[2]);
      else if (filter[1] == "FIXED") {
        var dates = this.getFixedDates(filter[2]);
        knexOperation.whereBetween(filter[0], dates);
      } else if (filter[1] == "FIND_IN_SET")
        knexOperation.where(
          this.knex.raw(`FIND_IN_SET('${filter[2]}',${filter[0]})`)
        );
      else knexOperation.where(filter[0], filter[1], filter[2]);
    });
    console.log(knexOperation.toString());
    return knexOperation;
  }

  getFixedDates(fixedType) {
    var betweens = [];
    var current_fiscal_year_start,
      current_fiscal_year_end,
      last_fiscal_year_start,
      last_fiscal_year_end;

    if (moment().quarter() == 4) {
      current_fiscal_year_start = moment()
        .month("October")
        .startOf("month");
      current_fiscal_year_end = moment()
        .add("year", 1)
        .month("September")
        .endOf("month");
      last_fiscal_year_start = moment()
        .subtract("year", 1)
        .month("October")
        .startOf("month");
      last_fiscal_year_end = moment()
        .month("September")
        .endOf("month");
    } else {
      current_fiscal_year_start = moment()
        .subtract("year", 1)
        .month("October")
        .startOf("month");
      current_fiscal_year_end = moment()
        .month("September")
        .endOf("month");
      last_fiscal_year_start = moment()
        .subtract("year", 2)
        .month("October")
        .startOf("month");
      last_fiscal_year_end = moment()
        .subtract("year", 1)
        .month("September")
        .endOf("month");
    }

    if (fixedType == "HOY") betweens = [moment(), moment()];
    else if (fixedType == "AYER")
      betweens = [moment().add(-1, "day"), moment().add(-1, "day")];
    else if (fixedType == "CICLO")
      betweens = [moment().add(-1, "month"), moment()];
    else if (fixedType == "ESTA SEMANA")
      betweens = [moment().startOf("week"), moment()];
    else if (fixedType == "ESTE MES")
      betweens = [moment().startOf("month"), moment()];
    else if (fixedType == "ESTE AÑOF")
      betweens = [current_fiscal_year_start, current_fiscal_year_end];
    else if (fixedType == "ULTIMO MES")
      betweens = [
        moment()
          .startOf("month")
          .add(-1, "month"),
        moment()
          .startOf("month")
          .add(-1, "day")
      ];
    else if (fixedType == "12 SEMANAS")
      betweens = [
        moment()
          .startOf("week")
          .add(-12, "week"),
        moment()
      ];
    else if (fixedType == "16 SEMANAS")
      betweens = [
        moment()
          .startOf("week")
          .add(-16, "week"),
        moment()
      ];
    else if (fixedType == "6 MESES")
      betweens = [
        moment()
          .startOf("month")
          .add(-6, "month"),
        moment()
      ];
    else if (fixedType == "12 MESES")
      betweens = [
        moment()
          .startOf("month")
          .add(-12, "month"),
        moment()
      ];
    else if (fixedType == "ULTIMO AÑOF")
      betweens = [last_fiscal_year_start, last_fiscal_year_end];

    return [
      betweens[0].format("YYYY-MM-DD 00:00:00"),
      betweens[1].format("YYYY-MM-DD 23:59:59")
    ];
  }

  processTableFilter(knexOperation, body, keys) {
    keys.forEach(function(key) {
      var column = body.filter[key].column;
      if (column.excludeFromQuery) return;
      else if (column) {
        if (column.filter == "LIKE")
          knexOperation.where(key, "LIKE", `%${body.filter[key].filterTerm}%`);
        if (column.filter == "eq" && column.type == "integer")
          knexOperation.where(key, "=", parseInt(body.filter[key].filterTerm));
        if (column.filter == "eq" && column.type == "number")
          knexOperation.where(
            key,
            "=",
            parseFloat(body.filter[key].filterTerm)
          );
        if (column.filter == "eq" && column.type == "string")
          knexOperation.where(key, "=", body.filter[key].filterTerm);
        if (
          column.filter == "BETWEEN" &&
          (column.subType == "date" || column.subType == "timestamp")
        )
          knexOperation.whereBetween(key, [
            body.filter[key].filterTerm.start,
            body.filter[key].filterTerm.end
          ]);
      }
    });
    return knexOperation;
  }

  getActionFor(table, fieldOrAction, fallback) {
    var Action;
    if (typeof fieldOrAction != "string") return fieldOrAction;

    var exists = fs.existsSync(
      path.resolve(__dirname, "../actions", table, fieldOrAction + ".js")
    );
    if (exists) Action = require(`../actions/${table}/${fieldOrAction}`);
    else if (typeof fallback != "string") return fallback;
    else if (
      [
        "Action",
        "Create",
        "Destroy",
        "Query",
        "Update",
        "Aprobar",
        "Aplicar"
      ].indexOf(fallback) > -1
    )
      Action = require(`./base${fallback}Action`);

    if (Action) Action.table = table;
    return Action;
  }

  getActionAndInvoke(table, fieldOrAction, body) {
    var Action = this.getActionFor(table, fieldOrAction);
    Action.table = table;
    var actionInstance = new Action(this.user, this.knex, this.context);
    actionInstance.table = table;
    return actionInstance.execute(table, body);
  }

  async saveAudit(id, action, values = {}) {
    if (id == "") id = null;
    if (!this.context.audit) this.context.audit = [];
    this.context.audit.push({
      account: this.context.account,
      ownerId: this.context.user.id,
      ownerName: this.context.user.name,
      type: this.table,
      typeid: this.table + "/" + id,
      action: action,
      createdAt: moment().toISOString(),
      delta: JSON.stringify(values)
    });
    return true;
  }

  toMultiTenantQuery(query, order, limit) {
    if (!this.multiTenantObject) return query;
    return query;
  }

  createTransaction() {
    const promisify = fn =>
      new Promise((resolve, reject) => fn(resolve).catch(reject));
    return promisify(this.knex.transaction);
  }

  get user() {
    return this._user;
  }

  set user(userData) {
    return;
  }

  get knex() {
    return this._knex;
  }

  set knex(ignore) {
    return;
  }

  get multiTenantObject() {
    return this._multiTenantObject;
  }

  set multiTenantObject(isIt) {
    this._multiTenantObject = isIt;
  }
}

String.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {
    s = "0" + s;
  }
  return s;
};

Number.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {
    s = "0" + s;
  }
  return s;
};

Number.prototype.to5 = function() {
  return Dinero({ amount: parseInt(this * 100000) }).toFormat("0.00000");
};

Number.prototype.to2 = function() {
  return Dinero({ amount: parseInt(this * 100000) }).toFormat("0.00");
};

String.prototype.pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {
    s = "0" + s;
  }
  return s;
};

Number.prototype.pad = function(size) {
  var s = String(this);

  while (s.length < (size || 2)) {
    s = "0" + s;
  }
  return s;
};

//Devuelve un instance de BigNumber, no un numbero
Number.dineroRaw = function(a, b, operation) {
  var aa = new BigNumber(a || 0);
  var bb = new BigNumber(b || 0);

  return aa[operation](bb);
};

Number.dineroString = function(a, b, operation) {
  return Number.dineroRaw(a, b, operation).toFixed(5);
};

//Devuelve un numero;
Number.dineroNumber = function(a, b, operation) {
  return Number.dineroRaw(a, b, operation).toNumber();
};

module.exports = ApiOperation;
