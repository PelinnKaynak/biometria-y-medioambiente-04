// ---------------------------------------------------------------------------
// Fichero:     VincularSensorTest.java
// Descripción: Tests de la vinculación por correo: lectura de la solicitud,
//              correo oculto, «hoy, 18:40», cuerpo enviado al servidor y
//              respuestas del servidor. Tarea T005.
// Autores:     Equipo 04 – SenseTech
// Fecha:       13/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.json.JSONObject;
import org.junit.Test;

import java.time.Instant;
import java.time.ZoneId;

public class VincularSensorTest {

    private static final ZoneId MADRID = ZoneId.of("Europe/Madrid");
    private static final long AHORA = Instant.parse("2026-11-13T13:00:00Z").toEpochMilli();
    private static final String JSON_PENDIENTE = "{\"numeroSerie\":\"092021010920\","
            + "\"correoComprador\":\"m•••••@gmail.com\",\"estado\":\"pendiente\","
            + "\"fecha\":\"2026-11-13T12:40:00Z\"}";

    // Apunta qué callback de RespuestaSolicitud se ha llamado
    private static class Apuntada implements LogicaFakeVincular.RespuestaSolicitud {
        String llamado;
        SolicitudVinculacion solicitud;
        String mensaje;

        @Override
        public void solicitudObtenida(SolicitudVinculacion s) {
            llamado = "obtenida";
            solicitud = s;
        }

        @Override
        public void sinSolicitud() {
            llamado = "sin";
        }

        @Override
        public void sesionCaducada() {
            llamado = "sesion";
        }

        @Override
        public void error(String m) {
            llamado = "error";
            mensaje = m;
        }
    }

    @Test
    public void solicitudPendiente_seLee() {
        SolicitudVinculacion s = SolicitudVinculacion.desdeJSON(JSON_PENDIENTE);
        assertNotNull(s);
        assertEquals("092021010920", s.numeroSerie);
        assertEquals("m•••••@gmail.com", s.correoComprador);
        assertEquals(SolicitudVinculacion.Estado.PENDIENTE, s.estado);
        assertEquals(Instant.parse("2026-11-13T12:40:00Z").toEpochMilli(), s.momento);
    }

    @Test
    public void estadosConfirmadaYRechazada_seLeen() {
        assertEquals(SolicitudVinculacion.Estado.CONFIRMADA,
                SolicitudVinculacion.desdeJSON(JSON_PENDIENTE.replace("pendiente", "confirmada")).estado);
        assertEquals(SolicitudVinculacion.Estado.RECHAZADA,
                SolicitudVinculacion.desdeJSON(JSON_PENDIENTE.replace("pendiente", "rechazada")).estado);
    }

    @Test
    public void solicitudMal_esNull() {
        assertNull(SolicitudVinculacion.desdeJSON(null));
        assertNull(SolicitudVinculacion.desdeJSON("no es json"));
        assertNull(SolicitudVinculacion.desdeJSON(JSON_PENDIENTE.replace("pendiente", "otra")));
        assertNull(SolicitudVinculacion.desdeJSON(JSON_PENDIENTE.replace("2026-11-13T12:40:00Z", "ayer")));
        assertNull(SolicitudVinculacion.desdeJSON("{\"estado\":\"pendiente\"}"));
    }

    @Test
    public void correo_seOculta() {
        assertEquals("m•••••@gmail.com", SolicitudVinculacion.ocultarCorreo("maria.lopez@gmail.com"));
        assertEquals("•••••", SolicitudVinculacion.ocultarCorreo("sinarroba"));
        assertEquals("•••••", SolicitudVinculacion.ocultarCorreo("@gmail.com"));
        assertEquals("•••••", SolicitudVinculacion.ocultarCorreo(null));
    }

    @Test
    public void cuando_hoyAyerYOtroDia() {
        // 12:40 UTC = 13:40 en Madrid (invierno)
        assertEquals("hoy, 13:40", SolicitudVinculacion.cuando(
                Instant.parse("2026-11-13T12:40:00Z").toEpochMilli(), AHORA, MADRID));
        assertEquals("ayer, 19:05", SolicitudVinculacion.cuando(
                Instant.parse("2026-11-12T18:05:00Z").toEpochMilli(), AHORA, MADRID));
        assertEquals("3 nov, 09:00", SolicitudVinculacion.cuando(
                Instant.parse("2026-11-03T08:00:00Z").toEpochMilli(), AHORA, MADRID));
    }

    @Test
    public void cuerpoSolicitud_llevaSerieYSensibilidad() throws Exception {
        CodigoSensor codigo = CodigoSensor.desdeTexto("092021010920 110406 03 2109 -44.75");
        JSONObject cuerpo = new JSONObject(LogicaFakeVincular.cuerpoSolicitud(codigo));
        assertEquals("092021010920", cuerpo.getString("numeroSerie"));
        assertEquals(-44.75, cuerpo.getDouble("sensibilidad"), 1e-9);
    }

    @Test
    public void respuestasDelServidor() {
        Apuntada a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(201, JSON_PENDIENTE, false, a);
        assertEquals("obtenida", a.llamado);

        a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(200, "{}", true, a);
        assertEquals("error", a.llamado);

        a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(401, "", true, a);
        assertEquals("sesion", a.llamado);

        a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(404, "", true, a);
        assertEquals("sin", a.llamado);

        a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(404, "", false, a);
        assertEquals(LogicaFakeVincular.MENSAJE_NO_REGISTRADO, a.mensaje);

        a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(409, "", false, a);
        assertEquals(LogicaFakeVincular.MENSAJE_YA_VINCULADO, a.mensaje);

        a = new Apuntada();
        LogicaFakeVincular.notificarSolicitud(0, "", false, a);
        assertEquals(LogicaFakePerfil.MENSAJE_SIN_CONEXION, a.mensaje);
    }

    @Test
    public void datosDeEjemplo_pendienteDespuesDePedir() {
        LogicaFakeVincular logica = new LogicaFakeVincular();
        LogicaFakeVincular.olvidarSolicitudDeEjemplo();
        Apuntada antes = new Apuntada();
        logica.consultarEstado("token", antes);
        assertEquals("sin", antes.llamado);

        Apuntada pedida = new Apuntada();
        logica.solicitarVinculacion("token",
                CodigoSensor.desdeTexto("092021010920 110406 03 2109 -44.75"), pedida);
        assertEquals("obtenida", pedida.llamado);
        assertEquals("p•••••@upv.edu.es", pedida.solicitud.correoComprador);

        Apuntada despues = new Apuntada();
        logica.consultarEstado("token", despues);
        assertEquals(LogicaFakeVincular.ESTADO_DE_EJEMPLO, despues.solicitud.estado);
        LogicaFakeVincular.olvidarSolicitudDeEjemplo();
    }
}
