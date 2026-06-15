# Baratza SRL — App Agropecuaria

**URL:** https://cereal-stock.vercel.app  
**Repo:** `lautarogorostidi-cloud/cereal-stock-v2`  
**Stack:** Next.js 14 + Supabase + TypeScript + Tailwind CSS

---

## Módulos

### 🌾 Seguimiento Agronómico (`/seguimiento`)
- **Dashboard** — KPIs por campaña
- **Lotes / Cultivos** — tabla por lote o por cultivo, selector de campaña y campo, Ha acondicionadas
- **Ficha de ciclo** — acondicionamiento, siembra, aplicaciones, fertilizaciones, cosecha, costos fijos (todos con editar/borrar, recarga automática al cerrar formularios hijos)

### 🌽 Stock Cereal (`/dashboard`)
- **Dashboard** — stock y comprometido calculado desde movimientos reales
- **Ventas** — con bonificación
- **Contratos** — toneladas entregadas desde movimientos reales (`vw_posicion_contratos`)
- **Cartas de Porte** — extracción automática PDF con tarifa de flete

### 🧪 Agroquímicos (`/agroquimicos`)
- **Dashboard** — KPIs + gráfico mensual de costos (insumos + servicio pulverización) con filtros por año y tipo de producto
- **Stock** — stock actual con alerta inteligente al 10% del uso histórico, buscador
- **Movimientos** — compras/aplicaciones/devoluciones con editar/borrar, filtro campaña, buscador, agregar producto/proveedor nuevo inline, campaña en todos los tipos
- **Aplicaciones** — detalle de todo lo aplicado desde Seguimiento Agronómico, filtro campaña, resumen por producto
- **Productos** — catálogo

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

### Mapeo tipo laboreo → tipo servicio tarifario
| Tipo laboreo | Tipo servicio |
|---|---|
| Cincel, Subsolador, Arado, Rotovator | Acondicionado |
| Rastra de disco | Rastra y Rolo |
| Rolo Triturador | Rolo Triturador |

### Tablas Agroquímicos
| Tabla | Descripción |
|-------|-------------|
| `agroquimicos_productos` | Catálogo (tipo constraint: herbicida, fungicida, insecticida, acaricida, curasemilla, coadyuvante, otro — en minúscula) |
| `agroquimicos_movimientos` | Movimientos: tipo, fecha, cantidad, campaña, proveedor_id, precio_unitario, numero_remito, numero_factura |

### Vistas
| Vista | Descripción |
|-------|-------------|
| `vw_sa_resumen_ciclo` | Resumen por ciclo con costos calculados |
| `vw_sa_costos_campana` | Costos agregados por campaña |
| `vw_posicion_contratos` | Toneladas entregadas calculadas desde movimientos reales |
| `vw_comprometido` | Toneladas pendientes desde movimientos reales |
| `vw_stock_agroquimicos` | Stock total histórico por producto |

### Tablas Cereal
- `movimientos_cereal` (con `bonificacion_calidad`)
- `contratos` (con `bonificacion_calidad`)
- `cartas_porte` (con `tarifa_flete`)

---

## Estructura de Archivos Clave

```
src/
  app/
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
      cartas-de-porte/nueva/page.tsx
    agroquimicos/
      page.tsx                          # Dashboard con gráfico mensual + filtros año/tipo
      stock/page.tsx                    # Stock con alerta 10% histórico + buscador
      movimientos/page.tsx              # Movimientos completo con editar/borrar
      aplicaciones/page.tsx             # Aplicaciones desde seguimiento agronómico
      productos/page.tsx
    api/
      extraer-cpe/route.ts              # Extrae tarifa_flete del PDF
  components/
    layout/
      SidebarAgroquimicos.tsx           # Con link Aplicaciones
```

---

## Tarifario — Integración ✅ COMPLETA

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
GRANT INSERT, UPDATE, DELETE ON sa_acondicionamiento TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_acondicionamiento_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sa_cosechas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_cosechas_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sa_costos_fijos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_costos_fijos_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sa_fertilizaciones TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sa_fertilizaciones_id_seq TO authenticated;
GRANT INSERT, UPDATE, DELETE ON agroquimicos_movimientos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agroquimicos_movimientos_id_seq TO authenticated;
GRANT INSERT ON agroquimicos_productos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agroquimicos_productos_id_seq TO authenticated;
GRANT INSERT ON proveedores TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE proveedores_id_seq TO authenticated;
CREATE POLICY "authenticated can select agroquimicos_movimientos" ON agroquimicos_movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can select agroquimicos_productos" ON agroquimicos_productos FOR SELECT TO authenticated USING (true);
```

---

## ✅ Completado

- Todos los formularios seguimiento agronómico con tarifario integrado
- Ficha ciclo con recarga automática
- `vw_posicion_contratos` y `vw_comprometido` calculan desde movimientos reales
- Extracción tarifa flete en CPE
- Módulo agroquímicos: stock, movimientos, aplicaciones desde seguimiento, dashboard con gráfico
- Campañas: 23-24, 24-25, 25-26, 26-27

## 🔲 Pendiente

1. **Dashboard agroquímicos** — corregir filtro de años (muestra campañas en lugar de años), identificar productos "Otros" (nombres no coinciden entre seguimiento y catálogo), meses sin costo de servicio
2. **Vinculación Seguimiento ↔ Agroquímicos** — al cargar aplicación en seguimiento, descontar automáticamente del stock
3. **Editar aplicación** — integrar tarifario en formulario de edición
4. **FIFO de insumos** — agregar `cantidad` al tarifario y calcular precio por lote
5. **Módulo Costos** — `/seguimiento/costos/` con análisis por campaña
6. **Módulo Reportes** — `/seguimiento/reportes/`
7. **Dashboard Seguimiento** — KPIs del Power BI

---

*Última actualización: Junio 2026*
