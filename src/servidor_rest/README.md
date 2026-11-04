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

## Enviar de verdad el correo de recuperar contraseña

Sin configuración, el enlace aparece en esta consola. Para enviarlo por correo con Gmail:

1. En la cuenta de Gmail del equipo, activar la **verificación en dos pasos**.
2. Cuenta de Google → Seguridad → **Contraseñas de aplicaciones** → crear una (nombre: AERIS). Copiar el código de 16 letras.
3. Copiar `env.ejemplo` como `.env` y rellenar `SMTP_HOST=smtp.gmail.com`, `SMTP_PUERTO=587`, `SMTP_USUARIO` (el correo) y `SMTP_CONTRASENYA` (el código de 16 letras). `.env` no se sube a GitHub.
4. Reiniciar el servidor (`npm start`).

El enlace abre `http://localhost:8080/restablecer.html?token=...` (página de `src/web_publica`), así que hay que abrirlo en el ordenador donde corre el servidor. Cuando el servidor esté desplegado (T026), `URL_RESTABLECER` será su dirección pública.
