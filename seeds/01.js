const moment = require("moment");
//const distritos = require("../_seeds/distrito");

function insertIgnore(knex, operation) {
  return knex.raw(operation.toString().replace(/^insert/i, "insert ignore"));
}

exports.seed = async function(knex, Promise) {
  if (process.env.NODE_ENV == "development")
    await insertIgnore(
      knex,
      knex("owner").insert({ id: 2, email: "dev@dev", name: "Dev Dev" })
    );
  else
    await insertIgnore(
      knex,
      knex("owner").insert({ id: 2, email: "", name: "System Account" })
    );
};
