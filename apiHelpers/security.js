var Errors = require("../errors");

function checkAdmin(user) {
  if (user.roles.indexOf("*_*") > -1) return true;
  return false;
}

function isRoleMising(user, table, action) {
  if (user.roles.indexOf(`${table}_*`) > -1) return false;
  return user.roles.indexOf(`${table}_${action}`) == -1;
}

function isRoleQueryMising(user, table, field) {
  if (user.roles.indexOf(`${table}_query_*`) > -1) return false;
  return user.roles.indexOf(`${table}_query_${field}`) == -1;
}

module.exports = {
  checkQueryField: function(table, user, field) {
    if (!checkAdmin(user) && isRoleQueryMising(user, table, field)) return true;
    return false;
  },

  checkQuery: function(table, user) {
    if (!checkAdmin(user) && isRoleMising(user, table, "query"))
      throw new Errors.PERMISSION_ERROR(`No tiene permiso para ver datos de ${table}`);
  },

  checkAction: function(table, user, Action, actionName, actionInstance = {}) {
    if (
      actionInstance.secure != false &&
      Action.secure != false &&
      !checkAdmin(user) &&
      isRoleMising(user, table, actionName)
    )
      throw new Errors.PERMISSION_ERROR(`No tiene permiso para la acción ${actionName}`);
  },

  checkUpdate: function(metadata, user, fields, functions) {
    var isAdmin = checkAdmin(user);
    if (isAdmin) return true;

    if (isRoleMising(user, metadata.key, "update"))
      throw new Errors.PERMISSION_ERROR(`No tiene permiso para editar ${metadata.key}`);

    var restrictedFields = metadata.restricted;

    var foundItems = fields.filter(function(item) {
      return restrictedFields.indexOf(item) > -1;
    });

    foundItems.forEach(restrictedKey => {
      var customFunctions = functions ? functions[restrictedKey] : null;
      var customFunctionResult = customFunctions ? customFunctions() : null;
      if (customFunctionResult == false) {
        throw new Errors.PERMISSION_ERROR(`No tiene permiso para editar ${restrictedKey}`);
      } else if (customFunctionResult) return true;
      else if (user.roles.indexOf(`${metadata.key}_${restrictedKey}`) == -1)
        throw new Errors.PERMISSION_ERROR(`No tiene permiso para editar ${restrictedKey}`);
    });
  },

  checkCreate: function(metadata, user, fields, functions) {
    var isAdmin = checkAdmin(user);
    if (isAdmin) return true;

    if (!isAdmin && isRoleMising(user, metadata.key, "create"))
      throw new Errors.PERMISSION_ERROR(`No tiene permiso para crear ${metadata.key}`);

    var restrictedFields = metadata.restricted;
    let found = [];
    if (restrictedFields) found = fields.some(r => restrictedFields.indexOf(r) >= 0);

    var foundItems = fields.filter(function(item) {
      return restrictedFields.indexOf(item) > -1;
    });

    foundItems.forEach(restrictedKey => {
      if (functions && functions[restrictedKey]) functions[restrictedKey]();
    });
  },

  checkDestroy: function(metadata, user) {
    var isAdmin = checkAdmin(user);
    if (isAdmin) return true;
    if (!isAdmin && isRoleMising(user, metadata.key, "destroy"))
      throw new Errors.PERMISSION_ERROR(`No tiene permiso para borrar ${metadata.key}`);
  }
};
