/** @jest-environment jsdom */

// ------------------------------------------------------------
// Pruebas del inicio de sesión (T013 · H002)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { LogicaFake } = require("../js/logica_fake");
const login = require("../js/login");

const html = fs.readFileSync(path.join(__dirname, "../login.html"), "utf8");

function cargarPagina() {
  document.documentElement.innerHTML = new DOMParser()
      .parseFromString(html, "text/html").documentElement.innerHTML;
}

function rellenar(correo, contrasena) {
  document.getElementById("correo").value = correo;
  document.getElementById("contrasena").value = contrasena;
}

const eventoFalso = () => ({ preventDefault: jest.fn() });

beforeEach(() => {
  cargarPagina();
  sessionStorage.clear();
});

describe("validarFormulario()", () => {
  test("acepta un correo y una contraseña correctos", () => {
    expect(login.validarFormulario("laura@correo.es", "laura1234")).toEqual([]);
  });

  test("rechaza un correo sin @", () => {
    expect(login.validarFormulario("lauracorreo.es", "laura1234")).toEqual([
      { campo: "correo", mensaje: "Escribe un correo válido, por ejemplo nombre@dominio.es" }
    ]);
  });

  test("rechaza la contraseña vacía", () => {
    expect(login.validarFormulario("laura@correo.es", "")).toEqual([
      { campo: "contrasena", mensaje: "Escribe tu contraseña" }
    ]);
  });

  test("rechaza una contraseña sin números", () => {
    const errores = login.validarFormulario("laura@correo.es", "contrasena");
    expect(errores).toHaveLength(1);
    expect(errores[0].campo).toBe("contrasena");
  });

  test("devuelve los dos errores si faltan los dos datos", () => {
    expect(login.validarFormulario("", "").map(e => e.campo)).toEqual(["correo", "contrasena"]);
  });
});

describe("paginaInicioSegunRol()", () => {
  test.each([
    ["ADMINISTRADOR", "../web_admin/panel_nodos.html"],
    ["TECNICO", "../web_admin/panel_nodos.html"],
    ["PORTADOR", "mi_cuenta.html"],
    ["PREMIUM", "mi_cuenta.html"]
  ])("%s va a %s", (rol, pagina) => {
    expect(login.paginaInicioSegunRol(rol)).toBe(pagina);
  });

  test("acepta el rol en minúsculas, como lo manda el servidor", () => {
    expect(login.paginaInicioSegunRol("administrador")).toBe("../web_admin/panel_nodos.html");
    expect(login.paginaInicioSegunRol("portador")).toBe("mi_cuenta.html");
  });

  test("lanza un error con un rol desconocido", () => {
    expect(() => login.paginaInicioSegunRol("INVITADO")).toThrow();
  });
});

describe("LogicaFake.iniciarSesion()", () => {
  const logica = new LogicaFake(0);

  test("inicia sesión con un usuario correcto y lo guarda", async () => {
    const r = await logica.iniciarSesion({ correo: "laura@correo.es", contrasena: "laura1234" });
    expect(r.correcto).toBe(true);
    expect(r.usuario.rol).toBe("PORTADOR");
    expect(logica.usuarioActual().correo).toBe("laura@correo.es");
  });

  test("falla con una contraseña incorrecta", async () => {
    const r = await logica.iniciarSesion({ correo: "laura@correo.es", contrasena: "otra" });
    expect(r.correcto).toBe(false);
    expect(r.error).toBe("Correo o contraseña incorrectos");
    expect(logica.usuarioActual()).toBeNull();
  });

  test("falla con un correo que no existe", async () => {
    const r = await logica.iniciarSesion({ correo: "nadie@correo.es", contrasena: "laura1234" });
    expect(r.correcto).toBe(false);
  });

  test("cerrarSesion() borra el usuario", async () => {
    await logica.iniciarSesion({ correo: "admin@aeris.es", contrasena: "admin1234" });
    logica.cerrarSesion();
    expect(logica.usuarioActual()).toBeNull();
  });
});

describe("enviarFormulario()", () => {
  const logica = new LogicaFake(0);

  test("lleva al administrador al panel de nodos", async () => {
    const irA = jest.fn();
    rellenar("admin@aeris.es", "admin1234");
    await login.enviarFormulario(eventoFalso(), logica, irA);
    expect(irA).toHaveBeenCalledWith("../web_admin/panel_nodos.html");
  });

  test("lleva a la portadora a Mi cuenta", async () => {
    const irA = jest.fn();
    rellenar("laura@correo.es", "laura1234");
    await login.enviarFormulario(eventoFalso(), logica, irA);
    expect(irA).toHaveBeenCalledWith("mi_cuenta.html");
  });

  test("muestra el aviso y marca los campos si los datos son incorrectos", async () => {
    const irA = jest.fn();
    rellenar("laura@correo.es", "otraClave99");
    await login.enviarFormulario(eventoFalso(), logica, irA);

    expect(irA).not.toHaveBeenCalled();
    expect(document.getElementById("mensaje-error").classList.contains("oculto")).toBe(false);
    expect(document.getElementById("texto-error").textContent).toBe("Correo o contraseña incorrectos");
    expect(document.getElementById("correo").classList.contains("error")).toBe(true);
    expect(document.getElementById("contrasena").classList.contains("error")).toBe(true);
  });

  test("no llama a la lógica si el formulario no es válido", async () => {
    const logicaEspia = { iniciarSesion: jest.fn() };
    rellenar("", "");
    await login.enviarFormulario(eventoFalso(), logicaEspia, jest.fn());

    expect(logicaEspia.iniciarSesion).not.toHaveBeenCalled();
    expect(document.getElementById("texto-error").textContent).toBe("Escribe tu correo electrónico");
  });

  test("si solo falla la contraseña, marca solo ese campo", async () => {
    rellenar("laura@correo.es", "corta");
    await login.enviarFormulario(eventoFalso(), new LogicaFake(0), jest.fn());

    expect(document.getElementById("contrasena").classList.contains("error")).toBe(true);
    expect(document.getElementById("correo").classList.contains("error")).toBe(false);
  });
});

describe("alternarVisibilidadContrasena()", () => {
  test("muestra y vuelve a ocultar la contraseña", () => {
    const campo = document.getElementById("contrasena");

    login.alternarVisibilidadContrasena();
    expect(campo.type).toBe("text");
    expect(document.getElementById("boton-ojo").getAttribute("aria-pressed")).toBe("true");

    login.alternarVisibilidadContrasena();
    expect(campo.type).toBe("password");
  });
});