# Baratza SRL — Sistema de Gestión Agropecuaria

Aplicación web para la gestión integral de operaciones agrícolas y ganaderas: seguimiento de cultivos, control de stock de agroquímicos y cereal, costos por campaña y análisis de resultados.

**Stack:** Next.js 14 · Supabase (PostgreSQL) · TypeScript · Tailwind CSS
**Deploy:** Vercel — https://cereal-stock.vercel.app

---

## Conceptos del dominio

### Campañas
Una campaña es el año fiscal agrícola, del 1/9 al 30/8, en formato `YY-YY` (ej: `25-26`).

> ⚠️ **Importante:** existen dos tablas de campañas distintas, una por módulo:
> - `campanas` (sin i) → módulo **Seguimiento**, id tipo `bigint`
> - `campanias` (con i) → módulo **Cereal**, id tipo `uuid`
>
> Para vincular datos entre módulos se mapean **por nombre** (ej: ambas tienen "25-26").

### Campos (establecimientos)
Don Francisco · El Vasco · La Media Luna · Zabala

### Cultivos
- **Agrícolas** (pagan asesoramiento): Trigo, Soja 1, Soja 2, Maíz Temprano, Maíz 1, Maíz 2, Maíz Tardío, Girasol
- **Ganaderos** (no pagan asesoramiento): Alfalfa, Verdeos, Centeno

### Ciclo
Un ciclo es la combinación **lote + cultivo + campaña**. Un mismo lote puede tener varios ciclos en una campaña (distintos cultivos). Toda la información productiva y de costos se vincula al ciclo.

---

## Módulos

### 1. Seguimiento Agronómico
Gestión productiva por ciclo: siembra, aplicaciones (pulverizaciones), fertilizaciones, cosecha, acondicionamiento y costos fijos.

**Aplicaciones de agroquímicos**
- Tipos: barbecho, pre-siembra, pre-emergente, post-emergente (temprano/normal), rescate, desecación, insecticida, fungicida.
- Cada producto se selecciona del catálogo filtrando por tipo (herbicida, coadyuvante, etc.).
- El precio se trae automáticamente del tarifario vigente a la fecha de la aplicación.
- **Vinculación con stock:** al guardar una aplicación, valida que haya stock suficiente y descuenta del inventario de agroquímicos automáticamente. Si falta stock, bloquea el guardado.

**Cosecha**
- Registra producción total (kg), rinde, humedad, costo de cosecha.
- **Vinculación con stock de cereal:** al guardar, genera un movimiento de entrada en el stock de cereal (convierte kg a toneladas). Ver sección Vinculaciones.

### 2. Agroquímicos (Stock)
Catálogo de productos, registro de compras y movimientos, control de stock.
- Unidades soportadas: L, kg, caja, cc, g, unidad.
- Tipos de movimiento: compra, aplicacion, devolucion, ajuste.
- El stock se calcula desde la vista `vw_stock_agroquimicos`.

### 3. Cereal (Stock)
Control de stock de granos cosechados, con movimientos de entrada/salida.
- Trabaja en **toneladas**.
- Tipos de movimiento: cosecha, compra, recepcion_cliente, otro_ingreso, entrega, consumo_hacienda, merma, otro_egreso, transferencia, ajuste, venta, devolucion.
- La columna `es_entrada` es **generada automáticamente** por la base según el tipo de movimiento (no se inserta manualmente).

### 4. Costos
Costos fijos por campaña y campo. Ver sección Costos Fijos.

### 5. Reportes *(pendiente de desarrollo)*
Análisis de costos discriminados por actividad agrícola/ganadero.

### 6. Dashboard *(pendiente de desarrollo)*
KPIs de producción, costos y rindes por campaña.

---

## Costos Fijos

El sistema maneja **dos mecanismos distintos** según el tipo de costo:

### Costos distribuidos — sistema nuevo (`costos_fijos_campo`)
Se cargan **una vez por campo** y la vista `vw_distribucion_costos_fijos` los reparte automáticamente entre los ciclos.

| Tipo | Base de distribución |
|------|---------------------|
| **Arrendamiento** | Hectáreas totales del lote |
| **Asesoramiento** | Superficie sembrada de cultivos **agrícolas** (los ganaderos no pagan) |

**Asesoramiento:** se cobra en kg de soja por hectárea (ej: 40 kg/ha). El formulario calcula el costo en USD:
```
costo USD/ha = kg_soja_ha × (precio_soja_USD_ton / 1000)
```
El precio de soja se carga en USD/ton (conversión desde pesos: `pesos_ton / tipo_cambio`). Genera un único vencimiento al 31/08 (fin de campaña).

### Costos por ciclo — sistema viejo (`sa_costos_fijos`)
Se cargan con un **selector de lotes/cultivos** (uno, varios o todos). Cada ciclo seleccionado recibe su registro.

| Tipo | Signo | Notas |
|------|-------|-------|
| **Seguro** | Positivo | Monto en USD/ha × hectáreas aseguradas (editables) |
| **Indemnización seguro** | **Negativo** | Reduce el costo total del ciclo (fue un ingreso del seguro) |

El monto se carga en **USD/ha** y se multiplica por las hectáreas aseguradas (por defecto la superficie sembrada del ciclo, editable por si se asegura menos).

> La indemnización se guarda con valor negativo. Como la vista `vw_sa_resumen_ciclo` suma `costo_total_usd` directo, el negativo resta solo del total del ciclo. En la interfaz se muestra en positivo.

---

## Vinculaciones entre módulos

El valor del sistema está en que los módulos no son silos: las acciones en Seguimiento actualizan los stocks automáticamente.

### Aplicación → Stock de agroquímicos
Al guardar una pulverización, cada producto descuenta del stock (movimiento tipo `aplicacion`, vinculado por `ciclo_id`). Valida stock disponible antes de guardar.

### Cosecha → Stock de cereal
Al guardar una cosecha, genera un movimiento de entrada en `movimientos_cereal`:
- `tipo = 'cosecha'`, toneladas = `rinde_kg_total / 1000`
- Mapea la campaña de seguimiento (`campanas`, bigint) a la de cereal (`campanias`, uuid) **por nombre**
- Vincula lote y cultivo (uuid, compartidos entre módulos)
- Rastrea el origen con `ciclo_id` para evitar duplicados: al editar una cosecha, borra el movimiento anterior y crea el actualizado
- Completa `usuario_id` con el usuario logueado (campo obligatorio)

---

## Notas técnicas

- **RLS:** las tablas usan Row Level Security. Los INSERT en `movimientos_cereal` requieren que el usuario tenga rol `admin`, `comercial` u `operario` en la tabla `perfiles` (función `get_user_rol()`).
- **Carga histórica masiva:** para cargar datos históricos sin afectar el stock, la vinculación de aplicaciones se desactiva temporalmente, se cargan los datos vía SQL, se ajusta el stock al inventario físico real, y se reactiva la vinculación.
- **Productos por nombre:** las tablas `sa_aplicacion_productos` y `tarifario_insumos` guardan el producto por nombre de texto (no por id). Mantener la consistencia de nombres es clave al unificar duplicados. Concentraciones distintas (ej: "Cletodim" vs "Cletodim 24%") son productos distintos.
- **Precios:** la vista `vw_precios_insumos` ordena por fecha de vigencia y prioriza precios de compra sobre los del tarifario. Si un precio tiene fecha de vigencia posterior a la aplicación, el producto queda con costo 0 hasta corregir la vigencia.

---

## Vistas principales

| Vista | Función |
|-------|---------|
| `vw_sa_resumen_ciclo` | Resumen de costos e ingresos por ciclo (insumos, servicios, fijos) |
| `vw_distribucion_costos_fijos` | Distribuye arrendamiento y asesoramiento entre ciclos |
| `vw_sa_costos_campana` | Totales de costos por campaña |
| `vw_stock_agroquimicos` | Stock actual de cada agroquímico |
| `vw_precios_insumos` | Precios vigentes de insumos (compras + tarifario) |

---

## Flujo de trabajo de desarrollo

1. Los cambios de código se entregan como archivos `.tsx` completos.
2. Se hace commit y **push** manual al repositorio (el push dispara el deploy en Vercel).
3. Los cambios de base de datos se ejecutan como scripts SQL en el editor de Supabase.
4. Para scripts SQL: copiar siempre desde el archivo descargado (no desde el chat) para evitar arrastrar texto de más.

---

## Pendientes

- [ ] Módulo de **Reportes** — costos discriminados por actividad agrícola/ganadero
- [ ] **Dashboard** — KPIs de producción, costos y rindes por campaña
- [ ] **KPI de indemnización** en la ficha del lote (mostrar en positivo)
