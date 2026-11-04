# Diseño del componente: web pública

**Equipo:** 04 – SenseTech · **Sprint:** 2 · **Implementación:** `src/web_publica/` (HTML, CSS y JavaScript). La sirve el servidor REST (`servidor_rest_design.md`).

---

## 1. Restablecer la contraseña (T003 / T016 · H002)

Página a la que lleva el enlace del correo «Recuperar contraseña»: `http://localhost:8080/restablecer.html?token=<token>`.

```text
Correo --enlace--> restablecer.html --POST /restablecerContrasenya { token, contrasena }--> ServidorREST
                     204 --> «Contraseña cambiada. Ya puedes iniciar sesión en la app…»
                     400 --> «El enlace ha caducado o ya se ha usado. Pide uno nuevo desde la app.»
```

### Funciones (restablecer.html)

```text
  contrasena: Texto             --> esContrasenaSegura() --> V/F     (mín. 8, letra y número)
  campo: Input, idError: Texto,
  texto: Texto | null           --> marcar() -->                     (error debajo del campo)
  texto: Texto, bien: V/F       --> mostrarMensaje() -->
  evento                        --> enviar (submit) -->              (comprueba y envía)
```

## 2. Aclaraciones

- **Mismas reglas que la app:** contraseña de 8 caracteres o más con al menos una letra y un número; las dos contraseñas deben coincidir.
- **Sin token** en la URL, la página no muestra el formulario y pide un enlace nuevo.
- El enlace caduca a los **30 minutos** y solo sirve una vez (al cambiar la contraseña deja de valer).
- Colores y tipografía de AERIS (los mismos que en la app).

## 3. Pruebas

`test_api.js` (servidor) comprueba que `GET /restablecer.html` devuelve la página. El flujo completo (pedir enlace → abrir página → cambiar contraseña → iniciar sesión con la nueva; la vieja ya no vale; el enlace no se puede repetir) se ha probado en el navegador.
