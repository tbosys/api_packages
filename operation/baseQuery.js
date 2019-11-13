const Dinero = require("dinero.js");
Dinero.globalLocale = "es-CR";
Dinero.defaultPrecision = 5;

const Errors = require("../errors");
var moment = require("moment");
var Base64URL = require("base64-url");

var Security = require("../apiHelpers/security");

class ApiOperation {
  constructor(context, user, knex, table) {
    this.context = context;
    this._user = user;
    this._knex = knex;
    this.table = table;
  }

  get schema() {
    return null;
  }

  set schema(a) {}

  get secure() {
    return true;
  }

  set secure(ignore) {}

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
      this._metadata = require("../schema/" + (this.schema || this.table) + ".json");
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
          if ((this.user.nivel || 100) >= metadata.shareLevel) return result.ownerId == this.user.id;
          //If owner is me, then filter true else false.
          else return true; // in case nivel user < 5 then return true
        }
      }
      return true;
    });

    if (body.filterOwnerName && body.filterOwnerName.length > 0) {
      items = items.filter(item => {
        var ownerName = item.__ownerId || "";
        return ownerName.toLowerCase().indexOf(body.filterOwnerName.toLowerCase()) > -1;
      });
    }

    return items;
  }

  async query(body, doNotCheckSecurity) {
    var metadata = this.getMetadata();
    if (body.cursor) {
      try {
        var base = Base64URL.decode(body.cursor);
        var cursor = JSON.parse(base);
        body.filters = cursor.filters;
        body.limit = cursor.limit;
        body.lastId = cursor.lastId;
        body.sort = cursor.sort;
        body.totalCount = cursor.totalCount;
      } catch (e) {
        console.log(e);
      }
    }

    if (body.filterName) {
      var view = await this.knex
        .table("tableView")
        .first()
        .where({ name: body.filterName, table: this.table });
      if (view)
        await this.knex
          .table("tableView")
          .update({
            type: body.type || "table",
            filters: JSON.stringify(body.filters),
            columns: JSON.stringify(body.columns || [])
          })
          .where("id", "=", view.id);
      else
        await this.knex.table("tableView").insert({
          name: body.filterName,
          type: body.type || "table",
          table: this.table,
          filters: JSON.stringify(body.filters),
          columns: JSON.stringify(body.columns || [])
        });
    }

    var results = await this._query(body, doNotCheckSecurity);
    if (!body.cursor) {
      var countQuery = await this._query(body, doNotCheckSecurity, true);
      if (countQuery && countQuery.length > 0) body.totalCount = countQuery[0].count;
      else body.totalCount = 0;
    }

    results = await this.postQuery(results, body);

    if (results.length > 0 && metadata.restrictedQuery && metadata.restrictedQuery.length > -1) {
      var fields = Object.keys(results[0]);
      results = results.map(result => {
        fields.forEach(field => {
          if (metadata.restrictedQuery.indexOf(field) > -1) {
            var restricted = Security.checkQueryField(this.table, this.user, field);
            if (restricted) delete result[field];
          }
        });
        return result;
      });
    }
    var edges = body.limit ? results.slice(0, body.limit) : results;

    var response = {
      pageInfo: {
        endCursor: this.getEndCursor(edges, body),
        hasNextPage: results.length > body.limit,
        totalCount: body.totalCount
      },
      edges: edges
    };
    return response;
  }

  getEndCursor(edges, body) {
    if (!edges.length) return null;
    var data = {
      totalCount: body.totalCount,
      filters: body.filters,
      limit: body.limit,
      sort: body.sort,
      lastId: (body.lastId || 0) + body.limit
    };
    return Base64URL.encode(JSON.stringify(data));
  }

  _query(body, doNotCheckSecurity = false, count = false) {
    var metadata = this.getMetadata();
    var isSecure = metadata.secure || true;
    if (doNotCheckSecurity == false && isSecure) Security.checkQuery(this.table, this.user);

    var knexOperation = this.knex(this.table);
    knexOperation = this.getSelectQuery(knexOperation, body, count);

    knexOperation = this.processQueryFilter(knexOperation, body);
    if (body.id) knexOperation = knexOperation.where({ [`${this.table}.id`]: body.id });
    if (body.inProgress && metadata.properties.estado)
      knexOperation = knexOperation.whereNot(`${this.table}.estado`, "archivado");

    if (
      !body.fromOne &&
      metadata.properties.activo &&
      JSON.stringify(body.filters || "").indexOf("activo") == -1 &&
      body.source != "edit"
    )
      knexOperation = knexOperation.where(metadata.properties.activo.select || `${this.table}.activo`, 1);

    //TODO FIX THIS

    if (body.sort && !count) {
      Object.keys(body.sort).forEach(key => {
        var column = this.getMetadata().properties[key];
        var field = this.parseField(key);
        if (column.select) field = key;
        knexOperation = knexOperation.orderBy(field, body.sort[key].toLowerCase());
      });
    } else knexOperation.orderBy(`${this.table}.id`, "desc");

    if (body.limit && !count) knexOperation = knexOperation.limit(body.limit + 1);
    if (body.lastId && !count) knexOperation = knexOperation.offset(body.lastId);

    //console.log(knexOperation.toString());
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

  getSelectQuery(knexOperation, body, count) {
    var metadata = this.getMetadata();
    var fields = this.getFields("array");
    var parsedFields = [];
    var joins = [];

    parsedFields = fields
      .filter(field => {
        if (field.query == false) return false;
        return true;
      })
      .map(field => {
        var fieldName = field.key;
        if (!fieldName && typeof field == "string") fieldName = field;
        if (field.select) return this.knex.raw(`${field.select} as ${fieldName}`);
        return `${this.table}.${fieldName}`;
      });

    function belongsToJoin(relation) {
      var parts = relation.split(">"); //cliente>zona. 1=Zona 0= Cliente
      joins.push([parts[1], `${parts[1]}.id`, `${[parts[0]]}.${parts[1]}Id`]);
      var fieldProperties = metadata.properties[`${parts[1]}Id`] ? metadata.properties[`${parts[1]}Id`] : {};
      if (fieldProperties.fields)
        fieldProperties.fields.forEach(relatedFieldArray => {
          parsedFields.push(`${parts[1]}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`);
        });
    }

    function belongsTo(relation, table) {
      var names = [relation];
      var fieldProperties = metadata.properties[`${names[0]}Id`];

      var alias = fieldProperties.tableAlias || fieldProperties.table;
      if (fieldProperties.fields)
        fieldProperties.fields.forEach(relatedFieldArray => {
          parsedFields.push(`${alias}.${relatedFieldArray[0]} as ${relatedFieldArray[1]}`);
        });
      else {
        names.forEach(name => {
          var adjustedName = name.indexOf("Id") > -1 ? `__${name}` : `__${name}Id`;
          parsedFields.push(`${alias}.name as ${adjustedName}`);
        });
      }
      names.forEach(name => {
        var adjustedName = name.indexOf("Id") > -1 ? `${name}` : `${name}Id`;

        joins.push([`${fieldProperties.table} as ${alias}`, `${alias}.id`, `${table}.${adjustedName}`]);
      });
    }

    if (metadata.belongsTo && metadata.belongsTo.length > 0) {
      metadata.belongsTo.forEach(relation => {
        if (relation.indexOf(">") > -1) {
          belongsToJoin(relation, this.table);
        } else {
          belongsTo(relation, this.table);
        }
      });
    }

    if (metadata.belongsIn && metadata.belongsIn.length > 0) {
      metadata.belongsIn.forEach(relation => {
        joins.push([relation, `${relation}.${metadata.key}Id`, `${[metadata.key]}.id`]);
      });
    }

    joins.forEach(function(join) {
      knexOperation = knexOperation.leftJoin(join[0], join[1], join[2]);
    });

    knexOperation = count
      ? knexOperation.count(`${this.table}.id as count`)
      : knexOperation.select(parsedFields);

    return knexOperation;
  }

  processQueryFilter(knexOperation, body) {
    if (!body.filter && !body.filters) return knexOperation;

    return this.proccessArrayFilters(knexOperation, body);
  }

  proccessArrayFilters(knexOperation, body) {
    var metadata = this.getMetadata();

    body.filters.forEach(filter => {
      //  if (filter[0].indexOf("ownerId") > -1) return (body.filterOwnerName = filter[2]);
      var column;
      var filterKey = filter[0];
      var tableName = metadata.key;
      if (filterKey.indexOf(".") == -1) {
        column = metadata.properties[filterKey];
      } else {
        //table.propertyKey
        var parts = filterKey.split(".");
        if (!parts.length > 0)
          throw new Errors.VALIDATION_ERROR(`Maximo dos relaciones en el query ${filter[0]}`);
        tableName = parts[0];
        filterKey = parts[1];
        var otherMetadata = this.getExternalMetadata(tableName);
        column = otherMetadata.properties[filterKey];
      }
      if (!column) throw new Errors.VALIDATION_ERROR(`${filter[0]} no pudo ser convertido en un metadata`);
      var fullFieldName = `${tableName}.${filterKey}`;

      if (column && column.excludeFromQuery) return;
      else if (column && column.select && filter[1] == "LIKE")
        knexOperation.whereRaw(`${column.select} ${filter[1]} ?`, `%${filter[2]}%`);
      else if (column && column.select) knexOperation.whereRaw(`${column.select} ${filter[1]} ?`, filter[2]);
      else if (column.element == "autocomplete" && filter[1] == "LIKE") {
        var field = column.elementOptions ? column.elementOptions.primary : "name";
        knexOperation.where(`${column.table}.${field}`, "LIKE", `%${filter[2]}%`);
      } else if (filter[1] == "IN_PROGRESS") {
        knexOperation.whereNot(`${this.table}.estado`, "archivado");
      } else if (filter[1] == "LIKE" && filter[2] && filter[2].indexOf("%") == -1)
        knexOperation.where(fullFieldName, "LIKE", `%${filter[2]}%`);
      else if (filter[1] == "STATIC_DATE") {
        var dates = this.getFixedDates(filter[2]);
        knexOperation.whereBetween(fullFieldName, dates);
      } else if (filter[1] == "BETWEEN_DATE") {
        var format = "YYYY-MM-DD";
        if (column && column.filterRenderer == "DateTimeFilter") format = "YYYY-MM-DD hh:mm:ss";
        knexOperation.whereBetween(fullFieldName, filter[2].map(date => moment(date).format(format)));
      } else if (filter[1] == "FIND_IN_SET")
        knexOperation.where(this.knex.raw(`FIND_IN_SET('${filter[2]}',${fullFieldName})`));
      else knexOperation.where(fullFieldName, filter[1], filter[2]);
    });
    return knexOperation;
  }

  getFixedDates(fixedType) {
    var betweens = [];
    var current_fiscal_year_start, current_fiscal_year_end, last_fiscal_year_start, last_fiscal_year_end;

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
    else if (fixedType == "AYER") betweens = [moment().add(-1, "day"), moment().add(-1, "day")];
    else if (fixedType == "CICLO") betweens = [moment().add(-1, "month"), moment()];
    else if (fixedType == "ESTA SEMANA") betweens = [moment().startOf("week"), moment()];
    else if (fixedType == "ESTE MES") betweens = [moment().startOf("month"), moment()];
    else if (fixedType == "ESTE AÑOF") betweens = [current_fiscal_year_start, current_fiscal_year_end];
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
    else if (fixedType == "ULTIMO AÑOF") betweens = [last_fiscal_year_start, last_fiscal_year_end];

    return [betweens[0].format("YYYY-MM-DD 00:00:00"), betweens[1].format("YYYY-MM-DD 23:59:59")];
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
}

module.exports = ApiOperation;
