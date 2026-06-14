# Baratza SRL — App Agropecuaria

**URL:** https://cereal-stock.vercel.app  
**Repo:** `lautarogorostidi-cloud/cereal-stock-v2`  
**Stack:** Next.js 14 + Supabase + TypeScript + Tailwind CSS

---

## Módulos

### 🌾 Seguimiento Agronómico (`/seguimiento`)
- **Dashboard** — KPIs por campaña
- **Lotes / Cultivos** — tabla por lote o por cultivo, selector de campaña y campo, columna Ha acondicionadas
- **Ficha de ciclo** — acondicionamiento, siembra, aplicaciones, fertilizaciones, cosecha, costos fijos (todos con editar/borrar). Recarga automática al cerrar formularios hijos.

### 🌽 Stock Cereal (`/dashboard`)
- **Dashboard** — stock, comprometido (calculado desde movimientos reales)
- **Ventas** — liquidación por entrega con bonificación
- **Contratos** — toneladas entregadas calculadas desde movimientos reales
- **Stock, Entregas, Cartas de Porte** — extracción automática desde PDF con tarifa de flete

### 🧪 Agroquímicos (`/dashboard/agroquimicos`)
- **Stock** — filtro por campaña y buscador, stock actual calculado desde movimientos
- **Movimientos** — compras, aplicaciones, devoluciones con editar/borrar, filtro por campaña, buscador, agregar producto/proveedor nuevo inline
- **Productos** — catálogo de agroquímicos

---

## Base de Datos (Supabase)

### Tablas Seguimiento Agronómico
| Tabla | Descripción |
|-------|-------------|
| `sa_ciclos` | Ciclo productivo por lote y campaña |
| `sa_siembras` | Siembra: híbridos, densidad, fertilizantes, costos |
| `sa_aplicaciones` | Aplicaciones fitosanitarias |
| `sa_aplicacion_productos` | Productos por aplicación (dosis, costo, unidad) |
| `sa_fertilizaciones` | Fertilizaciones independientes |
| `sa_cosechas` | Cosecha: rinde, superficie, humedad, costo |
| `sa_costos_fijos` | Arrendamiento, asesoramiento, seguro, otro |
| `sa_acondicionamiento` | Laboreo de suelo |
| `tarifario_insumos` | 185 registros: tipo_insumo, insumo, fecha_vigencia, precio_usd, unidad |
| `tarifario_servicios` | 92 registros: tipo_servicio, cultivo, vigencia_desde, costo_usd_ha |

### Tipos de servicio en tarifario_servicios
`Acondicionado`, `Cosecha`, `Fertilización`, `Hilerada`, `Pulverización`, `Rastra y Rolo`, `Rolo Triturador`, `RS-SD`, `SD`, `SD c/DF`, `Siembra`, `Siembra Altina`

### Tipos de insumo en agroquimicos_productos (constraint)
`herbicida`, `fungicida`, `insecticida`, `acaricida`, `curasemilla`, `coadyuvante`, `otro` (todos en minúscula)

### Vistas SA
| Vista | Descripción |
|-------|-------------|
| `vw_sa_resumen_ciclo` | Resumen por ciclo con costos calculados y `lote_id` |
| `vw_sa_costos_campana` | Costos agregados por campaña |

### Vistas Cereal
| Vista | Descripción |
|-------|-------------|
| `vw_posicion_contratos` | Calcula toneladas entregadas desde movimientos reales |
| `vw_comprometido` | Calcula toneladas pendientes desde movimientos reales |
| `vw_stock_actual` | Stock cereal actual |
| `vw_stock_agroquimicos` | Stock agroquímicos total histórico |

### Tablas Cereal
- `movimientos_cereal` (con `bonificacion_calidad`)
- `contratos` (con `bonificacion_calidad`)
- `cartas_porte` (con `tarifa_flete`)

### Tablas Agroquímicos
- `agroquimicos_productos` (id, nombre, marca, tipo, unidad, proveedor_id, stock_minimo, activo)
- `agroquimicos_movimientos` (id, producto_id, tipo, fecha, cantidad, lote, cultivo, campaña, proveedor_id, precio_unitario, numero_remito, numero_factura, observaciones)

---

## Estructura de Archivos Clave

```
src/app/
  seguimiento/
    page.tsx                          # Dashboard seguimiento
    lotes/
      page.tsx                        # Lista lotes/cultivos
      nuevo/page.tsx                  # Crear/editar ciclo
      [ciclo_id]/
        page.tsx                      # Ficha del ciclo ✅
        acondicionamiento/page.tsx    # ✅ + tarifario (según tipo laboreo)
        siembra/page.tsx              # ✅ + tarifario (semilla por cultivo, fertilizantes, servicio por sistema+cultivo)
        fertilizaciones/page.tsx      # ✅ + tarifario
        cosecha/page.tsx              # ✅ + tarifario
        costos-fijos/page.tsx         # ✅
        aplicaciones/
          nueva/page.tsx              # ✅ + tarifario (selector por tipo, precio vigente)
  dashboard/
    page.tsx                          # Dashboard cereal
    ventas/page.tsx + VentasClient.tsx
    contratos/nuevo/page.tsx
    contratos/editar/editarContratoForm.tsx
    cartas-de-porte/nueva/page.tsx    # Extracción PDF con tarifa_flete
    agroquimicos/
      stock/page.tsx                  # Client component con filtro campaña y buscador
      movimientos/page.tsx            # Editar/borrar, nuevo producto/proveedor inline
  api/
    extraer-cpe/route.ts              # Extrae tarifa_flete del PDF
```

---

## Tarifario — Integración ✅ COMPLETA

### Mapeo tipo laboreo → tipo servicio
| Tipo laboreo | Tipo servicio tarifario |
|---|---|
| Cincel, Subsolador, Arado, Rotovator | Acondicionado |
| Rastra de disco | Rastra y Rolo |
| Rolo Triturador | Rolo Triturador |

### Por formulario
| Formulario | Insumo | Servicio |
|---|---|---|
| Nueva aplicación | Herbicida/Fungicida/Insecticida/Coadyuvante | Pulverización |
| Siembra | Semilla por cultivo, Fertilizante | SD/SD c/DF/Siembra según sistema+cultivo |
| Fertilizaciones | Fertilizante | Fertilización |
| Acondicionamiento | — | Según tipo de laboreo |
| Cosecha | — | Cosecha |

---

## Permisos Supabase ejecutados

```sql
-- Seguimiento
GRANT INSERT, UPDATE, DELETE ON sa_acondicionamiento TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_acondicionamiento_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sa_cosechas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_cosechas_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sa_costos_fijos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_costos_fijos_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sa_fertilizaciones TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_fertilizaciones_id_seq TO authenticated;
-- Agroquímicos
GRANT INSERT ON agroquimicos_productos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agroquimicos_productos_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON agroquimicos_movimientos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agroquimicos_movimientos_id_seq TO authenticated;
CREATE POLICY "authenticated can select agroquimicos_movimientos" ON agroquimicos_movimientos FOR SELECT TO authenticated USING (true);
```

---

## ✅ Completado

- Todos los formularios seguimiento agronómico con tarifario integrado
- Ficha ciclo con recarga automática
- Lotes/Cultivos con Ha acondicionadas y rinde desde `rinde_kg_total`
- `vw_posicion_contratos` y `vw_comprometido` calculan desde movimientos reales
- Extracción tarifa flete en CPE
- Módulo agroquímicos con stock, movimientos (editar/borrar), filtro campaña, buscador
- Campañas: 23-24, 24-25, 25-26, 26-27

## 🔲 Pendiente

1. **Vinculación Seguimiento ↔ Agroquímicos** — al cargar aplicación en seguimiento, descontar automáticamente del stock de agroquímicos
2. **Editar aplicación** — integrar tarifario en formulario de edición
3. **FIFO de insumos** — agregar `cantidad` al tarifario y calcular precio por lote
4. **Módulo Costos** — `/seguimiento/costos/` con análisis por campaña
5. **Módulo Reportes** — `/seguimiento/reportes/`
6. **Dashboard Seguimiento** — KPIs del Power BI

---

*Última actualización: Junio 2026*
