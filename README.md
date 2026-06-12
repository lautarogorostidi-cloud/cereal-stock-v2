# Baratza SRL — App Agropecuaria

**URL:** https://cereal-stock.vercel.app  
**Repo:** `lautarogorostidi-cloud/cereal-stock-v2`  
**Stack:** Next.js 14 + Supabase + TypeScript + Tailwind CSS

---

## Módulos

### 🌾 Seguimiento Agronómico (`/seguimiento`)
- **Dashboard** — KPIs por campaña: lotes, superficie, producción, costo total
- **Lotes / Cultivos** — tabla por lote o por cultivo, con selector de campaña y campo
- **Ficha de ciclo** — acondicionamiento, siembra, aplicaciones, fertilizaciones, cosecha, costos fijos

### 🌽 Stock Cereal (`/dashboard`)
- **Ventas** — liquidación por entrega con bonificación
- **Contratos** — con bonificación calidad
- **Stock, Entregas, Cartas de Porte, Reportes**

---

## Base de Datos (Supabase)

### Tablas Seguimiento Agronómico
| Tabla | Descripción |
|-------|-------------|
| `sa_ciclos` | Ciclo productivo por lote y campaña |
| `sa_siembras` | Siembra: híbridos, densidad, fertilizantes en siembra, costos |
| `sa_aplicaciones` | Aplicaciones fitosanitarias |
| `sa_aplicacion_productos` | Productos por aplicación (dosis, costo) |
| `sa_fertilizaciones` | Fertilizaciones independientes |
| `sa_cosechas` | Cosecha: rinde, superficie, costo |
| `sa_costos_fijos` | Arrendamiento, asesoramiento, seguro |
| `sa_acondicionamiento` | Laboreo de suelo |
| `sa_resiembras` | Resiembras |
| `tarifario_insumos` | 185 registros: producto, fecha vigencia, precio USD |
| `tarifario_servicios` | 92 registros: tipo servicio, cultivo, fecha, costo USD/ha |

### Vistas
| Vista | Descripción |
|-------|-------------|
| `vw_sa_resumen_ciclo` | Resumen por ciclo con costos calculados y `lote_id` |
| `vw_sa_costos_campana` | Costos agregados por campaña |

### Tablas Cereal
- `movimientos_cereal` (con `bonificacion_calidad`)
- `contratos` (con `bonificacion_calidad`)
- `cartas_porte`, `entregas`, `stock_cereal`

---

## Estructura de Archivos Clave

```
src/app/
  seguimiento/
    page.tsx                          # Dashboard seguimiento
    lotes/
      page.tsx                        # Lista lotes/cultivos (Por Lote / Por Cultivo)
      nuevo/page.tsx                  # Crear/editar ciclo
      [ciclo_id]/
        page.tsx                      # Ficha del ciclo
        acondicionamiento/page.tsx    # Formulario acondicionamiento
        siembra/page.tsx              # Formulario siembra
        fertilizaciones/page.tsx      # Formulario fertilizaciones
        cosecha/page.tsx              # PENDIENTE
        costos-fijos/page.tsx         # PENDIENTE
        aplicaciones/
          nueva/page.tsx              # Nueva aplicación
          [aplicacion_id]/editar/page.tsx
  dashboard/
    ventas/
      page.tsx                        # Server component
      VentasClient.tsx                # Client component con bonif.
    contratos/
      nuevo/page.tsx
      editar/editarContratoForm.tsx
```

---

## Campos Especiales

### Siembra
- `fertilizante_1/2`, `fertilizante_1/2_kg_ha`, `fertilizante_1/2_costo_kg` — fertilizante en siembra
- `costo_semilla_total` = USD/kg × densidad × sup_ha
- Sistemas: SD, SD c/DF, SC, SC c/DF, Laboreo mínimo, Otro

### Costos calculados en vista
- `costo_semillas_usd` = semilla + fertilizantes en siembra
- `costo_insumos_usd` = productos de aplicaciones
- `costo_servicios_usd` = siembra + pulverización + cosecha + acondicionamiento + fertilizaciones

---

## Pendientes

1. **Formulario Cosecha** → `[ciclo_id]/cosecha/page.tsx`
2. **Formulario Costos Fijos** → `[ciclo_id]/costos-fijos/page.tsx`
3. **Integración Tarifario** — autocompletar precios en todos los formularios al tipear el producto
4. **Descuento automático de stock** — al cargar aplicaciones descontar de agroquímicos
5. **Dashboard Seguimiento** — agregar KPIs del Power BI
6. **Módulo Costos** — página `/seguimiento/costos/` (placeholder)
7. **Módulo Reportes** — página `/seguimiento/reportes/` (placeholder)

---

## Campañas disponibles
23-24, 24-25, 25-26, 26-27

## Permisos Supabase ejecutados
Todos los GRANT necesarios para `authenticated` en tablas SA y secuencias.

---

*Última actualización: Junio 2026*
