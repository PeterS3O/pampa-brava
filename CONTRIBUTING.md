# Colaborar en Pampa Brava

## Antes de empezar

- El reglamento funcional está en `REGLAMENTO.md`.
- La rama `main` representa la versión estable del juego.
- No mezcles cambios de reglas, rediseños visuales y exportaciones de imprenta en un mismo Pull Request.

## Ramas

Usá nombres breves y descriptivos:

- `feature/modo-cuatro-jugadores`
- `fix/retiro-horizontal`
- `ux/panel-duelo-mobile`
- `art/cartas-naturaleza`

## Qué debe versionarse

- Código del juego y sus pruebas.
- Migraciones y esquema de datos.
- Ilustraciones utilizadas por el sitio en `public/`.
- Originales necesarios para generar componentes físicos en `assets/`.
- Scripts y documentación.

No deben versionarse:

- `node_modules/`, `dist/` ni carpetas de compilación.
- PDFs generados y hojas listas para imprenta en `output/`.
- Capturas, renders intermedios o extracciones en `tmp/`.
- Entornos virtuales y cachés de Python.

## Lista de control para un Pull Request

- [ ] El cambio tiene un propósito único y está explicado.
- [ ] `npm test` finaliza correctamente.
- [ ] `npm run build` finaliza correctamente.
- [ ] Los cambios visuales incluyen captura de escritorio y móvil.
- [ ] Si cambia una regla, también se actualizaron las pruebas y `REGLAMENTO.md`.
- [ ] No se agregaron PDFs, temporales ni credenciales.

## Publicación

El sitio público es la versión estable. Los cambios deben revisarse antes de publicarse. Para pruebas compartidas de cambios grandes, conviene usar un sitio de ensayo separado en lugar de reemplazar la versión pública.
