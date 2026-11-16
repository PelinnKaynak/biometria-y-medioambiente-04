// ------------------------------------------------------------
// roles.js
// Consultas sobre el rol del usuario que ha iniciado sesión.
// Las usan la web pública y el panel de administración, para
// que las dos decidan lo mismo.
//
// En la BD el rol es uno de estos: 'administrador', 'tecnico',
// 'portador' o 'ciudadano'. El servidor lo manda en
// minúsculas, así que se compara sin tener en cuenta
// mayúsculas.
//
// ¿Es administrador? sí o no. ¿Es técnico? sí o no. Si no es
// ninguno de los dos, se trata como un usuario normal
// (portador o ciudadano).
// ------------------------------------------------------------

// --------------------------------------------------------
// usuario: Usuario | null --> rolDe() --> Text
//
// Usuario = ( rol: Text, ... )
// Devuelve el rol en mayúsculas, o "" si no hay sesión.
// --------------------------------------------------------
function rolDe(usuario) {
    return usuario && usuario.rol ? String(usuario.rol).toUpperCase() : "";
}

// --------------------------------------------------------
// usuario: Usuario | null --> esAdministrador() --> B
// --------------------------------------------------------
function esAdministrador(usuario) {
    return rolDe(usuario) === "ADMINISTRADOR";
}

// --------------------------------------------------------
// usuario: Usuario | null --> esTecnico() --> B
// --------------------------------------------------------
function esTecnico(usuario) {
    return rolDe(usuario) === "TECNICO";
}

// --------------------------------------------------------
// usuario: Usuario | null --> tipoDeUsuario() --> TipoUsuario
//
// TipoUsuario = { ADMINISTRADOR, TECNICO, USUARIO, SIN_SESION }
// Primero pregunta si es administrador, después si es técnico
// y, si no es ninguno de los dos, es un usuario (portador o
// ciudadano).
// --------------------------------------------------------
function tipoDeUsuario(usuario) {
    if (!usuario) return "SIN_SESION";
    if (esAdministrador(usuario)) return "ADMINISTRADOR";
    if (esTecnico(usuario)) return "TECNICO";
    return "USUARIO";
}

if (typeof module !== "undefined") {
    module.exports = { rolDe, esAdministrador, esTecnico, tipoDeUsuario };
}