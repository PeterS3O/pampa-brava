# Pampa Brava

Prototipo digital jugable de Pampa Brava, con partidas de 2, 3 y 4 jugadores, salas online, duelos por cartas y componentes físicos para impresión.

- Juego publicado: <https://pampa-brava.sanchezvallduvi.chatgpt.site/>
- Reglamento vigente: [`REGLAMENTO.md`](REGLAMENTO.md)

## Puesta en marcha

Requisitos:

- Node.js 22.13 o superior.
- npm 11 o compatible con `package-lock.json` versión 3.

```bash
npm ci
npm run dev
```

Comandos habituales:

```bash
npm test
npm run lint
npm run build
```

## Estructura

```text
app/                 Juego, interfaz y rutas de salas
assets/              Fuentes gráficas que no se sirven en la web
  print/             Arte en alta resolución para componentes físicos
  references/        Referencias visuales de diseño
db/                  Esquema de datos
drizzle/             Migraciones de base de datos
public/              Recursos que consume el sitio publicado
scripts/             Generadores del reglamento y componentes imprimibles
tests/               Pruebas de reglas y lógica del juego
output/              PDFs y renders generados; no se versionan
tmp/                 Previsualizaciones y archivos temporales; no se versionan
```

Las ilustraciones necesarias para ejecutar el juego viven en `public/`. Los originales de imprenta viven en `assets/` para evitar que el sitio web los incluya innecesariamente en cada publicación.

## Componentes para impresión

Los generadores de impresión usan Python. Se recomienda un entorno virtual separado:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-print.txt
python scripts/build_reglamento.py
python scripts/build_hexagonos_impresion.py
```

Los resultados quedan en `output/pdf/`. Esos archivos pueden compartirse mediante una GitHub Release o una carpeta compartida, pero no deben incorporarse al historial normal del repositorio.

## Forma de colaboración

1. Actualizar la rama estable `main`.
2. Crear una rama corta para el cambio: `feature/nombre`, `fix/nombre` o `art/nombre`.
3. Implementar y comprobar el cambio localmente.
4. Ejecutar `npm test` y `npm run build`.
5. Abrir un Pull Request con capturas cuando el cambio sea visual.
6. Publicar el sitio solamente después de integrar el cambio en la rama estable.

Más detalles en [`CONTRIBUTING.md`](CONTRIBUTING.md).
