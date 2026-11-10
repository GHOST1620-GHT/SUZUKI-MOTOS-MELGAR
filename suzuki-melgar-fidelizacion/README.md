# Club de Fidelización · Suzuki Melgar

Sistema completo de fidelización para el concesionario **Suzuki Melgar**, con dos aplicaciones:

- **Panel del personal** (`/admin`), para administradores, asesores y taller.
- **Portal de clientes** (`/portal`), que se puede instalar en el celular como app (PWA).

---

## 1. Funcionalidades

### Panel del personal
| Módulo | Qué hace |
|---|---|
| **Inicio (dashboard)** | KPIs (clientes, ventas del mes, puntos en circulación y pasivo, pendientes), ventas por categoría a 12 meses, distribución por nivel, mantenimientos por atender, cumpleaños de la semana, mejores clientes y actividad reciente. |
| **Registrar compra** | Busca al cliente por cédula, nombre, celular o placa. Elige la categoría (Moto, Repuestos, Accesorios o Taller) y muestra en vivo los puntos que va a ganar (con el multiplicador del nivel). Controla facturas duplicadas. Si es un servicio de taller, actualiza el control de mantenimiento de la moto. |
| **Clientes** | Búsqueda, filtros por nivel y estado (activos, inactivos, sin portal), orden y exportación a Excel. La **ficha 360°** incluye: datos, puntos, progreso de nivel, motos con estado de mantenimiento, historial de puntos, compras (con anulación), canjes, servicios de taller, referidos, mensajes enviados, canje en mostrador, ajuste de puntos, acceso al portal y saldo por WhatsApp. |
| **Motos** | Parque de motos con búsqueda por placa, VIN o propietario, y los modelos más vendidos. |
| **Compras y puntos** | Listado con filtros (categoría, origen, fechas), totales y exportación a Excel. |
| **Mantenimientos** | Motos vencidas, próximas y al día, calculadas por **kilometraje o tiempo** (lo que ocurra primero). Recordatorio por WhatsApp con mensaje listo, registro de servicio y actualización de kilometraje. |
| **Canjes** | Flujo Pendiente → Listo → Entregado (cancelar devuelve los puntos). Validación del código del cliente y aviso por WhatsApp. |
| **Referidos** | Seguimiento de prospectos, contacto por WhatsApp y conversión (abona el bono automáticamente). Ranking de embajadores. |
| **Catálogo de premios** | Premios con stock, categoría, nivel mínimo, imagen o emoji, y opción de activar u ocultar. |
| **Niveles** | Bronce, Plata, Oro y Platino, configurables: umbral, multiplicador, color y beneficios. Al cambiarlos se recalcula el nivel de todos los clientes. |
| **Importar MasControl** | Arrastra el Excel o CSV exportado de MasControl. Las columnas se detectan solas y hay vista previa. Crea los clientes nuevos, omite las facturas ya registradas y clasifica la categoría por palabras clave. Guarda un historial de cada importación. |
| **Reportes** | Tasa de recompra, tasa de canje, pasivo, ventas y puntos por mes, participación por categoría, premios más canjeados, comparativo por nivel, productividad por usuario y **clientes para reactivar** con botón de WhatsApp. |
| **Configuración** | Reglas de puntos por categoría, bonos (bienvenida, referido, cumpleaños), vencimiento, días de inactividad, datos del negocio, **usuarios y roles**, notificaciones masivas y ejecución manual de las tareas automáticas. |

**Roles:** `ADMIN` (todo) · `ASESOR` (clientes, compras, canjes, premios, referidos e importación) · `TALLER` (clientes, compras, mantenimientos y canjes).

### Portal de clientes
- Tarjeta de socio digital con puntos y nivel, y barra de progreso al siguiente nivel.
- Catálogo de premios: canje en línea con código `SM-XXXXXX` para reclamar en el concesionario.
- Mis motos: estado del mantenimiento, historial de servicios y botón para **agendar por WhatsApp**.
- Historial de puntos por mes, referidos (código, compartir por WhatsApp, formulario), notificaciones y perfil.
- Activación de cuenta con **cédula + celular registrado**. Es instalable en el celular (manifest PWA).

### Reglas automáticas
- Puntos = `valor ÷ pesos-por-punto(categoría) × multiplicador del nivel`.
- El nivel depende de los **puntos históricos** (canjear no baja de nivel).
- Bono de bienvenida al inscribirse y bono anual de cumpleaños.
- Bono de referido cuando el referido compra su **primera moto**.
- Vencimiento de puntos tras N meses sin compras (configurable).
- Tareas diarias en `GET /api/cron?key=CRON_SECRET`.

---

## 2. Tecnología

- **Next.js 16** (App Router, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS 4**, íconos Lucide y gráficos Recharts
- **PostgreSQL** con **Drizzle ORM**. En desarrollo usa **PGlite** (Postgres embebido, no hay que instalar nada).
- Autenticación con JWT en cookie httpOnly (`jose`) y contraseñas con `bcrypt`
- Excel/CSV con SheetJS

---

## 3. Instalación local

Requisito: **Node.js 20 o superior**.

```bash
npm install
cp .env.example .env      # y edite las claves
npm run setup             # crea las tablas y carga los datos de demostración
npm run dev               # http://localhost:3000
```

**Usuarios de demostración**
| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | admin@suzukimelgar.com | admin123 |
| Asesor | asesor@suzukimelgar.com | asesor123 |
| Taller | taller@suzukimelgar.com | taller123 |
| Cliente (portal) | cédula **1234567890** | cliente123 |

> ⚠️ `npm run db:seed` **borra todos los datos** y carga los de ejemplo. Detenga el servidor antes de ejecutarlo.
> Antes de entregar a producción, cambie las contraseñas o cree usuarios nuevos desde **Configuración**.

### Scripts
| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilar y ejecutar en producción |
| `npm run db:generate` | Genera una migración SQL tras modificar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones a la base de `DATABASE_URL` |
| `npm run db:seed` | Carga los datos de demostración (borra lo existente) |

---

## 4. Puesta en producción

1. **Base de datos PostgreSQL** (obligatorio en producción; PGlite es solo para desarrollo). Opciones: Neon, Supabase o Railway (tienen plan gratuito), o un servidor propio.
   ```
   DATABASE_URL="postgres://usuario:clave@host:5432/suzuki"
   ```
2. Ejecute `npm run db:migrate` (no ejecute el seed en producción). Luego cree el primer administrador: una opción es correr el seed una sola vez y después cambiar contraseñas y borrar los datos de prueba. Otra es insertar el usuario directamente en la tabla `users`.
3. **Hosting:** Vercel (recomendado para Next.js), Railway, Render o un VPS con `npm run build && npm start` detrás de Nginx.
4. **Variables de entorno:** `AUTH_SECRET` (cadena aleatoria larga), `MASCONTROL_API_KEY` y `CRON_SECRET`.
5. **Cron diario:** programe `GET https://SU-DOMINIO/api/cron?key=CRON_SECRET` (Vercel Cron, cron-job.org o crontab).
6. Configure en **Configuración** el número de WhatsApp del concesionario y las reglas de puntos.
7. **Logo oficial:** reemplace el ícono en `src/components/brand.tsx` y los íconos `public/icon-192.png` y `public/icon-512.png` con los archivos que entregue el concesionario. El uso de la marca Suzuki debe estar autorizado por el concesionario.

---

## 5. Integración con MasControl

MasControl no publica una API abierta, así que el sistema ofrece dos caminos:

**A. Importación de archivo (funciona desde el primer día)**
En MasControl exporte el informe de ventas por factura a Excel y súbalo en **Importar MasControl**. Debe incluir número de factura, cédula/NIT, nombre, valor total y fecha. Opcionalmente puede traer celular, correo, categoría/línea y placa. Hay una plantilla en `/plantilla-mascontrol.csv`.

**B. Webhook en tiempo real (si el proveedor de MasControl lo habilita)**
```http
POST /api/integraciones/mascontrol
x-api-key: <MASCONTROL_API_KEY>
Content-Type: application/json

{ "factura": "FV-10234", "fecha": "2026-11-10", "cedula": "1234567890",
  "nombre": "Andrés Rodríguez", "celular": "3001234567", "total": 350000,
  "categoria": "Repuestos", "placa": "ABC12D" }
```
Acepta una factura o un arreglo. Las facturas repetidas se omiten y los clientes nuevos se crean solos. La respuesta trae `{ imported, skipped, newCustomers, points, errors }`.

**Clasificación automática de la categoría:** "moto/motocicleta" → Moto · "taller/servicio/mano de obra" → Taller · "accesorio/casco/guante…" → Accesorios · "repuesto/aceite/llanta…" → Repuestos.

---

## 6. WhatsApp

Por defecto los mensajes se abren con enlaces `wa.me`: el asesor solo pulsa *Enviar*, y no tiene costo. Cada envío queda registrado en la ficha del cliente.
Para envíos **automáticos** (recordatorios sin intervención), conecte la *WhatsApp Business Cloud API* de Meta en `src/lib/whatsapp.ts → sendWhatsAppAutomatic()`. Requiere plantillas aprobadas por Meta y tiene costo por conversación.

---

## 7. Estructura

```
src/
  app/
    admin/(panel)/…        Pantallas del personal
    admin/actions.ts       Acciones del servidor (crear, editar, canjear…)
    portal/(app)/…         Pantallas del cliente
    portal/actions.ts
    api/                   Búsqueda, exportaciones, webhook MasControl, cron
  components/              UI reutilizable (tarjetas, modales, gráficos, formularios)
  db/schema.ts             Esquema de base de datos (Drizzle)
  lib/
    loyalty.ts             ⭐ Reglas de negocio: puntos, niveles, canjes, referidos, mantenimientos
    importer.ts            Importación MasControl
    settings.ts            Parámetros configurables
    whatsapp.ts            Plantillas y enlaces de WhatsApp
drizzle/                   Migraciones SQL
scripts/                   migrate.ts, seed.ts
```

## 8. Protección de datos
El formulario de clientes incluye la autorización de tratamiento de datos (Ley 1581 de 2012) y la opción de no recibir promociones. Los clientes que no aceptan promociones quedan excluidos de las notificaciones masivas y de la lista de reactivación.
