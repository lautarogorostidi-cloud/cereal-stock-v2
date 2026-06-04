DROP VIEW vw_resultado_comercial;

CREATE OR REPLACE VIEW vw_resultado_comercial AS
SELECT
  ca.nombre AS campania,
  cu.nombre AS cultivo,
  cl.razon_social AS cliente,
  co.numero AS contrato,
  cp.ctg,
  m.fecha,
  cp.nro_turno,
  cp.patente_camion,
  cp.patente_acoplado,
  cp.chofer_nombre,
  cp.destino_localidad,
  cp.destino_provincia,
  m.toneladas AS ton_totales,
  cp.tarifa_flete,
  m.toneladas * COALESCE(cp.tarifa_flete, 0) AS total_flete,
  co.precio_unitario AS precio_base,
  co.precio_plus AS plus,
  co.comision_corredor AS comision_pct,
  cp.bonificacion_calidad AS bonificacion_pct,
  m.toneladas * co.precio_unitario * COALESCE(cp.bonificacion_calidad, 0) / 100 AS bonificacion_usd_total,
  m.toneladas * (co.precio_unitario + COALESCE(co.precio_plus, 0)) * COALESCE(co.comision_corredor, 0) / 100 AS comision_total,
  m.toneladas * (
    co.precio_unitario +
    (co.precio_unitario * COALESCE(cp.bonificacion_calidad, 0) / 100) +
    COALESCE(co.precio_plus, 0) -
    ((co.precio_unitario + COALESCE(co.precio_plus, 0)) * COALESCE(co.comision_corredor, 0) / 100) -
    COALESCE(cp.tarifa_flete, 0)
  ) AS ingreso_neto_total,
  (
    co.precio_unitario +
    (co.precio_unitario * COALESCE(cp.bonificacion_calidad, 0) / 100) +
    COALESCE(co.precio_plus, 0) -
    ((co.precio_unitario + COALESCE(co.precio_plus, 0)) * COALESCE(co.comision_corredor, 0) / 100) -
    COALESCE(cp.tarifa_flete, 0)
  ) AS precio_neto_promedio
FROM movimientos_cereal m
JOIN campanias ca ON ca.id = m.campania_id
JOIN cultivos cu ON cu.id = m.cultivo_id
JOIN contratos co ON co.id = m.contrato_id
JOIN clientes cl ON cl.id = co.cliente_id
LEFT JOIN cartas_porte cp ON cp.id = m.carta_porte_id
WHERE m.tipo = 'entrega'
AND m.contrato_id IS NOT NULL
ORDER BY m.fecha DESC;

GRANT SELECT ON vw_resultado_comercial TO anon, authenticated;