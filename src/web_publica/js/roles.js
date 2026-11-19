// ------------------------------------------------------------
// roles.js
// Consultas sobre los roles del usuario que ha iniciado sesión.
// Las usan la web pública y el panel de administración, para
// que las dos decidan lo mismo (T048).
//
// Una cuenta puede tener varios roles a la vez (por ejemplo,
// técnico y portador). El servidor los manda en el login como
// tres campos: esAdministrador, esTecnico y esPortador. Además
// manda «rol», que es solo el más alto de todos (administrador,
// técnico, portador o ciudadano) y se mantiene por
// compatibilidad.
//
// Si la sesión trae los tres campos, se usan esos. Si no los
// trae (la lógica fake antigua o una sesión guardada antes de
// este cambio), se mira «rol» como antes.
// ------------------------------------------------------------

// --------------------------------------------------------
// usuario: Usuario | null --> rolDe() --> Text
//
// Usuario = ( rol: Text, esAdministrador: B, esTecnico: B,
//             esPortador: B, ... )
// Devuelve «rol» en mayúsculas, o "" si no hay sesión.
// --------------------------------------------------------
function rolDe(usuario) {
    return usuario && usuario.rol ? String(usuario.rol).toUpperCase() : "";
}

// --------------------------------------------------------
// usuario: Usuario | null --> tieneRolesMultiples() --> B
//
// ¿La sesión trae los campos esAdministrador, esTecnico y
// esPortador? Con que venga uno basta.
// --------------------------------------------------------
function tieneRolesMultiples(usuario) {
    return Boolean(usuario) && ["esAdministrador", "esTecnico", "esPortador"]
        .some(campo => typeof usuario[campo] === "boolean");
}

// --------------------------------------------------------
// usuario: Usuario | null, campo: Text, rol: Text --> tieneRol() --> B
// --------------------------------------------------------
function tieneRol(usuario, campo, rol) {
    if (!usuario) return false;
    if (tieneRolesMultiples(usuario)) return usuario[campo] === true;
    return rolDe(usuario) === rol;
}

// --------------------------------------------------------
// usuario: Usuario | null --> esAdministrador() --> B
// --------------------------------------------------------
function esAdministrador(usuario) {
    return tieneRol(usuario, "esAdministrador", "ADMINISTRADOR");
}

// --------------------------------------------------------
// usuario: Usuario | null --> esTecnico() --> B
// --------------------------------------------------------
function esTecnico(usuario) {
    return tieneRol(usuario, "esTecnico", "TECNICO");
}

// --------------------------------------------------------
// usuario: Usuario | null --> esPortador() --> B
//
// ¿Tiene sensor? Un administrador o un técnico también puede
// ser portador.
// --------------------------------------------------------
function esPortador(usuario) {
    return tieneRol(usuario, "esPortador", "PORTADOR");
}

// --------------------------------------------------------
// usuario: Usuario | null --> tieneAccesoPanel() --> B
//
// El panel de administración es para administradores y
// técnicos.
// --------------------------------------------------------
function tieneAccesoPanel(usuario) {
    return esAdministrador(usuario) || esTecnico(usuario);
}

// --------------------------------------------------------
// usuario: Usuario | null --> tipoDeUsuario() --> TipoUsuario
//
// TipoUsuario = { ADMINISTRADOR, TECNICO, USUARIO, SIN_SESION }
// Si tiene varios roles, manda el más alto: primero
// administrador, después técnico y, si no es ninguno de los
// dos, es un usuario (portador o ciudadano).
// --------------------------------------------------------
function tipoDeUsuario(usuario) {
    if (!usuario) return "SIN_SESION";
    if (esAdministrador(usuario)) return "ADMINISTRADOR";
    if (esTecnico(usuario)) return "TECNICO";
    return "USUARIO";
}

if (typeof module !== "undefined") {
    module.exports = {
        rolDe, tieneRolesMultiples, esAdministrador, esTecnico, esPortador,
        tieneAccesoPanel, tipoDeUsuario
    };
}
