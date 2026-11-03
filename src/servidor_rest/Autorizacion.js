// ---------------------------------------------------------------------------
// Fichero:     Autorizacion.js
// Descripción: Middleware de Express que protege las rutas: comprueba el
//              token de sesión (cabecera "Authorization: Bearer <token>") y,
//              si se indican, los roles que pueden usar la ruta.
//              Diseño en doc/servidor_rest_design.md. Tarea T016.
// Autores:     Equipo 04 – SenseTech
// Fecha:       03/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
'use strict';

// ---------------------------------------------------------------------------
// cabecera: Texto --> extraerToken() --> Texto | null
// What it does: returns the token of "Bearer <token>", or null.
// ---------------------------------------------------------------------------
function extraerToken(cabecera) {
    const partes = String(cabecera || '').trim().split(/\s+/);
    return partes.length === 2 && partes[0].toLowerCase() === 'bearer' ? partes[1] : null;
}

// ---------------------------------------------------------------------------
// logica: Logica, rolesPermitidos: Lista<Texto> --> requiereSesion() --> Middleware
// What it does: the route answers 401 if there is no valid session and 403 if
//               the user's rol is not in rolesPermitidos (empty list = any rol).
//               If it is allowed, it saves { idUsuario, rol } in peticion.usuario
//               and the token in peticion.token.
// ---------------------------------------------------------------------------
function requiereSesion(logica, rolesPermitidos = []) {
    return async (peticion, respuesta, siguiente) => {
        try {
            const token = extraerToken(peticion.get('Authorization'));
            const usuario = token ? await logica.comprobarSesion(token) : null;
            if (!usuario) {
                return respuesta.status(401).json({ error: 'Hay que iniciar sesión' });
            }
            if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
                return respuesta.status(403).json({ error: 'Tu rol no tiene permiso' });
            }
            peticion.usuario = usuario;
            peticion.token = token;
            siguiente();
        } catch (error) {
            siguiente(error);
        }
    };
}

module.exports = { extraerToken, requiereSesion };
