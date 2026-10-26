# Guía de estilos — OMA Digital

Plantilla del sistema de diseño usado en la vista de **OMA Digital** (React + Vite, CSS plano sin frameworks).
Sirve para replicar el mismo aspecto en otros proyectos o en nuevas pantallas de este.

> **Concepto:** glassmorfismo con estilo macOS / iOS — tipografía de sistema, materiales translúcidos
> (*vibrancy*), radios amplios, botones tipo píldora y azul Apple como único color de acento.

Archivos de origen (`frontend/src/`):

| Archivo | Contenido |
|---|---|
| `index.css` | Tokens, base, materiales, layout, botones, campos, avisos, modal, login, responsivo |
| `admin.css` | Campos con ícono, etiquetas, filas de lista, tarjetas de administración |
| `matriz.css` | Chips de nivel, tabla OMA, filtros, tiles de resumen, gráficas de barras |
| `evaluacion.css` | Selector de líneas, paneles destacados |
| `calendario.css` | Calendario mensual, agenda, estados de programación |

---

## 1. Tokens (variables CSS)

Copia este bloque tal cual como punto de partida de cualquier hoja de estilos nueva.

```css
:root {
    /* Fondo */
    --bg: #f2f2f7;

    /* Texto: primario, secundario, terciario */
    --txt1: #1d1d1f;
    --txt2: #515154;
    --txt3: #86868b;

    /* Acento (azul Apple) */
    --accent: #0071e3;
    --accent-hover: #0077ed;
    --accent-soft: rgba(0, 113, 227, 0.10);

    /* Estados */
    --success: #1a7f37;
    --success-soft: rgba(52, 199, 89, 0.14);
    --danger: #d70015;
    --danger-soft: rgba(255, 59, 48, 0.10);
    --warning: #b25000;

    /* Materiales (vibrancy) */
    --glass: rgba(255, 255, 255, 0.62);
    --glass-strong: rgba(255, 255, 255, 0.80);
    --glass-border: rgba(255, 255, 255, 0.70);
    --hairline: rgba(0, 0, 0, 0.08);
    --divider: rgba(60, 60, 67, 0.12);
    --fill: rgba(120, 120, 128, 0.12);
    --fill-strong: rgba(120, 120, 128, 0.20);
    --blur: saturate(180%) blur(24px);

    /* Sombras */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 2px 6px rgba(0, 0, 0, 0.05), 0 12px 32px rgba(0, 0, 0, 0.07);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.10), 0 24px 64px rgba(0, 0, 0, 0.12);

    /* Radios */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 18px;
    --radius-xl: 24px;

    /* Medidas de layout */
    --sidebar-w: 248px;
    --topbar-h: 56px;   /* 52px en móvil */
    --tabbar-h: 64px;
}
```

---

## 2. Paleta de colores

### Base

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#f2f2f7` | Fondo de la app (gris sistema iOS) |
| `--txt1` | `#1d1d1f` | Títulos, texto principal |
| `--txt2` | `#515154` | Subtítulos, etiquetas de campo |
| `--txt3` | `#86868b` | Metadatos, ayudas, placeholders |
| `--accent` | `#0071e3` | Botón primario, ítem activo, enlaces, foco |
| `--success` | `#1a7f37` | Texto de éxito |
| `--danger` | `#d70015` | Errores, acciones destructivas |
| `--warning` | `#b25000` | Advertencias |

### Colores de sistema (puntos de estado, interruptores)

| Nombre | Valor | Uso |
|---|---|---|
| Verde | `#34c759` | Activo / realizado / interruptor encendido |
| Ámbar | `#ff9f0a` | En espera |
| Rojo | `#ff3b30` | Vencido / bloqueado |
| Gris | `#aeaeb2` | Inactivo |
| Azul datos | `#2a78d6` | Pendiente (calendario), nivel planta |
| Ámbar datos | `#e09600` | Parcial / brecha |

### Niveles OMA (mismos colores que el Excel original)

| Nivel | Nombre | Color |
|---|---|---|
| 1 (valor < 2) | Naranja | `#FFC000` |
| 2 (valor < 3) | Amarillo | `#FFFF00` |
| 3 (valor = 3) | Verde | `#92D050` |
| Sin dato | — | `#E5E7EB` |

Definidos en `frontend/src/utils/oma.js` (`COLORES_NIVEL`, `colorDeValor()`).

### Fondo de pantalla

Tres gradientes radiales muy suaves (azul, violeta, celeste) fijos sobre `--bg`, que dan color al cristal:

```css
body {
    background-color: var(--bg);
    background-image:
        radial-gradient(1200px 800px at -10% -20%, rgba(0, 113, 227, 0.18), transparent 60%),
        radial-gradient(900px 700px at 110% 0%, rgba(175, 82, 222, 0.14), transparent 60%),
        radial-gradient(1000px 800px at 50% 120%, rgba(90, 200, 250, 0.16), transparent 60%);
    background-attachment: fixed;
}
```

---

## 3. Tipografía

Fuente de sistema (San Francisco en Apple, Segoe UI Variable en Windows). Sin fuentes web.

```css
:root {
    font-family:
        -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
        "Segoe UI Variable Text", "Segoe UI", Inter, "Helvetica Neue",
        Arial, sans-serif;
    font-size: 15px;
    line-height: 1.45;
    letter-spacing: -0.01em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
```

Monoespaciada (contraseñas, códigos): `"SF Mono", ui-monospace, Menlo, Consolas, monospace`.

| Rol | Tamaño | Peso | Extra |
|---|---|---|---|
| Título de página (`.page-title`) | 30px (26px móvil) | 700 | `letter-spacing: -0.025em` |
| Título login | 24px | 700 | `-0.02em` |
| Valor KPI (`.resumen-tile-valor`) | 28px | 700 | `tabular-nums` |
| Título de modal / tarjeta | 17px | 700 | |
| Cuerpo / subtítulo | 15px | 400 | color `--txt2` |
| Botones, ítems de menú | 14px | 500 (600 activo) | |
| Etiqueta de campo | 13px | 600 | color `--txt2` |
| Metadatos, ayudas | 12px | 400–500 | color `--txt3` |
| Encabezado de sección | 11px | 600–700 | MAYÚSCULAS, `letter-spacing: 0.04em` |

Reglas:
- Números en tablas, chips y KPIs siempre con `font-variant-numeric: tabular-nums`.
- Botones, inputs y selects heredan la fuente: `font: inherit; letter-spacing: inherit;`.

---

## 4. Materiales (cristal)

La pieza clave del estilo. Toda tarjeta, panel o modal usa una de estas dos clases.

```css
.glass,
.glass-strong {
    background: var(--glass);
    -webkit-backdrop-filter: var(--blur);
    backdrop-filter: var(--blur);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.6),   /* brillo superior */
        var(--shadow-sm);
}

.glass-strong {                                    /* modales, login */
    background: var(--glass-strong);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        var(--shadow-lg);
}
```

Uso: `<div class="glass resumen-tile">…</div>` · `<div class="glass-strong validation-modal">…</div>`.

Barras fijas (sidebar, topbar, tabbar) usan el mismo `backdrop-filter: var(--blur)` con fondo
`rgba(246,246,248,0.66)` / `rgba(255,255,255,0.62)` / `rgba(249,249,249,0.82)` y un borde `--hairline`.

---

## 5. Espaciado, radios y sombras

- **Escala de espacios habitual:** 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 24 · 28 px.
- **Padding de contenido:** 28px escritorio, 18px × 16px móvil. Ancho máximo `1520px`.
- **Padding de tarjetas:** 14–16px (tiles, filas), 22–24px (modales, tarjetas de mensaje).
- **Gaps de grid:** 10–14px entre tarjetas, 18px entre bloques grandes.

| Radio | Valor | Uso |
|---|---|---|
| `--radius-sm` | 8px | Ítems de menú, botones de acción dentro de campos |
| — | 9–10px | Chips de nivel, inputs, control segmentado |
| `--radius-md` | 12px | Avisos, filas internas, listas |
| `--radius-lg` | 18px | Tarjetas de cristal |
| `--radius-xl` | 24px | Modales, tarjeta de login |
| píldora | `999px` / `980px` | Botones, etiquetas, filtros, barras de progreso |

| Sombra | Uso |
|---|---|
| `--shadow-sm` | Tarjetas, botón secundario, hover de chips |
| `--shadow-md` | Hover de tarjetas elevadas |
| `--shadow-lg` | Modales, avisos flotantes, menú flotante |

---

## 6. Layout de la aplicación

```
┌──────────┬─────────────────────────────────────────┐
│ SIDEBAR  │ TOPBAR (56px, fija, translúcida)        │
│ 248px    ├─────────────────────────────────────────┤
│ fija     │ .app-content (max 1520px, padding 28px) │
│ cristal  │   .page-heading                         │
│          │     .page-title / .page-subtitle        │
│ marca    │   tarjetas .glass …                     │
│ (pie)    │                                         │
└──────────┴─────────────────────────────────────────┘
Móvil (≤ 860px): sidebar oculta + TABBAR inferior estilo iOS (64px)
```

Clases de estado en el contenedor `.app-shell`:
`menu-fijo` / `menu-flotante` + `menu-abierto` / `menu-cerrado`.

```html
<div class="app-shell menu-fijo menu-abierto">
  <aside class="sidebar">…</aside>
  <header class="topbar">…</header>
  <main class="app-main">
    <div class="app-content">
      <div class="page-heading">
        <h1 class="page-title">Título</h1>
        <p class="page-subtitle">Descripción breve</p>
      </div>
      …
    </div>
  </main>
  <nav class="tabbar">…</nav>
</div>
```

**Sidebar (estilo Finder):** ítems de 14px con ícono SVG de 18px en color `--accent`;
hover `--fill`, activo `--fill-strong` + peso 600. Encabezados de sección en mayúsculas de 11px.

**Avatar:** círculo de 32px con gradiente `linear-gradient(135deg, #5ac8fa, #0071e3)` e iniciales blancas.

---

## 7. Componentes

### Botones (píldora)

```html
<button class="btn-primary">Guardar</button>
<button class="btn-secondary">Cancelar</button>
<button class="btn-plain">Ver detalle</button>
<button class="btn-primary btn-peligro">Eliminar</button>
<button class="btn-plain peligro">Quitar</button>
<button class="btn-secondary btn-icon"><svg…/></button>
```

| Variante | Aspecto |
|---|---|
| `.btn-primary` | Fondo `--accent`, texto blanco |
| `.btn-secondary` | Blanco 85%, borde `--hairline`, `--shadow-sm` |
| `.btn-plain` | Transparente, texto `--accent`, hover `--accent-soft` |
| `.btn-peligro` / `.peligro` | Variante roja con `--danger` |
| Tamaños | `.btn-sm` (30px) · normal (36px) · `.btn-lg` (44px) · `.btn-icon` (36×36) |

Comunes: `border-radius: 980px`, `font-size: 14px`, `font-weight: 500`, `:active { transform: scale(0.97) }`,
`:disabled { opacity: 0.45 }`.

### Campos

```html
<div class="campo">
  <label class="campo-label">Correo</label>
  <input class="campo-input" />
  <div class="campo-ayuda">Texto de ayuda</div>
  <div class="campo-error">Mensaje de error</div>
</div>
<select class="form-select">…</select>
```

- Alto mínimo 40px, radio 10px, fondo blanco 90%, borde `--hairline`.
- **Foco:** `border-color: var(--accent); box-shadow: 0 0 0 4px rgba(0,113,227,0.18);`
- **Inválido:** `aria-invalid="true"` → borde `--danger` + halo `--danger-soft`.
- `.form-select` usa `appearance: none` y una flecha SVG gris (`#86868b`) a la derecha.
- `.campo-con-icono` + `.campo-icono` para ícono a la izquierda; `.campo-accion` para botón a la derecha (ver contraseña).

### Control segmentado (macOS)

```html
<div class="segmentado">
  <button class="activo">Tabla</button>
  <button>Tarjetas</button>
</div>
```

Contenedor `--fill` con padding 2px y radio 9px; el botón activo es blanco con sombra sutil.

### Interruptor (iOS)

```html
<label class="switch">
  Recordarme
  <input type="checkbox" />
  <span class="switch-pista"></span>
</label>
```

Pista 44×26px, `--fill-strong` apagado, `#34c759` encendido; perilla blanca de 22px.

### Etiquetas y puntos de estado

```html
<span class="etiqueta">Calidad</span>
<span class="etiqueta azul">Admin</span>
<span class="estado-punto verde"></span>   <!-- verde | ambar | rojo | gris -->
```

### Filtros tipo chip

```html
<div class="filtro-chips">
  <button class="filtro-chip activo">Todos</button>
  <button class="filtro-chip">Línea 1</button>
</div>
```

Píldoras de 30px; activo = fondo `--accent` y texto blanco. En móvil se desplazan horizontalmente.

### Chip de nivel OMA

Caja de 40×34px (52px para decimales), radio 9px, peso 600, `tabular-nums`; el fondo se asigna inline con
`colorDeValor()`. Estados: `.vacio` (borde discontinuo), `.editable` (hover se eleva 1px),
`.pendiente` (borde rojo), `.activo` (doble anillo blanco + `--txt1`), `.bloqueado` (candado 🔒).

### Avisos

```html
<div class="aviso aviso-error">…</div>
<div class="aviso aviso-exito">…</div>
<div class="aviso aviso-info">…</div>
```

Fondo suave del color + texto del color + borde al 18–25% de opacidad, radio `--radius-md`.

### Aviso flotante (toast)

`.aviso-flotante` + `.visible`: abajo a la derecha (centrado sobre la tabbar en móvil), cristal blanco 86%,
`--shadow-lg`, ícono circular verde `#34c759`. Entra con `translateY(12px) scale(0.98)` → `none`.

### Modal (hoja macOS)

```html
<div class="modal-overlay">          <!-- + .hoja-movil en móvil -->
  <div class="glass-strong validation-modal">
    <div class="validation-header">
      <span class="validation-icon">⚠️</span>
      <div>
        <h2 class="validation-title">Título</h2>
        <p class="validation-description">Descripción</p>
      </div>
    </div>
    <div class="validation-actions">
      <button class="btn-secondary">Cancelar</button>
      <button class="btn-primary">Aceptar</button>
    </div>
  </div>
</div>
```

Overlay `rgba(0,0,0,0.22)` + `blur(4px)`; modal de 460px máx. con radio `--radius-xl`.
En móvil (`.hoja-movil`) se convierte en hoja inferior con esquinas superiores de 22px y botones apilados de 46px.

### Tiles de resumen (KPI)

```html
<div class="resumen-grid">
  <div class="glass resumen-tile">
    <div class="resumen-tile-label">Promedio general</div>
    <div class="resumen-tile-valor"><i style="background:#92D050"></i>2.75</div>
    <div class="resumen-tile-nota">12 criterios</div>
  </div>
</div>
```

Grid de 4 columnas (2 en móvil). Etiqueta 12px `--txt3`, valor 28px/700.

### Progreso y carga

- `.progress-track` (6px, `--fill`, píldora) + `.progress-bar` (`--accent`, transición de ancho 0.35s).
- `.loading-spinner`: 28px, borde `--fill-strong` con borde superior `--accent`, rotación 0.8s.
- `.boton-spinner`: 16px blanco, para dentro de `.btn-primary`.

### Panel destacado

Tarjeta de cristal con `border-left: 3px solid var(--accent)` y título de 12px/700 en `--accent`
(`.filtro-supervision`, `.panel-niveles`). Úsalo para controles exclusivos de administrador.

### Tablas

Encabezados `th` con fondo `rgba(246,246,248,0.85)`, filas con hover `rgba(0,113,227,0.035)`,
separadores `--divider`, pie `tfoot` con fondo `rgba(246,246,248,0.6)`.

---

## 8. Movimiento

| Elemento | Duración | Curva |
|---|---|---|
| Hover de botones / ítems | 0.15s | `ease` |
| Pulsación (`scale(0.97)`) | 0.1s | `ease` |
| Sidebar, topbar, hoja móvil, toast | 0.22–0.28s | `cubic-bezier(0.32, 0.72, 0, 1)` (curva iOS) |
| Aparición de página/modal | 0.2–0.25s | `ease`, `opacity 0 → 1` + `translateY(6px) → 0` |

```css
@keyframes aparecer {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
}
```

Respetar `prefers-reduced-motion: reduce` desactivando transiciones de layout.

---

## 9. Accesibilidad y detalles globales

```css
* { box-sizing: border-box; }
::selection { background: rgba(0, 113, 227, 0.22); }
:focus-visible { outline: 3px solid rgba(0, 113, 227, 0.45); outline-offset: 2px; }

/* Scrollbar fina tipo macOS */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.18);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
}
::-webkit-scrollbar-track { background: transparent; }

/* Texto solo para lectores de pantalla */
.sr-only {
    position: absolute; width: 1px; height: 1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}
```

- Áreas táctiles mínimas de 36px (44–46px en botones principales de móvil).
- Estados con `aria-invalid`, `aria-hidden` y `:focus-visible` en lugar de solo color.

---

## 10. Responsivo

| Punto de corte | Cambios |
|---|---|
| `max-width: 1100px` | Gráficas a una columna; filas de usuario a 2 columnas |
| `max-width: 860px` | Topbar 52px, aparece logo y tabbar inferior, se oculta texto de usuario, padding 18×16px, título 26px, modales como hoja inferior, grids a 1–2 columnas, botones de acción a ancho completo |
| `max-height: 640px` | La marca del pie de la sidebar se compacta |

Usar `env(safe-area-inset-bottom)` en tabbar, toasts y hojas para iPhone. `min-height: 100dvh` en el login.

---

## 11. Reglas rápidas para nuevas pantallas

1. Toda superficie es `.glass` (o `.glass-strong` si flota sobre otra cosa).
2. Un solo color de acento: `--accent`. Rojo solo para errores o acciones destructivas.
3. Texto en tres niveles: `--txt1`, `--txt2`, `--txt3`. No inventar grises nuevos.
4. Botones y etiquetas siempre en píldora; tarjetas en `--radius-lg`.
5. Separadores con `--hairline` / `--divider`, nunca bordes oscuros.
6. Fondos neutros con `--fill` / `--fill-strong` (hover, pistas, contenedores secundarios).
7. Números con `tabular-nums`.
8. Nombres de clases en español y descriptivos (`.tarjeta-…`, `.barra-…`, `.lista-…`), igual que el resto del proyecto.
9. Probar a 860px y a 375px de ancho antes de dar por terminada una vista.
