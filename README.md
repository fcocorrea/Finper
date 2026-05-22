# Finper — Finanzas Personales

Plataforma web de finanzas personales para registrar y gestionar ingresos, gastos, cuentas por cobrar y cuentas por pagar.

## Tecnologías
- **HTML5** + **CSS3** + **JavaScript** (vanilla, sin frameworks)
- **Chart.js** — gráficos interactivos
- **SheetJS (XLSX)** — importación de archivos .csv y .xlsx
- **localStorage** — persistencia de datos local

## Estructura
```
Finper/
├── index.html          # Estructura principal (SPA)
├── styles.css          # Sistema de diseño (CSS variables)
├── js/
│   ├── store.js        # Capa de datos (CRUD + localStorage)
│   ├── ui.js           # Utilidades UI (modales, toast, formatos)
│   ├── dashboard.js    # Métricas y gráficos
│   ├── table.js        # Vista tabla y tabla dinámica
│   ├── editor.js       # Editor de columnas y categorías
│   ├── importer.js     # Importador CSV/XLSX
│   └── app.js          # Orquestador principal
└── README.md
```

## Características
- **Dashboard**: métricas financieras, gráfico de ingresos vs gastos, gráfico dinámico por categoría/tipo/medio de pago
- **Tabla**: vista tabular con edición y eliminación inline
- **Tabla Dinámica**: agrupación por mes×categoría (gastos), mes×fuente (ingresos), persona×tipo (cuentas)
- **Cuotas**: al registrar gastos en cuotas, se generan automáticamente los registros futuros
- **Autocompletado**: sugerencias basadas en datos previos + predicción de categoría
- **Importación**: soporte para .csv y .xlsx con validación de encabezados
- **Edición**: gestión de columnas y categorías de gastos

## Uso
Abrir `index.html` directamente o servir con cualquier servidor estático:
```bash
npx serve
```
