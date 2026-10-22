# CineFlex - QA en Producción

> 🎥 **VIDEO DE SUSTENTACIÓN:** [Ver video en Google Drive](https://drive.google.com/drive/folders/1HkY5xIvW7G1qdpv-T4B90XSC5d79btF4?usp=sharing)

Proyecto integrador de aseguramiento de calidad para **CineFlex**, una plataforma web de venta de boletos de cine. Incluye el entorno simulado (Frontend + Backend), las suites de automatización (API y UI), la prueba de carga y el pipeline de integración continua.

## Tabla de contenido

1. [Arquitectura del repositorio](#arquitectura-del-repositorio)
2. [Requisitos previos](#requisitos-previos)
3. [Instalación y despliegue](#instalación-y-despliegue)
4. [Fase A - Estrategia de pruebas](#fase-a---estrategia-de-pruebas)
5. [Fase B - Pruebas de API (Postman / Newman)](#fase-b---pruebas-de-api-postman--newman)
6. [Fase C - Pruebas de UI (Selenium + POM)](#fase-c---pruebas-de-ui-selenium--pom)
7. [Fase D - Pruebas de rendimiento (JMeter)](#fase-d---pruebas-de-rendimiento-jmeter)
8. [Pipeline CI/CD (GitHub Actions)](#pipeline-cicd-github-actions)
9. [Datos de prueba](#datos-de-prueba)

## Arquitectura del repositorio

```
qa-cineflex-project/
├── README.md
├── estrategia_pruebas.html         # Fase A
├── backend/                        # API REST simulada (Express + Helmet + Morgan)
│   ├── server.js
│   └── package.json
├── frontend/                       # Cliente web simulado (servido por el backend)
│   ├── index.html
│   └── styles.css
├── api_tests/                      # Fase B
│   ├── CineFlex_API_Collection.json
│   └── CineFlex_Environment.json
├── ui_tests/                       # Fase C
│   ├── pages/                      # Page Object Model (sin aserciones)
│   │   ├── LoginPage.js
│   │   ├── CarteleraPage.js
│   │   └── ReservaPage.js
│   ├── test_suite.js               # 18 casos de prueba (aserciones aquí)
│   └── package.json
├── performance/                    # Fase D
│   └── prueba_carga.jmx
└── .github/workflows/qa-pipeline.yml
```

**Capas simuladas**

| Capa | Implementación en el mock |
|------|---------------------------|
| Frontend (UI) | `frontend/index.html` con IDs y clases estables para Selenium |
| Backend (API REST) | Express con JWT, Helmet (cabeceras) y Morgan (trazabilidad) |
| Base de datos | Estructuras en memoria (se reinician con `POST /api/test/reset`) |
| Pasarela de pagos | **Stub** determinista dentro de `server.js` (`pasarelaPagosStub`) |

## Requisitos previos

- **Node.js 20 o superior** y npm.
- **Google Chrome o Chromium** para ejecutar las pruebas de UI. Si hace falta, configura `CHROME_BIN` y `CHROMEDRIVER_PATH`.
- **Apache JMeter 5.6.3 o superior**, solo para ejecutar las pruebas de rendimiento.

## Instalación y despliegue

```bash
# 1. Clonar el repositorio
git clone https://github.com/fav1angr1sales/TALLER-CINEFLEX.git
cd TALLER-CINEFLEX

# 2. Instalar dependencias del backend
cd backend
npm install

# 3. Levantar el servidor (también sirve el frontend)
npm start            # producción simple
# npm run dev        # recarga automática con nodemon
```

Abrir **http://localhost:3000** en el navegador. Verificación rápida: `http://localhost:3000/api/health` debe responder `{"estado":"ok"}`.

## Fase A - Estrategia de pruebas

El documento [`estrategia_pruebas.html`](estrategia_pruebas.html) contiene: enfoque de integración con Stub de la pasarela de pagos, requisitos funcionales y no funcionales, estrategia de regresión y la comparativa Selenium vs Cypress.

## Fase B - Pruebas de API (Postman / Newman)

Con el backend levantado:

```bash
npx newman run api_tests/CineFlex_API_Collection.json -e api_tests/CineFlex_Environment.json
```

| # | Endpoint | Qué se valida |
|---|----------|---------------|
| 1 | `POST /api/login` | 200 OK, JSON con token, formato JWT de 3 segmentos, **token guardado dinámicamente** en la variable de entorno `token`, usuario correcto |
| 2 | `GET /api/cartelera` | 200 OK, JSON válido, **SLA < 300 ms**, estructura de películas, cabeceras de Helmet |
| 3 | `POST /api/reserva` | Prueba negativa con tarjeta falsa: 400/402, mensaje exacto, código de error de negocio, sin ticket |

> Para importar en Postman: *Import* → seleccionar ambos archivos de `api_tests/` → elegir el entorno **CineFlex Local**.

## Fase C - Pruebas de UI (Selenium + POM)

```bash
# Con el backend levantado en otra terminal
cd ui_tests
npm install
npm test
```

Variables opcionales: `BASE_URL`, `HEADLESS=false` (ver el navegador), `CHROME_BIN`, `CHROMEDRIVER_PATH`.

**Patrón POM:** las clases de `pages/` solo contienen localizadores (IDs y CSS selectors) y acciones. Todas las aserciones están en `test_suite.js`. No se usa ningún XPath.

| Módulo | Casos |
|--------|-------|
| Login | TC01-TC06: campos visibles, validación de vacíos, credenciales erróneas, **bloqueo tras 3 intentos**, bloqueo persistente, **login exitoso con título "Cartelera"** |
| Cartelera | TC07-TC09: listado, filtro por género, nombre de usuario |
| Reserva y pago | TC10-TC15: mapa de asientos, asiento ocupado, selección, tarjeta rechazada, **flujo E2E con ticket virtual**, asiento ocupado tras compra |
| Navegación segura | TC16-TC18: **cerrar sesión**, **botón "Atrás" tras logout**, acceso directo sin sesión |

## Fase D - Pruebas de rendimiento (JMeter)

El plan [`performance/prueba_carga.jmx`](performance/prueba_carga.jmx) simula el estreno:

- **Thread Group:** 500 usuarios virtuales, ramp-up de 15 segundos, 1 iteración.
- **Flujo por usuario:** `POST /api/login` (extrae el JWT con un JSON Extractor) → `GET /api/asientos/1` con `Authorization: Bearer ${token}`.
- **Aserciones:** código 200 en ambas peticiones y presencia de `disponibles` en la respuesta.
- **Listeners:** Summary Report y Aggregate Report.

Ejecución (con el backend levantado):

```bash
# Modo GUI: abrir el .jmx, ejecutar y mirar "Summary Report"
jmeter -t performance/prueba_carga.jmx

# Modo consola con reporte HTML
jmeter -n -t performance/prueba_carga.jmx -l performance/resultados.jtl -e -o performance/reporte
```

## Pipeline CI/CD (GitHub Actions)

El archivo [`.github/workflows/qa-pipeline.yml`](.github/workflows/qa-pipeline.yml) se ejecuta en cada `push` y `pull_request` y define dos jobs:

1. **api-tests:** instala dependencias, levanta el backend, ejecuta la colección con **Newman** y publica el reporte JUnit. Si una aserción falla, Newman devuelve un código de salida distinto de 0 y el job queda en rojo.
2. **ui-tests:** levanta backend + frontend y ejecuta la suite de Selenium en Chrome headless.

**Para que un fallo bloquee realmente la integración** hay que activar la protección de rama en GitHub:
*Settings → Branches → Add rule (`main`) → Require status checks to pass before merging → seleccionar* `API Tests (Postman / Newman)` *y* `UI Tests (Selenium + POM)`.

## Datos de prueba

| Dato | Valor |
|------|-------|
| Usuario válido | `test@cineflex.com` / `Cine1234` |
| Tarjeta aprobada | `4111 1111 1111 1111`, venc. `12/30`, CVV `123` |
| Tarjeta rechazada por el banco | `4000 0000 0000 0002` (402) |
| Fondos insuficientes | `4000 0000 0000 9995` (402) |
| Tarjeta inválida (Luhn) | `1234 5678 9012 3456` (400) |
| Asientos ocupados por defecto | `A1`, `A2`, `B3` |
| Reiniciar estado del servidor | `POST /api/test/reset` |

## Integrantes

_FAVIAN STIVEN GRISALES RIVADENEIRA
KIWIN DAMIAN BURBANO CABEZAS