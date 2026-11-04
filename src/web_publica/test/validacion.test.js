// ------------------------------------------------------------
// Pruebas de las reglas de formato del correo y la contraseña
// ------------------------------------------------------------

const v = require("../js/validacion");

describe("esCorreoValido()", () => {
  test.each([
    "laura@correo.es",
    "j.beltran@upv.es",
    "nombre+aeris@alumnos.upv.es",
    "ADMIN@AERIS.ES",
    "  laura@correo.es  "
  ])("acepta %s", correo => {
    expect(v.esCorreoValido(correo)).toBe(true);
  });

  test.each([
    "",
    "lauracorreo.es",
    "laura@",
    "@correo.es",
    "laura@correo",
    "laura@correo.e",
    "laura@@correo.es",
    "laura correo@correo.es",
    ".laura@correo.es",
    "laura.@correo.es",
    "lau..ra@correo.es",
    "laura@correo..es",
    "a".repeat(250) + "@c.es"
  ])("rechaza «%s»", correo => {
    expect(v.esCorreoValido(correo)).toBe(false);
  });
});

describe("esContrasenaValida()", () => {
  test.each([
    "laura1234",
    "Aeris2026",
    "contraseña1",
    "a1b2c3d4",
    "x".repeat(63) + "1"
  ])("acepta %s", contrasena => {
    expect(v.esContrasenaValida(contrasena)).toBe(true);
  });

  test.each([
    ["con menos de 8 caracteres", "abc123"],
    ["sin números", "contrasena"],
    ["sin letras", "12345678"],
    ["con espacios", "mi clave 123"],
    ["con más de 64 caracteres", "x".repeat(64) + "1"]
  ])("rechaza una contraseña %s", (_, contrasena) => {
    expect(v.esContrasenaValida(contrasena)).toBe(false);
  });
});

describe("mensajes de error", () => {
  test("distingue el correo vacío del correo mal escrito", () => {
    expect(v.errorCorreo("")).toBe("Escribe tu correo electrónico");
    expect(v.errorCorreo("laura@")).toBe(v.MENSAJE_CORREO_INVALIDO);
    expect(v.errorCorreo("laura@correo.es")).toBe("");
  });

  test("distingue la contraseña vacía de la que no cumple el formato", () => {
    expect(v.errorContrasena("")).toBe("Escribe tu contraseña");
    expect(v.errorContrasena("corta1")).toBe(v.MENSAJE_CONTRASENA_INVALIDA);
    expect(v.errorContrasena("laura1234")).toBe("");
  });
});
