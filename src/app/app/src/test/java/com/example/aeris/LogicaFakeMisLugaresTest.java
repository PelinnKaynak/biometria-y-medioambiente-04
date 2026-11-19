// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeMisLugaresTest.java
// Descripción: Pruebas unitarias (JUnit 4) para la lógica de la pantalla
//              «Mis lugares» (T019, H034). Comprueba que se añaden lugares con
//              nombre y dirección, que no se superan los 5 lugares y se avisa
//              del límite, que cada lugar muestra su nivel de ozono interpolado,
//              que el interruptor activa/desactiva los avisos y que cada usuario
//              solo ve sus propios lugares.
// Autores:     Equipo 04 – SenseTech
// Fecha:       18/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

// LogicaFakeMisLugaresTest class: unit tests for Mis Lugares screen logic.
public class LogicaFakeMisLugaresTest {

    private LogicaFakeMisLugares logica;
    private final String TOKEN_USUARIO_1 = "token_valido_usuario_1";
    private final String TOKEN_USUARIO_2 = "token_valido_usuario_2";

    @Before
    public void setUp() {
        LogicaFakeMisLugares.reiniciarParaPruebas();
        logica = new LogicaFakeMisLugares(true);
    }

    // -----------------------------------------------------------------------
    // Criterio 1: Si el usuario añade un lugar con nombre y dirección, el
    // lugar debe guardarse en su cuenta.
    // -----------------------------------------------------------------------
    @Test
    public void testAnadirLugarConNombreYDireccionSeGuardaEnCuenta() {
        AtomicReference<Lugar> lugarCreado = new AtomicReference<>();
        AtomicBoolean exito = new AtomicBoolean(false);

        logica.anadirLugar(TOKEN_USUARIO_1, "Colegio", "Calle Benicanena 5, Gandia",
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {
                        exito.set(true);
                        lugarCreado.set(lugar);
                    }

                    @Override
                    public void limiteAlcanzado(String mensaje) {}

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {}
                });

        assertTrue("Debe completarse con éxito la inserción del lugar", exito.get());
        assertNotNull("El lugar retornado no debe ser nulo", lugarCreado.get());
        assertEquals("Colegio", lugarCreado.get().nombre);
        assertEquals("Calle Benicanena 5, Gandia", lugarCreado.get().direccion);
        assertTrue("El ID generado debe ser positivo", lugarCreado.get().id > 0);
        assertTrue("Los avisos deben estar activos por defecto", lugarCreado.get().avisosActivos);
        assertTrue("Debe tener un valor de ozono interpolado asignado", lugarCreado.get().ozonoActual > 0);

        // Comprobar que en la lista del usuario aparece guardado
        AtomicReference<List<Lugar>> listaLugares = new AtomicReference<>();
        logica.obtenerLugares(TOKEN_USUARIO_1, new LogicaFakeMisLugares.CallbackLugares() {
            @Override
            public void lugaresObtenidos(List<Lugar> lugares) {
                listaLugares.set(lugares);
            }

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        });

        assertNotNull(listaLugares.get());
        assertTrue("La lista debe contener el nuevo lugar guardado",
                listaLugares.get().contains(lugarCreado.get()));
    }

    // -----------------------------------------------------------------------
    // Criterio 2: Si el usuario ya tiene 5 lugares, la app no debe permitir
    // añadir más e indicar el límite.
    // -----------------------------------------------------------------------
    @Test
    public void testNoPermitirAnadirMasDeCincoLugaresEIndicarLimite() {
        // Inicialmente el usuario tiene 2 lugares ("Casa" y "Trabajo").
        // Añadimos 3 lugares más para llegar al límite de 5.
        logica.anadirLugar(TOKEN_USUARIO_1, "Lugar 3", "Dirección 3", callbackVacio());
        logica.anadirLugar(TOKEN_USUARIO_1, "Lugar 4", "Dirección 4", callbackVacio());
        logica.anadirLugar(TOKEN_USUARIO_1, "Lugar 5", "Dirección 5", callbackVacio());

        // Intentar añadir el 6º lugar
        AtomicBoolean limiteReportado = new AtomicBoolean(false);
        AtomicReference<String> mensajeLimite = new AtomicReference<>();

        logica.anadirLugar(TOKEN_USUARIO_1, "Lugar 6 (Exceso)", "Dirección 6",
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {}

                    @Override
                    public void limiteAlcanzado(String mensaje) {
                        limiteReportado.set(true);
                        mensajeLimite.set(mensaje);
                    }

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {}
                });

        assertTrue("Debe avisar de que se ha alcanzado el límite", limiteReportado.get());
        assertNotNull(mensajeLimite.get());
        assertTrue("El mensaje debe mencionar el límite de 5 lugares",
                mensajeLimite.get().contains("5"));

        // Comprobar que el tamaño de la lista sigue siendo exactamente 5
        logica.obtenerLugares(TOKEN_USUARIO_1, new LogicaFakeMisLugares.CallbackLugares() {
            @Override
            public void lugaresObtenidos(List<Lugar> lugares) {
                assertEquals(LogicaFakeMisLugares.MAX_LUGARES, lugares.size());
            }

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        });
    }

    // -----------------------------------------------------------------------
    // Validación de campos obligatorios (nombre y dirección)
    // -----------------------------------------------------------------------
    @Test
    public void testValidarCamposNombreYDireccionNoVacios() {
        AtomicBoolean errorNombre = new AtomicBoolean(false);
        logica.anadirLugar(TOKEN_USUARIO_1, "   ", "Dirección válida",
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {}

                    @Override
                    public void limiteAlcanzado(String mensaje) {}

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {
                        errorNombre.set(true);
                        assertEquals(LogicaFakeMisLugares.ERROR_NOMBRE_VACIO, mensaje);
                    }
                });
        assertTrue("Debe rechazar nombre vacío", errorNombre.get());

        AtomicBoolean errorDireccion = new AtomicBoolean(false);
        logica.anadirLugar(TOKEN_USUARIO_1, "Nombre válido", "",
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {}

                    @Override
                    public void limiteAlcanzado(String mensaje) {}

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {
                        errorDireccion.set(true);
                        assertEquals(LogicaFakeMisLugares.ERROR_DIRECCION_VACIA, mensaje);
                    }
                });
        assertTrue("Debe rechazar dirección vacía", errorDireccion.get());
    }

    // -----------------------------------------------------------------------
    // Criterio 3: Cada lugar debe mostrar su nivel de ozono actual, obtenido
    // del mapa interpolado.
    // -----------------------------------------------------------------------
    @Test
    public void testCadaLugarMuestraNivelDeOzonoActualDelMapaInterpolado() {
        Lugar lugarBueno = new Lugar(1, "Playa de Gandia", "Passeig Marítim", 65.0, true);
        assertEquals(NivelOzono.BUENO, lugarBueno.nivelOzono());
        assertEquals("65 µg/m³", lugarBueno.textoOzono());

        Lugar lugarModerado = new Lugar(2, "Trabajo", "Av. de la Pau", 150.0, true);
        assertEquals(NivelOzono.MODERADO, lugarModerado.nivelOzono());
        assertEquals("150 µg/m³", lugarModerado.textoOzono());

        Lugar lugarMalo = new Lugar(3, "Polígono Industrial", "Carrer Vell", 210.0, false);
        assertEquals(NivelOzono.MALO, lugarMalo.nivelOzono());

        Lugar lugarMuyMalo = new Lugar(4, "Punto Crítico", "Autovía", 260.0, true);
        assertEquals(NivelOzono.MUY_MALO, lugarMuyMalo.nivelOzono());
    }

    @Test
    public void testLugarDesdeApiConservaTipoYOzonoNulo() throws Exception {
        Lugar lugar = Lugar.desdeJSON(new JSONObject(
                "{\"idLugar\":7,\"nombre\":\"Casa\",\"tipo\":\"casa\",\"zona\":\"Gandia\",\"ozono\":null}"));

        assertNotNull(lugar);
        assertEquals(7, lugar.id);
        assertEquals("casa", lugar.tipo);
        assertEquals("Gandia", lugar.direccion);
        assertEquals(null, lugar.ozonoActual);
        assertEquals(null, lugar.nivelOzono());
        assertEquals("Sin datos recientes", lugar.textoOzono());
    }

    // -----------------------------------------------------------------------
    // Criterio 4: Si el usuario cambia el interruptor de un lugar, los avisos
    // de ese lugar deben activarse o desactivarse.
    // -----------------------------------------------------------------------
    @Test
    public void testCambiarInterruptorAvisosActivaODesactiva() {
        AtomicReference<List<Lugar>> lugaresIniciales = new AtomicReference<>();
        logica.obtenerLugares(TOKEN_USUARIO_1, new LogicaFakeMisLugares.CallbackLugares() {
            @Override
            public void lugaresObtenidos(List<Lugar> lugares) {
                lugaresIniciales.set(lugares);
            }

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        });

        int idPrimerLugar = lugaresIniciales.get().get(0).id;
        assertTrue("Inicialmente debe tener avisos activos", lugaresIniciales.get().get(0).avisosActivos);

        // Desactivar avisos
        AtomicBoolean cambioExitoso = new AtomicBoolean(false);
        logica.cambiarAvisos(TOKEN_USUARIO_1, idPrimerLugar, false,
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {
                        cambioExitoso.set(true);
                        assertFalse("El lugar devuelto debe tener avisos desactivados", lugar.avisosActivos);
                    }

                    @Override
                    public void limiteAlcanzado(String mensaje) {}

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {}
                });

        assertTrue("El cambio a false debe realizarse", cambioExitoso.get());

        // Reactivar avisos
        cambioExitoso.set(false);
        logica.cambiarAvisos(TOKEN_USUARIO_1, idPrimerLugar, true,
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {
                        cambioExitoso.set(true);
                        assertTrue("El lugar devuelto debe tener avisos reactivados", lugar.avisosActivos);
                    }

                    @Override
                    public void limiteAlcanzado(String mensaje) {}

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {}
                });

        assertTrue("El cambio a true debe realizarse", cambioExitoso.get());
    }

    // -----------------------------------------------------------------------
    // Criterio 5: Los lugares guardados solo debe verlos su usuario.
    // -----------------------------------------------------------------------
    @Test
    public void testLugaresGuardadosSoloVisiblesPorSuUsuario() {
        // Usuario 1 añade un lugar exclusivo
        logica.anadirLugar(TOKEN_USUARIO_1, "Gimnasio Usuario 1", "Calle A", callbackVacio());

        // Consultar lugares de Usuario 2
        AtomicReference<List<Lugar>> lugaresUsuario2 = new AtomicReference<>();
        logica.obtenerLugares(TOKEN_USUARIO_2, new LogicaFakeMisLugares.CallbackLugares() {
            @Override
            public void lugaresObtenidos(List<Lugar> lugares) {
                lugaresUsuario2.set(lugares);
            }

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        });

        // Verificar que el Usuario 2 NO ve el lugar creado por el Usuario 1
        boolean encontradoEnUsuario2 = false;
        for (Lugar l : lugaresUsuario2.get()) {
            if ("Gimnasio Usuario 1".equals(l.nombre)) {
                encontradoEnUsuario2 = true;
                break;
            }
        }
        assertFalse("El usuario 2 no debe ver los lugares del usuario 1", encontradoEnUsuario2);
    }

    // -----------------------------------------------------------------------
    // Control de sesión: token nulo, vacío o caducado
    // -----------------------------------------------------------------------
    @Test
    public void testSesionInvalidaOCaducadaDevuelveSesionCaducada() {
        AtomicBoolean sesionCaducada = new AtomicBoolean(false);
        logica.obtenerLugares(null, new LogicaFakeMisLugares.CallbackLugares() {
            @Override
            public void lugaresObtenidos(List<Lugar> lugares) {}

            @Override
            public void sesionCaducada() {
                sesionCaducada.set(true);
            }

            @Override
            public void error(String mensaje) {}
        });
        assertTrue("Token nulo debe reportar sesión caducada", sesionCaducada.get());

        sesionCaducada.set(false);
        logica.anadirLugar("", "Nombre", "Dir", new LogicaFakeMisLugares.CallbackOperacionLugar() {
            @Override
            public void exito(Lugar lugar) {}

            @Override
            public void limiteAlcanzado(String mensaje) {}

            @Override
            public void sesionCaducada() {
                sesionCaducada.set(true);
            }

            @Override
            public void error(String mensaje) {}
        });
        assertTrue("Token vacío debe reportar sesión caducada", sesionCaducada.get());
    }

    // -----------------------------------------------------------------------
    // Eliminar un lugar permite volver a añadir lugares
    // -----------------------------------------------------------------------
    @Test
    public void testEliminarLugarPermiteAnadirNuevosLugares() {
        // Llenar hasta 5 lugares
        logica.anadirLugar(TOKEN_USUARIO_1, "L3", "D3", callbackVacio());
        logica.anadirLugar(TOKEN_USUARIO_1, "L4", "D4", callbackVacio());
        AtomicReference<Lugar> quintoLugar = new AtomicReference<>();
        logica.anadirLugar(TOKEN_USUARIO_1, "L5", "D5", new LogicaFakeMisLugares.CallbackOperacionLugar() {
            @Override
            public void exito(Lugar lugar) {
                quintoLugar.set(lugar);
            }

            @Override
            public void limiteAlcanzado(String mensaje) {}

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        });

        assertNotNull(quintoLugar.get());

        // Eliminar el quinto lugar
        AtomicBoolean eliminado = new AtomicBoolean(false);
        logica.eliminarLugar(TOKEN_USUARIO_1, quintoLugar.get().id, new LogicaFakeMisLugares.CallbackEliminarLugar() {
            @Override
            public void eliminado(int idLugar) {
                eliminado.set(true);
            }

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        });
        assertTrue("El lugar debe eliminarse con éxito", eliminado.get());

        // Ahora debe permitir añadir otro lugar sin dar error de límite
        AtomicBoolean anadidoTrasEliminar = new AtomicBoolean(false);
        logica.anadirLugar(TOKEN_USUARIO_1, "Lugar Nuevo Tras Eliminar", "Nueva Dir",
                new LogicaFakeMisLugares.CallbackOperacionLugar() {
                    @Override
                    public void exito(Lugar lugar) {
                        anadidoTrasEliminar.set(true);
                    }

                    @Override
                    public void limiteAlcanzado(String mensaje) {}

                    @Override
                    public void sesionCaducada() {}

                    @Override
                    public void error(String mensaje) {}
                });

        assertTrue("Debe permitir añadir nuevo lugar tras haber eliminado uno", anadidoTrasEliminar.get());
    }

    private LogicaFakeMisLugares.CallbackOperacionLugar callbackVacio() {
        return new LogicaFakeMisLugares.CallbackOperacionLugar() {
            @Override
            public void exito(Lugar lugar) {}

            @Override
            public void limiteAlcanzado(String mensaje) {}

            @Override
            public void sesionCaducada() {}

            @Override
            public void error(String mensaje) {}
        };
    }
}
