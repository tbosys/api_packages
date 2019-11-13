var mockDb = require("mock-knex");

var Connection = function(database) {
  var pathPrefix = process.cwd();
  var knexFile = require(pathPrefix + "/knexfile");
  var env = process.env.NODE_ENV || "development";

  var knexAuth = knexFile[env];

  var knex = require("knex")(knexAuth);
  if (Connection.mock && !mockDb.ready) {
    mockDb.ready = true;
    mockDb.mock(knex);
  }

  return knex;
};

Connection.destroy = async function(knex) {
  if (Connection.mock) mockDb.unmock(knex);
  await knex.destroy();
  knex = null;
  return true;
};

module.exports = Connection;
