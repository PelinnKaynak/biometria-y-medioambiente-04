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
    "   ",
    "lauracorreo.es",
    "laura@",
    "@correo.es",
    "laura@correo",
    "laura@correo.e",
    "laura@@correo.es",
    "laura correo@correo.es",
    "laura@correo.es1",
    "a".repeat(251) + "@c.es"
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
    "mi clave 123",
    "x".repeat(99) + "1"
  ])("acepta %s", contrasena => {
    expect(v.esContrasenaValida(contrasena)).toBe(true);
  });

  test.each([
    ["con menos de 8 caracteres", "abc123"],
    ["sin números", "contrasena"],
    ["sin letras", "12345678"],
    ["vacía", ""]
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

describe("esNombreValido() y mensajes de nombre", () => {
  test.each(["Laura", "José Luis", "García-Ortega", "D'Alessandro", "Núria"])("acepta %s", nombre => {
    expect(v.esNombreValido(nombre, 50)).toBe(true);
  });

  test.each(["", "   ", "Laura2", "laura_m", "laura@", "Laura  Martínez", "-Laura"])("rechaza «%s»", nombre => {
    expect(v.esNombreValido(nombre, 50)).toBe(false);
  });

  test("respeta la longitud máxima", () => {
    expect(v.esNombreValido("a".repeat(51), 50)).toBe(false);
  });

  test("distingue el campo vacío del que tiene caracteres no permitidos", () => {
    expect(v.errorNombre("")).toBe("Escribe tu nombre");
    expect(v.errorNombre("Ana1")).toBe("El nombre solo puede tener letras");
    expect(v.errorApellidos("")).toBe("Escribe tus apellidos");
    expect(v.errorApellidos("Pons")).toBe("");
  });
});