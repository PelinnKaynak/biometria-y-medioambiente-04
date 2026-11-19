// ---------------------------------------------------------------------------
// Fichero:     LogicaFakeAvisos.java
// Descripción: Lógica fake del teléfono para el panel de notificaciones de
//              Inicio. Pide los avisos de contaminación del usuario al
//              servidor REST (GET /avisos?desdeId=) con el token de la
//              sesión, pasando de página con desdeId, y se queda con los más
//              recientes. Lo leído lo guarda AvisosLeidos en el teléfono.
//              Diseño en doc/app_design.md. Tarea T008.
// Autores:     Equipo 04 – SenseTech
// Fecha:       19/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// LogicaFakeAvisos class: the phone's fake logic for the notifications panel.
public class LogicaFakeAvisos {

    static final int CODIGO_OK = 200;
    static final int CODIGO_SIN_SESION = 401;
    static final int CODIGO_SIN_CONEXION = 0;

    // Cuántos avisos devuelve el servidor como máximo en cada llamada (los más antiguos primero)
    static final int TAMANO_PAGINA = 100;
    // Tope de llamadas seguidas (evita bucles si el servidor responde algo raro)
    static final int MAX_PAGINAS = 50;
    // Cuántos avisos se enseñan en el panel: los más recientes
    static final int MAX_AVISOS = 20;

    // -----------------------------------------------------------------------
    // Callback de obtenerAvisos() (se omite en la notación)
    // -----------------------------------------------------------------------
    public interface RespuestaAvisos {
        // avisos: [Aviso] --> avisosObtenidos() -->
        // (como mucho MAX_AVISOS, del más nuevo al más antiguo; puede estar vacía)
        void avisosObtenidos(List<Aviso> avisos);
        // sesionCaducada() -->                            (401)
        void sesionCaducada();
        // mensaje: Text --> error() -->
        void error(String mensaje);
    }

    // Quien hace la llamada al servidor: GET /avisos?desdeId=N (se cambia en los tests)
    interface Servidor {
        void pedir(long desdeId, PeticionarioREST.RespuestaREST respuesta);
    }

    // Una página de la respuesta: sus avisos válidos, cuántas filas traía y el mayor idAviso
    static final class Pagina {
        final List<Aviso> avisos;
        final int filas;
        final long ultimoId;

        Pagina(List<Aviso> avisos, int filas, long ultimoId) {
            this.avisos = avisos;
            this.filas = filas;
            this.ultimoId = ultimoId;
        }
    }

    // -----------------------------------------------------------------------
    // token: Text, respuesta: RespuestaAvisos --> obtenerAvisos() -->
    // What it does: sends GET /avisos?desdeId=0 with the session token and,
    //               while the server fills the page, asks the next one from
    //               the last idAviso it gave. Calls avisosObtenidos() with
    //               the newest ones, sesionCaducada() or error().
    // -----------------------------------------------------------------------
    public void obtenerAvisos(String token, RespuestaAvisos respuesta) {
        obtenerAvisos((desdeId, callback) -> new PeticionarioREST().hacerPeticionREST("GET",
                LogicaFakeRegistro.URL_SERVIDOR + "/avisos?desdeId=" + desdeId, null, token, callback),
                respuesta);
    }

    // -----------------------------------------------------------------------
    // servidor: Servidor, respuesta: RespuestaAvisos --> obtenerAvisos() -->
    // -----------------------------------------------------------------------
    static void obtenerAvisos(Servidor servidor, RespuestaAvisos respuesta) {
        pedirPagina(servidor, 0, 0, new ArrayList<>(), respuesta);
    }

    private static void pedirPagina(Servidor servidor, long desdeId, int pedidas,
                                    List<Aviso> acumulados, RespuestaAvisos respuesta) {
        servidor.pedir(desdeId, (codigo, cuerpo) -> {
            Pagina pagina = notificarAvisos(codigo, cuerpo, respuesta);
            if (pagina == null) {
                return;
            }
            List<Aviso> juntos = new ArrayList<>(acumulados);
            juntos.addAll(pagina.avisos);
            List<Aviso> recientes = masRecientes(juntos, MAX_AVISOS);
            if (hayOtraPagina(pagina, desdeId, pedidas + 1)) {
                pedirPagina(servidor, pagina.ultimoId, pedidas + 1, recientes, respuesta);
            } else {
                respuesta.avisosObtenidos(recientes);
            }
        });
    }

    // -----------------------------------------------------------------------
    // pagina: Pagina, desdeId: Z, pedidas: N --> hayOtraPagina() --x
    // B <--
    // What it does: true if the page was full, its last idAviso is bigger than
    //               the cursor that was sent (it moves forward) and the limit
    //               of pages has not been reached. If the cursor does not move
    //               it stops, so a strange answer never makes a loop.
    // -----------------------------------------------------------------------
    static boolean hayOtraPagina(Pagina pagina, long desdeId, int pedidas) {
        return pagina.filas >= TAMANO_PAGINA && pagina.ultimoId > desdeId && pedidas < MAX_PAGINAS;
    }

    // -----------------------------------------------------------------------
    // codigo: Z, cuerpo: Text, respuesta: RespuestaAvisos --> notificarAvisos() --x
    // Pagina | null <--
    // What it does: 200 with a JSON list -> the page; 401 -> sesionCaducada();
    //               anything else (or a body that is not a list) -> error().
    //               In those cases it returns null.
    // -----------------------------------------------------------------------
    static Pagina notificarAvisos(int codigo, String cuerpo, RespuestaAvisos respuesta) {
        if (codigo == CODIGO_OK) {
            Pagina pagina = leerPagina(cuerpo);
            if (pagina == null) {
                respuesta.error("Respuesta del servidor no válida.");
            }
            return pagina;
        }
        if (codigo == CODIGO_SIN_SESION) {
            respuesta.sesionCaducada();
        } else if (codigo == CODIGO_SIN_CONEXION) {
            respuesta.error(LogicaFakePerfil.MENSAJE_SIN_CONEXION);
        } else {
            respuesta.error("No se han podido cargar las notificaciones (error " + codigo + ").");
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // cuerpo: Text --> leerPagina() --x
    // Pagina | null <--
    // What it does: reads a page. The last idAviso is taken from all the rows
    //               (also the ones skipped for lacking data), so the cursor
    //               always moves forward. Null if it is not a JSON array.
    // -----------------------------------------------------------------------
    static Pagina leerPagina(String cuerpo) {
        if (cuerpo == null || cuerpo.isEmpty()) {
            return null;
        }
        try {
            JSONArray array = new JSONArray(cuerpo);
            List<Aviso> avisos = new ArrayList<>();
            long ultimoId = 0;
            for (int i = 0; i < array.length(); i++) {
                JSONObject json = array.optJSONObject(i);
                if (json == null) {
                    continue;
                }
                ultimoId = Math.max(ultimoId, Aviso.idDe(json));
                Aviso aviso = Aviso.desdeJSON(json);
                if (aviso != null) {
                    avisos.add(aviso);
                }
            }
            return new Pagina(avisos, array.length(), ultimoId);
        } catch (JSONException error) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // avisos: [Aviso], maximo: N --> masRecientes() --x
    // [Aviso] <--
    // What it does: the newest «maximo» avisos, from the newest to the oldest,
    //               without repeating a key.
    // -----------------------------------------------------------------------
    static List<Aviso> masRecientes(List<Aviso> avisos, int maximo) {
        List<Aviso> orden = new ArrayList<>(avisos);
        // Las páginas llegan de menor a mayor idAviso: al darles la vuelta, a
        // igual momento va primero el de id mayor (el sort es estable)
        Collections.reverse(orden);
        Set<String> vistas = new HashSet<>();
        List<Aviso> unicos = new ArrayList<>();
        for (Aviso aviso : orden) {
            if (vistas.add(aviso.clave)) {
                unicos.add(aviso);
            }
        }
        Collections.sort(unicos, (a, b) -> Long.compare(b.momento, a.momento));
        return unicos.size() > maximo ? new ArrayList<>(unicos.subList(0, maximo)) : unicos;
    }

    // -----------------------------------------------------------------------
    // delServidor: [Aviso], locales: [Aviso] --> combinar() --x
    // [Aviso] <--
    // What it does: the list of the panel: the avisos of the server and the
    //               local ones that are not pollution ones («Sensor
    //               desconectado»; the pollution ones come from the server, so
    //               they are not repeated), from the newest to the oldest.
    // -----------------------------------------------------------------------
    static List<Aviso> combinar(List<Aviso> delServidor, List<Aviso> locales) {
        List<Aviso> lista = new ArrayList<>(delServidor);
        for (Aviso aviso : locales) {
            if (aviso.tipo != Aviso.Tipo.CONTAMINACION) {
                lista.add(aviso);
            }
        }
        Collections.sort(lista, (a, b) -> Long.compare(b.momento, a.momento));
        return lista;
    }
}
