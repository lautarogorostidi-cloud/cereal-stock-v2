# 🌾 Campo — Sistema Agropecuario · Módulo Stock de Cereal

Sistema web profesional para gestión de stock, contratos y comercialización de cereal.

**Stack:** Next.js 14 · Supabase (PostgreSQL) · Vercel · TypeScript · Tailwind CSS

---

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| **admin** | Acceso total. Gestiona usuarios, datos maestros, todos los módulos |
| **comercial** | Carga contratos, precios, liquidaciones, ve reportes |
| **operario** | Carga movimientos, cartas de porte, entregas |

---

## Módulos incluidos

- 📊 **Dashboard** — KPIs de stock, posición comercial, gráficos
- 🌾 **Stock** — Stock físico, disponible, comprometido y vendido por cultivo/campaña
- 📋 **Contratos** — Contratos de venta con seguimiento de cumplimiento
- 💰 **Ventas/Movimientos** — Todos los movimientos de cereal
- 🚛 **Entregas** — Historial de entregas por contrato
- 📄 **Cartas de Porte** — Trazabilidad CPE
- 📈 **Reportes** — Resultado comercial neto por cultivo y campaña

---

## GUÍA DE INSTALACIÓN PASO A PASO

### PASO 1 — Supabase: crear el proyecto

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Elegir nombre (ej: `cereal-stock`), contraseña para la DB, región (South America)
3. Esperar ~2 minutos a que el proyecto se cree

**Obtener las credenciales:**
- Ir a ⚙️ **Settings → API**
- Copiar `Project URL` → es tu `NEXT_PUBLIC_SUPABASE_URL`
- Copiar `anon public` → es tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copiar `service_role secret` → es tu `SUPABASE_SERVICE_ROLE_KEY`

### PASO 2 — Supabase: ejecutar el schema SQL

1. En tu proyecto de Supabase ir a **SQL Editor**
2. Click en **New query**
3. Copiar todo el contenido de `supabase/migrations/001_schema_inicial.sql`
4. Pegar en el editor y click **Run** (o Ctrl+Enter)
5. Verificar que no haya errores (debe decir "Success")

### PASO 3 — Supabase: crear el primer usuario admin

1. Ir a **Authentication → Users → Add user**
2. Ingresar email y contraseña del admin
3. Luego en **SQL Editor** ejecutar:

```sql
UPDATE perfiles SET rol = 'admin' WHERE email = 'tu@email.com';
```

### PASO 4 — GitHub: subir el código

```bash
# En tu computadora, abrir una terminal en la carpeta del proyecto
git init
git add .
git commit -m "feat: sistema agropecuario - módulo stock cereal"

# Crear un repositorio nuevo en github.com (sin README)
# Luego ejecutar los comandos que GitHub te muestra, tipo:
git remote add origin https://github.com/TU_USUARIO/cereal-stock.git
git branch -M main
git push -u origin main
```

### PASO 5 — Vercel: desplegar

1. Ir a [vercel.com](https://vercel.com) → **Add New → Project**
2. Importar el repositorio de GitHub que acabás de crear
3. En **Environment Variables** agregar:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = tu service role key
4. Click **Deploy**
5. En ~2 minutos tu app estará en `https://cereal-stock.vercel.app`

### PASO 6 — Configurar Supabase Auth redirect

1. En Supabase → ⚙️ **Authentication → URL Configuration**
2. **Site URL**: poner tu URL de Vercel (ej: `https://cereal-stock.vercel.app`)
3. **Redirect URLs**: agregar `https://cereal-stock.vercel.app/**`

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Iniciar servidor de desarrollo
npm run dev
# Abrir http://localhost:3000
```

---

## Estructura del proyecto

```
src/
├── app/
│   ├── auth/login/          # Página de login
│   └── dashboard/
│       ├── layout.tsx       # Layout con sidebar
│       ├── page.tsx         # Dashboard principal
│       ├── stock/           # Módulo stock
│       ├── contratos/       # Módulo contratos
│       ├── ventas/          # Módulo movimientos/ventas
│       ├── entregas/        # Módulo entregas
│       ├── cartas-porte/    # Módulo cartas de porte
│       └── reportes/        # Módulo reportes
├── components/
│   ├── layout/              # Sidebar, TopBar
│   ├── ui/                  # KPICard, badges
│   └── charts/              # Gráficos recharts
├── lib/supabase/            # Clientes server/client
└── types/                   # Tipos TypeScript del schema

supabase/migrations/
└── 001_schema_inicial.sql   # Schema completo PostgreSQL
```

---

## Tablas principales en Supabase

| Tabla | Descripción |
|-------|-------------|
| `perfiles` | Usuarios del sistema con roles |
| `movimientos_cereal` | Tabla central — todos los movimientos |
| `contratos` | Contratos de venta |
| `cartas_porte` | Trazabilidad CPE |
| `liquidaciones` | Liquidaciones comerciales |
| `campanias` | Campañas agrícolas (2023/24, etc.) |
| `cultivos` | Soja, Maíz, Trigo, etc. |
| `clientes` | Compradores y exportadores |
| `acopios` | Plantas de almacenamiento |
| `puertos` | Destinos de exportación |

**Vistas:**
- `vw_stock_actual` — Stock físico, disponible y comprometido
- `vw_posicion_contratos` — Cumplimiento por contrato
- `vw_resultado_comercial` — P&L por cultivo y campaña 
