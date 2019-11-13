var BigNumber = require('bignumber.js');

module.exports = function(line) {

  var precio = new BigNumber(line.precio);
  var cantidad = new BigNumber(line.cantidad);
  var descuentoUnitario = new BigNumber(line.descuento || 0);


  var subtotal = new BigNumber(precio.times(cantidad));
  var descuento = subtotal.times(descuentoUnitario.dividedBy(100));
  var impuesto = new BigNumber(0);

  var subTotalConDescuento = subtotal.minus(descuento);

  if (line.impuestos && !Array.isArray(line.impuestos)) line.impuestos = [line.impuestos]
  var impuestos = (line.impuestos || []).map(function(impuestoArray) {
    var codigo, unitario, impuestoTotal;
    if (!Array.isArray(impuestoArray)) {
      codigo = "02"
      unitario = impuestoArray || 0
      impuestoTotal = subTotalConDescuento.times(new BigNumber(unitario).dividedBy(100));
    } else {
      codigo = impuestoArray[1] || "02";
      unitario = impuestoArray[0] || 0;
      impuestoTotal = subTotalConDescuento.times(new BigNumber(unitario).dividedBy(100));
    }
    impuesto = impuesto.plus(impuestoTotal);
    return {
      "Codigo": codigo,
      "Tarifa": unitario.toFixed(2),
      "Monto": impuestoTotal.toFixed(5)
    }

  })

  return {
    codigo: !line.mercancia ? (line.codigo || "01") : (line.codigo || parseInt(Math.random() * 100000)),
    medida: !line.mercancia ? "Sp" : (line.medida || "Unid"),
    detalle: !line.mercancia ? (line.detalle || "Servicios Profesionales") : (line.detalle || "Producto Codigo " + line.codigo),
    impuestos: impuestos,
    resumen: {
      servicioGrabado: (!line.mercancia && impuesto.isEqualTo(0) == false) ? subTotalConDescuento : new BigNumber(0),
      servicioExcento: (!line.mercancia && impuesto.isEqualTo(0)) ? subTotalConDescuento : new BigNumber(0),
      mercanciaGrabada: (line.mercancia && impuesto.isEqualTo(0) == false) ? subTotalConDescuento : new BigNumber(0),
      mercanciaExcenta: (line.mercancia && impuesto.isEqualTo(0)) ? subTotalConDescuento : new BigNumber(0),
      descuento: descuento,
      impuesto: impuesto,
      subtotal: subTotalConDescuento,
      total: subTotalConDescuento.plus(impuesto),
      neto: subtotal
    },
    unitario: {
      //impuesto: Impuesto.toFixed(2),
      descuentoUnitario: descuentoUnitario.toFixed(2)
    },
    precio: precio.toFixed(5),
    cantidad: cantidad.toFixed(5),
    subtotal: subtotal.toFixed(5),
    subTotalConDescuento: subTotalConDescuento.toFixed(5),
    impuesto: impuesto.toFixed(5),
    total: subTotalConDescuento.plus(impuesto).toFixed(5),
    descuento: descuento.toFixed(5)
  };

}
