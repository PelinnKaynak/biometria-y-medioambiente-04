# src/servidor_rest

Servidor REST: Node.js con Express. Recibe las peticiones de la app y de la web y llama a la lógica de negocio.

Diseño: `doc/servidor_rest_design.md`

## Cómo arrancarlo

1. XAMPP: **Start** en MySQL. La BD `aeris` tiene que existir (importar `src/bd/usuarios.sql` en phpMyAdmin).
2. Instalar dependencias (solo la primera vez):
   ```
   cd src/logica
   npm install
   cd ../servidor_rest
   npm install
   ```
3. Copiar `.env.ejemplo` como `.env` (con XAMPP no hace falta cambiar nada).
4. `npm start` → `Servidor REST de AERIS escuchando en http://localhost:8080`

## Tests

Con MySQL en marcha: `npm test` aquí y en `src/logica`. Usan la BD `aeris_test`, nunca `aeris`.
