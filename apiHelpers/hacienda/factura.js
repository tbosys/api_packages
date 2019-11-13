var TipoCedula = require("./tipoCedula");
var Line = require("./line");
var Resumen = require("./resumen");
var moment = require("moment-timezone");


module.exports = function (firma, orden) {
  var fechaYa = moment().format();
  var location = firma.location.split(",");

  var lines = orden.ordenLinea.map(function (line, index) {
    line.NumeroLinea = index + 1;
    return Line(line);
  })

  var json = {
    "@": {
      "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xmlns": "https://tribunet.hacienda.go.cr/docs/esquemas/2017/v4.2/facturaElectronica"
    },
    Clave: factura.clave,
    NumeroConsecutivo: factura.consecutivo,
    FechaEmision: fechaYa,
    Emisor: {
      Nombre: firma.name,
      Identificacion: {
        Tipo: TipoCedula(firma.cedula),
        Numero: firma.cedula.pad(12)
      },
      Ubicacion: {
        Provincia: location[0],
        Canton: location[1],
        Distrito: location[2],
        Barrio: "01",
        OtrasSenas: "Costa Rica"
      },
      CorreoElectronico: firma.cedula + "@efactura.io"
    }
  }

  if (factura.cliente) json["Receptor"] = {
    Nombre: factura.cliente.nombre,
    Identificacion: {
      Cedula: factura.cedula,
      Tipo: TipoCedula(factura.cedula)
    }
  };

  var json2 = {
    "CondicionVenta": factura.condicionVenta || "01",
    "PlazoCredito": factura.plazoCredito || "00",
    "MedioPago": factura.modoPago || "04",
    DetalleServicio: {
      "LineaDetalle": lines.map(function (line, index) {

        var a = {
          "NumeroLinea": index.toString(),
          "Codigo": {
            "Tipo": line.tipo || "04",
            "Codigo": line.codigo
          },
          "Cantidad": line.cantidad,
          "UnidadMedida": line.medida,
          "Detalle": line.detalle,
          "PrecioUnitario": line.precio,
          "MontoTotal": line.subtotal
        }

        if (line.descuento && line.descuento != "0.00000") {
          a.MontoDescuento = line.descuento;
          a.NaturalezaDescuento = line.detalleDescuento || "Cliente Frecuente";
        }

        a.SubTotal = line.subTotalConDescuento;
        a.Impuesto = line.impuestos;
        a.MontoTotalLinea = line.total

        return a;
      })
    },
    ResumenFactura: Resumen(lines, factura.moneda, factura.tipoCambio),
    Normativa: {
      NumeroResolucion: "DGT-R-48-2016",
      FechaResolucion: "20-02-2017 13:22:22"
    }
  }

  return Object.assign({}, json, json2)

}
