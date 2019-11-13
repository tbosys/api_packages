var constaints = [
  {
    name: "segmento_name_empresaid_unique",
    constraint: { field: "name", message: "El campo nombre ya se encuentra en la base de datos" }
  }
];

module.exports = {
  TIMEOUT_ERROR: class SERVER_ERROR extends Error {
    constructor() {
      super();
      this.message = "Timeout";
      this.label =
        "La operacion duro mucho tiempo y no se pudo completar. Recarge la pagina para ver los cambios.";
      this.solution = "RELOAD";
      this.name = "TIMEOUT_ERROR";
      this.type = "TIMEOUT_ERROR";
      this.status = 508;
    }
  },

  SERVER_ERROR: class SERVER_ERROR extends Error {
    constructor(message) {
      super();
      this.message = message;
      this.label = message;
      this.solution = "RETRY";
      this.name = "SERVER_ERROR";
      this.type = "SERVER_ERROR";
      this.status = 504;
    }
  },

  DUPLICATE_FIELD: class DUPLICATE_FIELD extends Error {
    constructor(sqlError, key) {
      super();

      this.message = sqlError.sqlMessage;
      this.label = `El campo ${key} se esta utilizando y no se puede volver a usar.`;
      this.solution = "INPUT";
      this.name = "DUPLICATE_FIELD";
      this.type = "DUPLICATE_FIELD";
      this.status = 409;
    }
  },

  DUPLICATE_ERROR: class DUPLICATE_ERROR extends Error {
    constructor(sqlError, body) {
      super();
      var constraint = {
        field: "*",
        message: "Un campo se encuentra en la base de datos y no puede ser duplicado"
      };
      constaints.forEach(function(constraintLoop) {
        if (sqlError.sqlMessage.indexOf(constraintLoop.name) > -1) constraint = constraintLoop.constraint;
      });

      this.message = sqlError.sqlMessage;
      this.label = constraint.message;
      this.solution = "INPUT";
      this.duplicateKey = constraint.key;
      this.name = "DUPLICATE_ERROR";
      this.type = "DUPLICATE_ERROR";
      this.status = 409;
    }
  },

  VALIDATION_ERROR: class VALIDATION_ERROR extends Error {
    constructor(message, errorArray, body) {
      super();
      this.message = JSON.stringify(body);
      this.label = message;
      this.errors = errorArray;
      this.solution = "INPUT";
      this.name = "VALIDATION_ERROR";
      this.type = "VALIDATION_ERROR";
      this.status = 400;
    }
  },

  UPDATE_WITHOUT_RESULT: class UPDATE_WITHOUT_RESULT extends Error {
    constructor(table, id, field, old, n) {
      super();
      this.message = `No se encontro el id ${id} en ${table} para hacer el update de ${JSON.stringify(
        old
      )} a ${JSON.stringify(n)}`;
      this.label = `Ocurrio un error, no podemos encontrar este ${table}.`;
      this.solution = "RELOAD";
      this.name = "UPDATE_WITHOUT_RESULT";
      this.type = "UPDATE_WITHOUT_RESULT";
      this.status = 400;
    }
  },

  ITEM_NOT_FOUND: class ITEM_NOT_FOUND extends Error {
    constructor(table, id = "") {
      super();
      this.message = `No se encontro ${id} en ${table}`;
      this.label = `Ocurrio un error, no podemos encontrar este ${table} ${id}.`;
      this.solution = "RELOAD";
      this.name = "ITEM_NOT_FOUND";
      this.type = "ITEM_NOT_FOUND";
      this.status = 404;
    }
  },

  UPDATE_FIELD_CONFLICT: class UPDATE_FIELD_CONFLICT extends Error {
    constructor(...args) {
      super();
      this.message = "El valor de este campo fue cambiado por otra persona, favor intente de nuevo.";
      this.label = "El valor de este campo fue cambiado por otra persona, favor intente de nuevo.";
      this.solution = "RELOAD";
      this.name = "UPDATE_FIELD_CONFLICT";
      this.type = "UPDATE_FIELD_CONFLICT";
      this.status = 409;
    }
  },

  UPDATE_LOCKED: class UPDATE_FIELD_CONFLICT extends Error {
    constructor(message) {
      super();
      this.message = message;
      this.label = message;
      this.solution = "NONE";
      this.name = "UPDATE_LOCKED";
      this.type = "UPDATE_LOCKED";
      this.status = 409;
    }
  },

  INTEGRATION_ERROR: class INTEGRATION_ERROR extends Error {
    constructor(...args) {
      super(...args);
      this.label =
        "Ocurrio un en el sistema, no esta relacionado con el sistema. Comuniquese con Soporte Tecnico nivel Critico";
      this.solution = "SUPPORT";
      this.name = "INTEGRATION_ERROR";
      this.type = "INTEGRATION_ERROR";
      this.status = 500;
    }
  },

  PERMISSION_ERROR: class PERMISSION_ERROR extends Error {
    constructor(message) {
      super();
      this.label = message || "No tiene permiso para realizar esta acción";
      this.solution = "ADMIN";
      this.name = "PERMISSION_ERROR";
      this.type = "PERMISSION_ERROR";
      this.status = 403;
    }
  },

  AUTH_ERROR: class PERMISSION_ERROR extends Error {
    constructor(message) {
      super();
      this.label = message || "No esta registrado en el sistema, sera llevado a la pagina de Login.";
      this.solution = "ADMIN";
      this.name = "LOGIN_ERROR";
      this.type = "LOGIN_ERROR";
      this.status = 401;
    }
  }
};
