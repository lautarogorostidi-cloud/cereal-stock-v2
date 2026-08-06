-- ============================================================
-- SISTEMA AGROPECUARIO - MÓDULO STOCK DE CEREAL
-- Migración 001 - Schema completo
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TIPOS ENUMERADOS
-- ============================================================

CREATE TYPE rol_usuario AS ENUM ('admin', 'comercial', 'operario');
CREATE TYPE tipo_movimiento AS ENUM ('cosecha', 'venta', 'entrega', 'transferencia', 'ajuste', 'devolucion');
CREATE TYPE estado_contrato AS ENUM ('borrador', 'activo', 'parcial', 'cumplido', 'cancelado');
CREATE TYPE estado_entrega AS ENUM ('pendiente', 'en_transito', 'entregado', 'rechazado');
CREATE TYPE estado_carta_porte AS ENUM ('emitida', 'en_transito', 'descargada', 'anulada');
CREATE TYPE tipo_precio AS ENUM ('disponible', 'forward', 'mercado_termino', 'fijado');
CREATE TYPE estado_liquidacion AS ENUM ('borrador', 'emitida', 'pagada', 'impugnada');

-- ============================================================
-- TABLA: perfiles de usuario (extiende auth.users de Supabase)
-- ============================================================

CREATE TABLE perfiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  apellido     TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  rol          rol_usuario NOT NULL DEFAULT 'operario',
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  telefono     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: campañas agrícolas
-- ============================================================

CREATE TABLE campanias (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre       TEXT NOT NULL UNIQUE,          -- ej: "2023/24"
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE,
  activa       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: cultivos
-- ============================================================

CREATE TABLE cultivos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre       TEXT NOT NULL UNIQUE,          -- ej: Soja, Maíz, Trigo, Girasol
  codigo       TEXT NOT NULL UNIQUE,          -- ej: SOJ, MAI, TRI, GIR
  activo       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- TABLA: lotes / campos
-- ============================================================

CREATE TABLE lotes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL,
  establecimiento TEXT NOT NULL,
  hectareas      NUMERIC(10,2),
  provincia      TEXT,
  partido        TEXT,
  localidad      TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes / compradores
-- ============================================================

CREATE TABLE clientes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razon_social   TEXT NOT NULL,
  cuit           TEXT UNIQUE,
  tipo           TEXT NOT NULL DEFAULT 'exportador', -- exportador, acopio, industria, particular
  contacto       TEXT,
  email          TEXT,
  telefono       TEXT,
  direccion      TEXT,
  localidad      TEXT,
  provincia      TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: acopios / plantas de almacenamiento
-- ============================================================

CREATE TABLE acopios (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL,
  razon_social   TEXT,
  cuit           TEXT,
  direccion      TEXT,
  localidad      TEXT NOT NULL,
  provincia      TEXT NOT NULL,
  capacidad_ton  NUMERIC(12,2),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: puertos / destinos de exportación
-- ============================================================

CREATE TABLE puertos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL UNIQUE,        -- ej: Rosario, Bahía Blanca, Quequén
  provincia      TEXT NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- TABLA: transportistas / camiones
-- ============================================================

CREATE TABLE transportistas (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL,
  cuit           TEXT UNIQUE,
  patente_camion TEXT,
  patente_acoplado TEXT,
  chofer         TEXT,
  telefono       TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: monedas
-- ============================================================

CREATE TABLE monedas (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo         TEXT NOT NULL UNIQUE,        -- ARS, USD
  nombre         TEXT NOT NULL,
  simbolo        TEXT NOT NULL
);

-- Insertar monedas base
INSERT INTO monedas (codigo, nombre, simbolo) VALUES
  ('ARS', 'Peso Argentino', '$'),
  ('USD', 'Dólar Estadounidense', 'U$D');

-- ============================================================
-- TABLA: tipos de cambio históricos
-- ============================================================

CREATE TABLE tipos_cambio (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha          DATE NOT NULL,
  moneda_origen  TEXT NOT NULL REFERENCES monedas(codigo),
  moneda_destino TEXT NOT NULL REFERENCES monedas(codigo),
  valor          NUMERIC(14,4) NOT NULL,
  fuente         TEXT,                        -- BCRA, dólar blue, etc.
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fecha, moneda_origen, moneda_destino)
);

-- ============================================================
-- TABLA: contratos de venta
-- ============================================================

CREATE TABLE contratos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero           TEXT NOT NULL UNIQUE,
  campania_id      UUID NOT NULL REFERENCES campanias(id),
  cultivo_id       UUID NOT NULL REFERENCES cultivos(id),
  cliente_id       UUID NOT NULL REFERENCES clientes(id),
  fecha_contrato   DATE NOT NULL,
  tipo_precio      tipo_precio NOT NULL DEFAULT 'disponible',
  precio_unitario  NUMERIC(12,4),
  moneda_id        UUID NOT NULL REFERENCES monedas(id),
  toneladas_pactadas NUMERIC(12,3) NOT NULL,
  toneladas_entregadas NUMERIC(12,3) NOT NULL DEFAULT 0,
  puerto_id        UUID REFERENCES puertos(id),
  acopio_id        UUID REFERENCES acopios(id),
  fecha_inicio_entrega DATE,
  fecha_fin_entrega    DATE,
  condiciones      TEXT,
  estado           estado_contrato NOT NULL DEFAULT 'borrador',
  observaciones    TEXT,
  usuario_id       UUID REFERENCES perfiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: cartas de porte
-- ============================================================

CREATE TABLE cartas_porte (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_cpe        TEXT NOT NULL UNIQUE,     -- Código de Trazabilidad de Granos
  campania_id       UUID NOT NULL REFERENCES campanias(id),
  cultivo_id        UUID NOT NULL REFERENCES cultivos(id),
  lote_id           UUID REFERENCES lotes(id),
  contrato_id       UUID REFERENCES contratos(id),
  fecha_emision     DATE NOT NULL,
  fecha_partida     DATE,
  transportista_id  UUID REFERENCES transportistas(id),
  origen_acopio_id  UUID REFERENCES acopios(id),
  destino_acopio_id UUID REFERENCES acopios(id),
  destino_puerto_id UUID REFERENCES puertos(id),
  toneladas_origen  NUMERIC(12,3) NOT NULL,
  toneladas_destino NUMERIC(12,3),
  humedad_origen    NUMERIC(5,2),
  humedad_destino   NUMERIC(5,2),
  proteina          NUMERIC(5,2),
  gluten            NUMERIC(5,2),
  peso_hectolitrico NUMERIC(5,2),
  zaranda           NUMERIC(5,2),
  bonificacion_calidad NUMERIC(8,4) DEFAULT 0,
  merma_humedad     NUMERIC(12,3) DEFAULT 0,
  toneladas_netas   NUMERIC(12,3),
  estado            estado_carta_porte NOT NULL DEFAULT 'emitida',
  observaciones     TEXT,
  usuario_id        UUID REFERENCES perfiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: movimientos de cereal (tabla central)
-- ============================================================

CREATE TABLE movimientos_cereal (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo              tipo_movimiento NOT NULL,
  fecha             DATE NOT NULL,
  campania_id       UUID NOT NULL REFERENCES campanias(id),
  cultivo_id        UUID NOT NULL REFERENCES cultivos(id),
  lote_id           UUID REFERENCES lotes(id),
  toneladas         NUMERIC(12,3) NOT NULL,
  humedad           NUMERIC(5,2),
  proteina          NUMERIC(5,2),
  gluten            NUMERIC(5,2),
  peso_hectolitrico NUMERIC(5,2),
  cliente_id        UUID REFERENCES clientes(id),
  acopio_origen_id  UUID REFERENCES acopios(id),
  acopio_destino_id UUID REFERENCES acopios(id),
  puerto_id         UUID REFERENCES puertos(id),
  contrato_id       UUID REFERENCES contratos(id),
  carta_porte_id    UUID REFERENCES cartas_porte(id),
  precio_unitario   NUMERIC(12,4),
  moneda_id         UUID REFERENCES monedas(id),
  tipo_cambio       NUMERIC(14,4),
  precio_usd        NUMERIC(12,4),
  flete             NUMERIC(12,4) DEFAULT 0,
  secado            NUMERIC(12,4) DEFAULT 0,
  paritaria         NUMERIC(12,4) DEFAULT 0,
  otros_gastos      NUMERIC(12,4) DEFAULT 0,
  resultado_neto    NUMERIC(14,4),
  observaciones     TEXT,
  usuario_id        UUID NOT NULL REFERENCES perfiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: liquidaciones
-- ============================================================

CREATE TABLE liquidaciones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero            TEXT NOT NULL UNIQUE,
  contrato_id       UUID NOT NULL REFERENCES contratos(id),
  carta_porte_id    UUID REFERENCES cartas_porte(id),
  fecha_liquidacion DATE NOT NULL,
  toneladas         NUMERIC(12,3) NOT NULL,
  precio_unitario   NUMERIC(12,4) NOT NULL,
  moneda_id         UUID NOT NULL REFERENCES monedas(id),
  tipo_cambio       NUMERIC(14,4),
  bruto_pesos       NUMERIC(16,2),
  bruto_usd         NUMERIC(16,2),
  descuento_humedad NUMERIC(12,4) DEFAULT 0,
  descuento_calidad NUMERIC(12,4) DEFAULT 0,
  flete             NUMERIC(12,4) DEFAULT 0,
  secado            NUMERIC(12,4) DEFAULT 0,
  paritaria         NUMERIC(12,4) DEFAULT 0,
  otros_descuentos  NUMERIC(12,4) DEFAULT 0,
  neto_pesos        NUMERIC(16,2),
  neto_usd          NUMERIC(16,2),
  estado            estado_liquidacion NOT NULL DEFAULT 'borrador',
  fecha_pago        DATE,
  observaciones     TEXT,
  usuario_id        UUID REFERENCES perfiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: precios de referencia (histórico de mercado)
-- ============================================================

CREATE TABLE precios_referencia (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha          DATE NOT NULL,
  cultivo_id     UUID NOT NULL REFERENCES cultivos(id),
  tipo_precio    tipo_precio NOT NULL,
  plaza          TEXT NOT NULL DEFAULT 'Rosario',
  precio         NUMERIC(12,4) NOT NULL,
  moneda_id      UUID NOT NULL REFERENCES monedas(id),
  fuente         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fecha, cultivo_id, tipo_precio, plaza)
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================

CREATE INDEX idx_movimientos_campania ON movimientos_cereal(campania_id);
CREATE INDEX idx_movimientos_cultivo ON movimientos_cereal(cultivo_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_cereal(fecha);
CREATE INDEX idx_movimientos_tipo ON movimientos_cereal(tipo);
CREATE INDEX idx_movimientos_contrato ON movimientos_cereal(contrato_id);
CREATE INDEX idx_contratos_campania ON contratos(campania_id);
CREATE INDEX idx_contratos_cliente ON contratos(cliente_id);
CREATE INDEX idx_contratos_estado ON contratos(estado);
CREATE INDEX idx_cartas_porte_contrato ON cartas_porte(contrato_id);
CREATE INDEX idx_cartas_porte_fecha ON cartas_porte(fecha_emision);

-- ============================================================
-- VISTA: stock actual por campaña y cultivo
-- ============================================================

CREATE OR REPLACE VIEW vw_stock_actual AS
SELECT
  c.nombre AS campania,
  cu.nombre AS cultivo,
  cu.codigo AS cultivo_codigo,
  -- Toneladas ingresadas (cosecha)
  COALESCE(SUM(CASE WHEN m.tipo = 'cosecha' THEN m.toneladas ELSE 0 END), 0) AS ton_cosechadas,
  -- Toneladas vendidas (contratos firmados)
  COALESCE(SUM(CASE WHEN m.tipo = 'venta' THEN m.toneladas ELSE 0 END), 0) AS ton_vendidas,
  -- Toneladas entregadas (con carta de porte)
  COALESCE(SUM(CASE WHEN m.tipo = 'entrega' THEN m.toneladas ELSE 0 END), 0) AS ton_entregadas,
  -- Stock físico = cosechado - entregado
  COALESCE(SUM(CASE WHEN m.tipo = 'cosecha' THEN m.toneladas
                    WHEN m.tipo = 'entrega' THEN -m.toneladas
                    WHEN m.tipo = 'devolucion' THEN m.toneladas
                    ELSE 0 END), 0) AS stock_fisico,
  -- Stock vendido no entregado = vendido - entregado
  COALESCE(SUM(CASE WHEN m.tipo = 'venta' THEN m.toneladas
                    WHEN m.tipo = 'entrega' THEN -m.toneladas
                    ELSE 0 END), 0) AS ton_comprometidas,
  -- Stock disponible = stock físico - comprometido
  COALESCE(SUM(CASE WHEN m.tipo = 'cosecha' THEN m.toneladas
                    WHEN m.tipo = 'venta' THEN -m.toneladas
                    WHEN m.tipo = 'devolucion' THEN m.toneladas
                    ELSE 0 END), 0) AS stock_disponible
FROM campanias c
CROSS JOIN cultivos cu
LEFT JOIN movimientos_cereal m ON m.campania_id = c.id AND m.cultivo_id = cu.id
GROUP BY c.id, c.nombre, cu.id, cu.nombre, cu.codigo
HAVING COALESCE(SUM(m.toneladas), 0) > 0
ORDER BY c.nombre DESC, cu.nombre;

-- ============================================================
-- VISTA: posición comercial por contrato
-- ============================================================

CREATE OR REPLACE VIEW vw_posicion_contratos AS
SELECT
  co.numero,
  co.fecha_contrato,
  cl.razon_social AS cliente,
  cu.nombre AS cultivo,
  ca.nombre AS campania,
  co.tipo_precio,
  co.precio_unitario,
  mo.codigo AS moneda,
  co.toneladas_pactadas,
  co.toneladas_entregadas,
  (co.toneladas_pactadas - co.toneladas_entregadas) AS toneladas_pendientes,
  ROUND((co.toneladas_entregadas / NULLIF(co.toneladas_pactadas, 0)) * 100, 1) AS pct_cumplimiento,
  co.estado,
  co.fecha_fin_entrega
FROM contratos co
JOIN clientes cl ON cl.id = co.cliente_id
JOIN cultivos cu ON cu.id = co.cultivo_id
JOIN campanias ca ON ca.id = co.campania_id
JOIN monedas mo ON mo.id = co.moneda_id
ORDER BY co.fecha_contrato DESC;

-- ============================================================
-- VISTA: resultado comercial
-- ============================================================

CREATE OR REPLACE VIEW vw_resultado_comercial AS
SELECT
  ca.nombre AS campania,
  cu.nombre AS cultivo,
  COUNT(m.id) AS cantidad_operaciones,
  SUM(m.toneladas) AS ton_totales,
  AVG(m.precio_unitario) AS precio_promedio,
  SUM(m.toneladas * m.precio_unitario) AS ingreso_bruto,
  SUM(COALESCE(m.flete, 0) + COALESCE(m.secado, 0) + COALESCE(m.paritaria, 0) + COALESCE(m.otros_gastos, 0)) AS total_gastos,
  SUM(COALESCE(m.resultado_neto, 0)) AS resultado_neto,
  mo.codigo AS moneda
FROM movimientos_cereal m
JOIN campanias ca ON ca.id = m.campania_id
JOIN cultivos cu ON cu.id = m.cultivo_id
LEFT JOIN monedas mo ON mo.id = m.moneda_id
WHERE m.tipo IN ('venta', 'entrega')
GROUP BY ca.id, ca.nombre, cu.id, cu.nombre, mo.id, mo.codigo
ORDER BY ca.nombre DESC, cu.nombre;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_cereal ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartas_porte ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acopios ENABLE ROW LEVEL SECURITY;
ALTER TABLE puertos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_referencia ENABLE ROW LEVEL SECURITY;

-- Función helper para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS rol_usuario AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas: todos los usuarios autenticados pueden leer datos maestros
CREATE POLICY "Lectura abierta a autenticados" ON campanias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON cultivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON lotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON acopios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON puertos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON transportistas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON monedas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON tipos_cambio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura abierta a autenticados" ON precios_referencia FOR SELECT TO authenticated USING (true);

-- Políticas: movimientos - todos leen, admin y comercial escriben
CREATE POLICY "Leer movimientos" ON movimientos_cereal FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertar movimientos" ON movimientos_cereal FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'comercial', 'operario'));
CREATE POLICY "Editar movimientos propios o admin" ON movimientos_cereal FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'admin');
CREATE POLICY "Eliminar solo admin" ON movimientos_cereal FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');

-- Políticas: contratos - admin y comercial gestionan
CREATE POLICY "Leer contratos" ON contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar contratos" ON contratos FOR ALL TO authenticated
  USING (get_user_rol() IN ('admin', 'comercial'))
  WITH CHECK (get_user_rol() IN ('admin', 'comercial'));

-- Políticas: cartas de porte - todos insertan, admin edita/elimina
CREATE POLICY "Leer cartas porte" ON cartas_porte FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertar cartas porte" ON cartas_porte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Editar cartas porte" ON cartas_porte FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'admin');
CREATE POLICY "Eliminar cartas porte admin" ON cartas_porte FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');

-- Políticas: liquidaciones - solo admin y comercial
CREATE POLICY "Leer liquidaciones" ON liquidaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestionar liquidaciones" ON liquidaciones FOR ALL TO authenticated
  USING (get_user_rol() IN ('admin', 'comercial'))
  WITH CHECK (get_user_rol() IN ('admin', 'comercial'));

-- Políticas: perfiles - cada usuario ve el suyo; admin ve todos
CREATE POLICY "Ver perfil propio" ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_user_rol() = 'admin');
CREATE POLICY "Editar perfil propio" ON perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_user_rol() = 'admin');

-- Políticas: datos maestros - solo admin puede modificar
CREATE POLICY "Admin modifica campanias" ON campanias FOR ALL TO authenticated
  USING (get_user_rol() = 'admin') WITH CHECK (get_user_rol() = 'admin');
CREATE POLICY "Admin modifica cultivos" ON cultivos FOR ALL TO authenticated
  USING (get_user_rol() = 'admin') WITH CHECK (get_user_rol() = 'admin');
CREATE POLICY "Admin modifica clientes" ON clientes FOR ALL TO authenticated
  USING (get_user_rol() = 'admin') WITH CHECK (get_user_rol() = 'admin');

-- ============================================================
-- FUNCIÓN: crear perfil automáticamente al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, apellido, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'operario')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimientos_updated_at BEFORE UPDATE ON movimientos_cereal FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contratos_updated_at BEFORE UPDATE ON contratos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cartas_porte_updated_at BEFORE UPDATE ON cartas_porte FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_liquidaciones_updated_at BEFORE UPDATE ON liquidaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCIÓN: calcular resultado neto de un movimiento
-- ============================================================

CREATE OR REPLACE FUNCTION calcular_resultado_neto()
RETURNS TRIGGER AS $$
BEGIN
  NEW.resultado_neto = (
    NEW.toneladas * COALESCE(NEW.precio_unitario, 0)
  ) - (
    COALESCE(NEW.flete, 0) +
    COALESCE(NEW.secado, 0) +
    COALESCE(NEW.paritaria, 0) +
    COALESCE(NEW.otros_gastos, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calcular_resultado BEFORE INSERT OR UPDATE ON movimientos_cereal
  FOR EACH ROW EXECUTE FUNCTION calcular_resultado_neto();

-- ============================================================
-- DATOS INICIALES DE EJEMPLO
-- ============================================================

INSERT INTO campanias (nombre, fecha_inicio, fecha_fin, activa) VALUES
  ('2022/23', '2022-07-01', '2023-06-30', FALSE),
  ('2023/24', '2023-07-01', '2024-06-30', FALSE),
  ('2024/25', '2024-07-01', '2025-06-30', TRUE);

INSERT INTO cultivos (nombre, codigo) VALUES
  ('Soja', 'SOJ'),
  ('Maíz', 'MAI'),
  ('Trigo', 'TRI'),
  ('Girasol', 'GIR'),
  ('Sorgo', 'SOR'),
  ('Cebada', 'CEB');

INSERT INTO puertos (nombre, provincia) VALUES
  ('Rosario', 'Santa Fe'),
  ('Bahía Blanca', 'Buenos Aires'),
  ('Quequén', 'Buenos Aires'),
  ('San Lorenzo', 'Santa Fe'),
  ('Villa Constitución', 'Santa Fe');

-- Cultivos adicionales
INSERT INTO cultivos (nombre, codigo) VALUES
  ('Soja 1', 'SOJ1'),
  ('Soja 2', 'SOJ2'),
  ('Maíz Temprano', 'MAIT'),
  ('Maíz 2', 'MAI2'),
  ('Maíz Tardío', 'MAIX'),
  ('Girasol', 'GIR'),
  ('Centeno', 'CEN'),
  ('Vicia', 'VIC'),
  ('Alfalfa', 'ALF')
ON CONFLICT (codigo) DO NOTHING;
