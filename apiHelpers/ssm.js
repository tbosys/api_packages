var AWS = require("aws-sdk");
var ssm = new AWS.SSM({ apiVersion: "2014-11-06" });

module.exports = async function() {
  var params = {
    Path: "/",
    Recursive: true
  };

  var result = await ssm.getParametersByPath(params).promise();

  var keyMap = {};
  var keys = result.Parameters.forEach(keyItem => {
    var name = keyItem.Name;
    if (name.indexOf("/-/") == 0 || name.indexOf(`/${process.env.NODE_ENV}/`) == 0) {
      var key = keyItem.Name.replace(`/${process.env.NODE_ENV}/`, "").replace("/-/", "");
      keyMap[key] = keyItem.Value;
    }
  });

  return keyMap;
};
