# Almacén Digital · Valve Center

Aplicación web del almacén de ZF Valve Center. Permite registrar el material con lectura de códigos de barras (escáner USB/Bluetooth o cámara SICK), acomodarlo en los racks Kanban, darle salida por bolsas o por piezas respetando FIFO y exportar el inventario a Power BI.

---

## Índice

1. [Cómo está armado](#cómo-está-armado)
2. [Instalación y arranque](#instalación-y-arranque)
3. [Uso de la aplicación](#uso-de-la-aplicación)
4. [Reglas del almacén](#reglas-del-almacén)
5. [Lectura de códigos](#lectura-de-códigos)
6. [Racks Kanban](#racks-kanban)
7. [Datos y API](#datos-y-api)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Mantenimiento](#mantenimiento)
10. [Limitaciones conocidas y pendientes](#limitaciones-conocidas-y-pendientes)

---

## Cómo está armado

```
 Navegador (React + Vite)                Servidor (Node + Express)          MongoDB
 ┌────────────────────────────┐  HTTP   ┌──────────────────────────┐       ┌──────────────────────┐
 │ Pantalla del almacén       │ ──────▶ │ API REST /api/...        │ ────▶ │ valve_center_digital │
 │ Racks, Recepción, salidas  │  JSON   │ Reglas de escaneo, FIFO, │       │ articulos, racks,    │
 │ Lectura de códigos         │ ◀────── │ bolsas, movimientos      │ ◀──── │ colorranuras,        │
 └────────────┬───────────────┘         └──────────────────────────┘       │ movimientos          │
              │ WebSocket (solo en modo cámara)                             └──────────────────────┘
              ▼
   Cámara SICK SEC110 (video MJPEG) → el navegador decodifica el código con ZXing
```

- **Frontend** (`frontend/`): React 18 + Vite 5. Dibuja los racks, la Recepción, las ventanas de detalle y salida, y lee los códigos. Se actualiza solo cada 5 segundos para mostrar lo que hacen otros equipos.
- **Backend** (`backend/`): Node.js + Express 5 + Mongoose 9. Aplica las reglas del almacén (escaneo, FIFO, salidas, movimientos entre ranuras) y guarda el historial.
- **Base de datos**: MongoDB local, base `valve_center_digital`.

### Librerías

| Parte | Librería | Para qué |
|---|---|---|
| Backend | `express`, `cors`, `dotenv`, `mongoose` | API, orígenes permitidos, variables de entorno, MongoDB |
| Backend (desarrollo) | `nodemon` | Reinicia el servidor al guardar cambios |
| Frontend | `react`, `react-dom` | Interfaz |
| Frontend | `@dnd-kit/core` | Arrastrar y soltar contenedores |
| Frontend | `jsbarcode` | Dibujar los códigos de barras (CODE 128) |
| Frontend | `@zxing/library` | Decodificar códigos desde la imagen de la cámara |
| Frontend | `exceljs` | Generar el libro .xlsx para Power BI |
| Frontend | `@azure/msal-browser` | Inicio de sesión Microsoft para publicar en Power BI (código presente, sin uso en el menú) |
| Raíz | `prettier` | Formato del código |

---

## Instalación y arranque

### Requisitos

- **Node.js 22 o superior** (probado con Node 24).
- **MongoDB** accesible desde el servidor (por omisión, local en `127.0.0.1:27017`).
- Para la cámara, el equipo debe estar en la misma red que la cámara SICK (`192.168.136.100`).

### Desarrollo

```bash
# 1) Backend: API en http://localhost:3000
cd backend
npm install
npm run dev          # con nodemon; "npm start" lo arranca sin reinicio automático

# 2) Frontend: http://localhost:5173
cd frontend
npm install
npm run dev
```

Al arrancar, el backend se conecta a MongoDB, actualiza los índices y ejecuta las migraciones pendientes (ver [Mantenimiento](#mantenimiento)). Después muestra `API lista en http://localhost:3000`.

### Variables de entorno

**`backend/.env`**

| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/valve_center_digital` | Conexión a MongoDB (obligatoria) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Orígenes que pueden llamar a la API, separados por comas. Cualquier puerto de `localhost` / `127.0.0.1` se acepta siempre. |

**`frontend/.env`** (opcional)

| Variable | Por omisión | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | Dirección de la API |
| `VITE_SICK_WS_URL` | `ws://192.168.136.100:8888/ws` | Video de la cámara SICK |
| `VITE_POWERBI_CLIENT_ID`, `VITE_POWERBI_TENANT_ID`, `VITE_POWERBI_WORKSPACE_ID`, `VITE_POWERBI_DATASET_NAME` | — | Solo para publicar directo en Power BI (función sin uso hoy) |

Las variables `VITE_*` se fijan **al compilar** el frontend: si cambian, hay que volver a ejecutar `npm run build`.

### Producción

1. `cd frontend && npm run build` genera la versión final en `frontend/dist/`. Esa carpeta se sirve con cualquier servidor de archivos estáticos.
2. `cd backend && npm start` arranca la API. Para mantenerla viva y reiniciarla con el equipo se puede usar **pm2**: `pm2 start server.js --name almacen-api`, después `pm2 save` y `pm2 startup`.
3. Si el frontend se abre desde otra dirección (por ejemplo `http://servidor:8080`), agrégala a `FRONTEND_ORIGIN` y compila el frontend con `VITE_API_URL` apuntando al servidor.
4. El backend lee `frontend/src/data/kanbans.js` para validar las ranuras, así que la carpeta `frontend` debe existir junto a `backend` también en el servidor.
5. Sirve la app por **http**: si se sirve por https, el navegador bloquea la conexión `ws://` de la cámara.

---

## Uso de la aplicación

### Pantalla principal

- **Barra superior**: menú lateral, botón **Power BI** (exportar), botón **FIFO** y **buscador**.
- **Indicadores**: ranuras ocupadas en todo el almacén, ocupación del Kanban que se está viendo, contenedores en Recepción y bolsas registradas.
- **Columna izquierda**: panel de **Lectura de código**, **Recepción** y **zona de salida**.
- **Racks**: pestañas con cada Kanban, una leyenda de colores y el dibujo del rack con sus ranuras.
- **Menú lateral**: la lista de Kanbans (desplegable), **Nuevo rack** y los **movimientos recientes** (desplegable).

### Flujo de trabajo

1. **Escanear.** El código nuevo aparece en **Recepción** con 1 bolsa; cada nueva lectura del mismo código suma una bolsa.
2. **Revisar.** En la tarjeta de Recepción se ajusta el número de bolsas (1–500) y se escribe una descripción. Los botones − y + guardan al momento; un número escrito se guarda al pulsar **Enter** o al salir del campo (Esc lo descarta). Al abrir el detalle se capturan los datos de la etiqueta (LOTE, PPP = peso por pieza, OPER = operación) y las piezas y el peso de cada bolsa.
3. **Ubicar.** Hay dos formas:
   - arrastrar la tarjeta a una ranura del rack;
   - tocar la tarjeta para seleccionarla y luego tocar la ranura.

   Si el mismo código ya está en esa ranura, sus bolsas se unen.
4. **Consultar.** Al tocar un contenedor se abre su ventana:
   - **Con un solo código**: muestra el detalle (contenido, bolsas, editar, mover, regresar a Recepción).
   - **Con varios códigos**: muestra la lista de los códigos, y cada uno se puede abrir, mover o regresar.
5. **Dar salida.** Se arrastra el contenedor a la **zona de salida**, o se selecciona y se toca la zona. En la ventana de salida se elige entre:
   - **Bolsas completas**: se tocan las bolsas que salen (por omisión, todas) o se escribe cuántas, y salen las más antiguas.
   - **Piezas**: se elige una bolsa y se indica cuántas piezas salen.

   Otra opción es **escanear** un código que ya está en un rack: sale su bolsa más antigua (ver [Reglas](#reglas-del-almacén)).
6. **Mover.** Un contenedor se arrastra de una ranura a otra. Si la ranura de origen tiene varios códigos, se toca la ranura y se usa **Mover / salida** en el código que se quiere mover.

### Otras funciones

- **FIFO**: muestra todo el almacén del más antiguo al más nuevo, por contenedor o por bolsa. Al tocar una fila, la app lleva a su ranura.
- **Buscador**: busca por código, descripción, lote, operación, PPP, fecha, rack, módulo o ranura, sin distinguir mayúsculas ni acentos. Los resultados salen en orden FIFO y los contenedores encontrados se resaltan en el rack.
- **Editar colores**: disponible en todos los Kanban. Se elige un color (azul = Raw Material, verde = Material Ensamblado, café = Cajas de cartón) y se tocan los contenedores. **Restablecer** devuelve los colores originales.
- **Nuevo rack**: crea racks desde la app. Cada módulo tiene niveles, ranuras por nivel, una nomenclatura numérica (1, 2, 3… con prefijo opcional) o por columnas (A-1, B-1…) y un color. Los racks creados así se pueden **editar** o **eliminar**; las ranuras que desaparecen devuelven su material a Recepción.
- **Power BI → Exportar archivo**: genera un libro `.xlsx` con tres hojas para Power BI Desktop (*Obtener datos → Libro de Excel*). Las hojas son **Articulos**, **Ranuras** y **Movimientos**; esta última lleva hasta 5000 movimientos.
- **Quitar** (en Recepción): elimina el registro de un contenedor. Queda anotado en el historial.

En los campos numéricos, un valor de 0 o un campo vacío **no** se convierte en 1: el campo queda en blanco y aparece una advertencia.

---

## Reglas del almacén

| Tema | Regla |
|---|---|
| **Cantidad** | `cantidad` son **bolsas** de material, no piezas. Cada bolsa es independiente: tiene sus propias piezas, peso, FECHA y hora de llegada. |
| **Ranuras** | Una ranura admite **varios códigos** y **cualquier cantidad de bolsas**. Un código puede estar en varias ranuras, pero una sola vez en cada una: si se mueve a una ranura donde ya está, sus bolsas se unen. No hay intercambio de contenedores. |
| **Escaneo** | El backend decide qué hacer con cada lectura (ver la siguiente tabla). |
| **FIFO** | Las bolsas se ordenan por la FECHA de su etiqueta y, dentro del mismo día, por la hora de llegada. Una bolsa sin FECHA usa el día en que llegó. |
| **Salida de piezas** | Afecta a **una sola bolsa**. El peso de esa bolsa pasa a **NA** y queda bloqueado para siempre (las piezas sí se pueden corregir). Si la bolsa se vacía, sale completa. Cuando un contenedor se queda sin bolsas, se elimina y su ranura queda libre. |
| **FECHA** | Es automática: se toma de la etiqueta o, si no la trae, del día del registro. No se puede editar. |
| **Historial** | Registra altas, bolsas sumadas, salidas, movimientos, cambios de piezas y peso, ajustes manuales de bolsas y eliminaciones. Los cambios de descripción y de datos de la etiqueta no se registran. Se guarda el id de la ranura (`k4-m1:C-1.1`) y en pantalla y en el Excel se muestra su nombre (`Kanban 4 · C-1.1`). |
| **Varios equipos a la vez** | Escaneos y movimientos simultáneos se aplican uno tras otro: cinco escaneos al mismo tiempo de un código nuevo dejan un contenedor con 5 bolsas, y dos movimientos del mismo código a la misma ranura unen sus bolsas. |

**Qué pasa al escanear un código:**

| Situación del código | Resultado |
|---|---|
| No existe | Se crea en **Recepción** con 1 bolsa. |
| Está en Recepción | Se le suma **1 bolsa**. |
| Está en algún rack | **Sale su bolsa más antigua** (FIFO) entre todas sus ranuras, **sin pedir confirmación**. |

### Datos que se leen del código

- **Número de parte**: lo que va antes del primer apóstrofe `'` o guion `-` (`004977004631'117` → `004977004631`). Se muestra en el detalle y en los contenedores de Kanban 4.
- **Piezas**: lo que va después del separador (`'117` → 117). Son las piezas de cada bolsa nueva. Solo se toma cuando el número de parte y las piezas son numéricos, para que un código como `ABC-1` no se lea como 1 pieza. Si la etiqueta trae PIEZAS explícitas, esas tienen prioridad.
- Si la etiqueta trae datos estructurados, se extraen FECHA, PESO, LOTE, PIEZAS, PPP y OPER. Los formatos reconocidos son GS1 legible (`(10)LOTE(11)AAMMDD(30)PIEZAS`), `CLAVE:valor` separados por `|` o `;`, y JSON.

---

## Lectura de códigos

En el panel **Lectura de código** se elige el modo:

- **Escáner** (por omisión): lectores USB o Bluetooth que funcionan como teclado. La app los reconoce porque escriben muy rápido (menos de 45 ms entre teclas) y terminan con Enter. No necesita ninguna librería ni configuración.
  - Si el cursor está dentro de un campo de texto (descripción, LOTE, bolsas…) y llega una lectura terminada en Enter, se registra como escaneo y el campo vuelve a lo que tenía. Una tecla mantenida o una persona escribiendo rápido no cuentan como lectura.
  - **Al instalar un escáner nuevo**, escanea un código con apóstrofe (`004977004631'117`) y confirma que en pantalla sale idéntico. Si el escáner está configurado con teclado en inglés y Windows en español, el `'` puede llegar como otro carácter; se corrige configurando el idioma de teclado del escáner (manual del fabricante).
- **Cámara SICK**: modelo **SEC110-5C9D1SFZZZZ**. Se enciende **solo al elegir este modo** y se apaga al elegir otro; al abrir o recargar la app nunca arranca sola. Mientras está activa, el escáner USB no escucha.
- **Manual**: se escribe el código y se pulsa **Registrar**.

### Cómo funciona la cámara

La SEC110 es una cámara de video, **no un lector de códigos**: transmite imágenes JPEG por WebSocket en `ws://192.168.136.100:8888/ws`. El navegador las muestra y las decodifica con **ZXing** (`frontend/src/utils/lectorImagen.js`, que se descarga solo al elegir la cámara).

- Solo lee **CODE 128**, el formato de las etiquetas del almacén. Otros formatos darían lecturas falsas con la piel, la ropa o el fondo; si hiciera falta uno, se agrega en `lectorImagen.js`.
- Solo lee lo que queda dentro del **recuadro** marcado sobre la imagen.
- Una lectura vale cuando el mismo texto se decodifica **dos veces seguidas** y tiene **al menos 6 caracteres**. Los códigos girados 90° no se leen.
- **Protecciones**: la misma lectura repetida mientras el código sigue a la vista cuenta una sola vez (ventana de 3 s). Si hay más de 10 lecturas en 10 segundos, la cámara se apaga y avisa.
- Si el decodificador no logra cargarse (por ejemplo, tras actualizar el servidor con la página abierta), el panel lo indica en rojo y pide recargar la página con Ctrl + F5.
- **Enfoque**: la lente es fija y enfoca lejos. Para que lea bien, la etiqueta debe verse nítida y con barras suficientemente grandes. En la interfaz web de la cámara (`http://192.168.136.100`) conviene usar la resolución completa, alta calidad JPEG y corrección de nitidez. Para etiquetas pequeñas, un lector dedicado o un escáner USB es más confiable.

---

## Racks Kanban

Los racks fijos están en `frontend/src/data/kanbans.js`:

| Kanban | Línea(s) | Distribución |
|---|---|---|
| Kanban 1 | A3 | Ranuras 1–30 (frente y posterior) |
| Kanban 2 | A0 – A5 | Columnas A–K por niveles (E-1, F-1…) |
| Kanban 3 | A4 – A6 – B4 | Bloques por letra A–L (A-1, A-2…) |
| Kanban 4 | B2 | Rack de rodillos (FIFO): letras C–G × niveles 1–4, cada posición con 4 compartimentos |
| Kanban Pistones | Pistones | P1–P76 |
| Pistones Cartón | Pistones | Cajas de cartón C-1 a C-20 |

- **Id de ranura**: `<módulo>:<etiqueta>`, por ejemplo `k2-m2:E-3`. En los racks creados desde la app es `r<id del rack>-<módulo>:<etiqueta>`.
- **Kanban 4**: 5 letras (C a G) × 4 niveles = 20 posiciones. Cada posición (C-1, D-1… G-4) se divide en **4 compartimentos independientes** (C-1.1 a C-1.4), con 80 en total. Cada compartimento recibe sus propios códigos, color y lugar en FIFO. En pantalla, cada posición se dibuja como una bandeja de 2 × 2. Se define con `compartimentos: 4` en `kanbans.js`.
- **Modificar un rack fijo**: se edita `kanbans.js` y se **reinicia el backend**, que usa ese archivo para validar las ranuras. Si una ranura con material desaparece, ese material se muestra en Recepción.
- Los racks creados desde la app y los colores cambiados a mano se guardan en MongoDB.

---

## Datos y API

### Colecciones de MongoDB

| Colección | Contenido |
|---|---|
| `articulos` | Un documento por **código y ubicación**: `codigo`, `formato`, `descripcion`, `contenido` (fecha, peso, lote, piezas, ppp = peso por pieza, oper = operación), `bolsas[]` (piezas, peso, pesoBloqueado, fecha, registrado), `cantidad` (= número de bolsas), `ubicacion` (`recepcion` o id de ranura), `registrado`. Índice único `(codigo, ubicacion)`. |
| `racks` | Racks creados desde la app: `nombre`, `lineas`, `modulos[]` (id, nombre, niveles, config). |
| `colorranuras` | Colores cambiados a mano: `ranura`, `color` (`azul`, `verde` o `cafe`). Solo se guardan los que difieren del original. |
| `movimientos` | Historial: `fecha`, `texto`. |

### Endpoints (`/api`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | Comprobar que la API responde |
| GET | `/articulos` | Todo el inventario |
| POST | `/articulos` | Registrar un escaneo `{ codigo, formato, contenido }`. Responde con `tipo`: `nuevo`, `existente` o `salida`. |
| PATCH | `/articulos/:id` | Cambiar `cantidad` (1–500), `descripcion`, `contenido` o `ubicacion` (mover) |
| PATCH | `/articulos/:id/bolsas/:bolsa` | Piezas o peso de una bolsa |
| POST | `/articulos/:id/salida` | Salida de bolsas completas: `{ bolsas: [ids] }` o `{ cantidad }` (salen las más antiguas) |
| POST | `/articulos/:id/salida-piezas` | Salida de piezas: `{ bolsa, piezas }` |
| DELETE | `/articulos/:id` | Eliminar un registro |
| GET | `/historial?limite=N` | Últimos movimientos (50 por omisión, máximo 5000) |
| GET / POST | `/racks` | Listar o crear racks (hasta 20 módulos y 400 ranuras) |
| PUT / DELETE | `/racks/:id` | Editar o eliminar un rack; su material vuelve a Recepción |
| GET / PUT | `/colores` | Colores de contenedor; PUT recibe `{ cambios: [{ ranura, color }] }` (`color: null` restablece el original) |

Los errores responden `{ error: "mensaje" }` con código 400, 404 o 409. Las operaciones de bolsas son atómicas: dos equipos trabajando a la vez no pueden descuadrar `cantidad`.

---

## Estructura del proyecto

```
ValveCenterDigital/
├── backend/
│   ├── server.js                 Arranque: Express, CORS, rutas, conexión y migraciones
│   ├── .env                      PORT, MONGODB_URI, FRONTEND_ORIGIN
│   ├── scripts/
│   │   └── limpiar-movimientos-camara.mjs
│   └── src/
│       ├── models/               Articulo, Rack, ColorRanura, Movimiento
│       ├── routes/               articulos (escaneo, salidas), racks, colores, historial
│       ├── ubicaciones.js        Mover entre ranuras y unir bolsas
│       ├── ranuras.js            Validar que una ranura exista
│       ├── migraciones.js        Índices y migraciones al arrancar
│       └── utils.js              Errores HTTP y registro de movimientos
├── frontend/
│   ├── index.html, vite.config.js
│   └── src/
│       ├── App.jsx               Pantalla principal, detalle de contenedor, arrastrar y soltar
│       ├── components/           Escaner, Recepcion, Rack, DetalleRanura, Salida, VistaFifo,
│       │                         Buscador, NuevoRack, Sidebar, BotonPowerBI, Contenido, CodigoBarras
│       ├── data/kanbans.js       Definición de los racks fijos
│       ├── hooks/                useAlmacen (estado + API + refresco), useCamaraSick (cámara)
│       ├── utils/                contenido (bolsas, FIFO, etiqueta), busqueda, powerbi,
│       │                         camaraSick, lectorImagen, numeros
│       └── *.css                 index.css (base), almacen.css (almacén), fusion.css
├── GUIA_ESTILOS.md               Sistema de diseño (glassmorfismo estilo macOS/iOS)
└── README.md
```

---

## Mantenimiento

### Migraciones automáticas

Cada vez que arranca, el backend ejecuta `backend/src/migraciones.js`. Todas las migraciones se pueden repetir sin riesgo:

- **Índices**: reemplaza el índice único por código por el índice único `(codigo, ubicacion)`.
- **Bolsas**: crea las bolsas de los registros antiguos que solo tenían `cantidad`, y completa la fecha de las bolsas que no la tenían.
- **Kanban 4**: pasa lo que estaba en una ranura antigua (`k4-m1:E-4`) al compartimento 1 de su posición (`k4-m1:E-4.1`), junto con su color.

### Limpieza de movimientos basura de la cámara

El 22 y 23 de octubre de 2026, una primera versión de la integración con la cámara registró lecturas falsas en dos ráfagas de pocos minutos. **Ya están limpias**: se borraron los 24,772 movimientos de esas ráfagas y se conservaron los escaneos reales posteriores. El historial quedó con 464 movimientos.

El historial completo de antes de la limpieza (25,236 movimientos) está respaldado en `respaldo-movimientos-2026-10-23-18-59-17.json.gz`, en la raíz del proyecto. El archivo `respaldo-movimientos-2026-10-23.json.gz` es un respaldo anterior del mismo día.

El script queda por referencia. Solo actúa dentro de esas dos ráfagas, así que volver a ejecutarlo no borra nada más:

```bash
cd backend
node scripts/limpiar-movimientos-camara.mjs           # simulación: solo cuenta
node scripts/limpiar-movimientos-camara.mjs --borrar  # respalda en un .json.gz y borra
```

### Respaldo de la base

```bash
mongodump --db valve_center_digital --out respaldo-AAAA-MM-DD
mongorestore --db valve_center_digital respaldo-AAAA-MM-DD/valve_center_digital
```

---

## Limitaciones conocidas y pendientes

- **Sin inicio de sesión**: cualquiera con acceso a la red y a la dirección de la app puede usarla. El historial no registra quién hizo cada cambio.
- **Escaneo = salida**: escanear un código que ya está en un rack saca una bolsa sin confirmación. Con el escáner USB, dos lecturas seguidas del mismo código sacan dos bolsas. **Mejora futura acordada**: proteger contra la lectura doble del mismo código, por ejemplo ignorando una repetición en pocos segundos o mientras hay una ventana abierta. La cámara ya tiene esa protección.
- **Cámara SICK**: no se ha validado a fondo con etiquetas reales. La calidad de lectura depende del enfoque y del tamaño de las barras (ver [Cómo funciona la cámara](#cómo-funciona-la-cámara)).
- **PPP (peso por pieza)**: se guarda como texto libre, sin unidad fija. Podría pasar a ser un número o calcularse a partir del peso y las piezas de cada bolsa.
- **Publicar directo en Power BI**: el código existe (`utils/powerbi.js`, MSAL), pero el menú solo ofrece *Exportar archivo*.
- **Repositorio**: el proyecto no está bajo control de versiones (git) y no tiene pruebas automatizadas.
