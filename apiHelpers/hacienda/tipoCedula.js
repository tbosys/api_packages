module.exports = function(cedula = "", preTipo) {
  if (preTipo) {
    var pretipoIndex = ["Física", "Jurídica", "DIMEX", "NITE", "Internacional"].indexOf(preTipo);
    if (pretipoIndex > -1) return "0" + (pretipoIndex + 1);
  }
  if (cedula.length == 10) return "02";
  else if (cedula.length == 9) return "01";
  else if (cedula.length == 12) return "03";
};
