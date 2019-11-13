var BigNumber = require('bignumber.js');

module.exports = function (lineas, moneda, tipoCambio) {

  var resumen = {
    servicioGrabado: new BigNumber(0),
    servicioExcento: new BigNumber(0),
    mercanciaGrabada: new BigNumber(0),
    mercanciaExcenta: new BigNumber(0),
    grabado: new BigNumber(0),
    excento: new BigNumber(0),
    descuento: new BigNumber(0),
    venta: new BigNumber(0),
    descuento: new BigNumber(0),
    neto: new BigNumber(0),
    impuesto: new BigNumber(0),
    total: new BigNumber(0)
  }

  lineas.forEach(function (linea) {

    resumen.servicioGrabado = resumen.servicioGrabado.plus(linea.resumen.servicioGrabado);
    resumen.servicioExcento = resumen.servicioExcento.plus(linea.resumen.servicioExcento);
    resumen.mercanciaExcenta = resumen.mercanciaExcenta.plus(linea.resumen.mercanciaExcenta);
    resumen.mercanciaGrabada = resumen.mercanciaGrabada.plus(linea.resumen.mercanciaGrabada);
    resumen.grabado = resumen.grabado.plus(resumen.mercanciaGrabada).plus(resumen.servicioGrabado);
    resumen.excento = resumen.excento.plus(resumen.mercanciaExcenta).plus(resumen.servicioExcento);
    resumen.venta = resumen.venta.plus(linea.subtotal);
    resumen.descuento = resumen.descuento.plus(linea.descuento);
    resumen.neto = resumen.neto.plus(linea.resumen.neto);
    resumen.impuesto = resumen.impuesto.plus(linea.impuesto);
    resumen.total = resumen.total.plus(linea.total);
  })

  var result = {
    "CodigoMoneda": moneda || "CRC",
    "TotalServGravados": resumen.servicioGrabado.toFixed(5),
    "TotalServExentos": resumen.servicioExcento.toFixed(5),
    "TotalMercanciasGravadas": resumen.mercanciaGrabada.toFixed(5),
    "TotalMercanciasExentas": resumen.mercanciaExcenta.toFixed(5),
    "TotalGravado": resumen.grabado.toFixed(5),
    "TotalExento": resumen.excento.toFixed(5),
    "TotalVenta": resumen.venta.toFixed(5),
    "TotalDescuentos": resumen.descuento.toFixed(5),
    "TotalVentaNeta": resumen.neto.toFixed(5),
    "TotalImpuesto": resumen.impuesto.toFixed(5),
    "TotalComprobante": resumen.total.toFixed(5)
  };

  if (tipoCambio) result["TipoCambio"] = tipoCambio;
  return result;

}
