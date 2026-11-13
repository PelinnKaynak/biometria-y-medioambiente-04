// ---------------------------------------------------------------------------
// Fichero:     BarraNavegacion.java
// Descripción: Barra de navegación inferior de las pantallas principales
//              (Inicio, Mapa, Mis datos, Info, Perfil), como el componente
//              «barra navegacion» de Figma. Pinta la pestaña activa en violeta
//              y abre la pantalla de cada pestaña. Diseño en doc/app_design.md.
//              Tarea T010 (Info: T009; Mapa y Mis datos provisionales: T006).
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Build;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;
import androidx.core.widget.ImageViewCompat;

// BarraNavegacion class: connects the bottom bar (layout barra_navegacion.xml,
// added with <include>) of a main screen.
public class BarraNavegacion {

    // Pestañas de la barra, en el orden de Figma
    public enum Pestanya { INICIO, MAPA, MIS_DATOS, INFO, PERFIL }

    // -----------------------------------------------------------------------
    // actividad: Activity, activa: Pestanya --> conectar() -->
    // What it does: paints the active tab in violet (the others in grey) and
    //               makes each tab open its screen. activa can be null (no
    //               tab marked: a screen opened from a shortcut).
    // -----------------------------------------------------------------------
    public static void conectar(Activity actividad, Pestanya activa) {
        conectarPestanya(actividad, activa, Pestanya.INICIO,
                R.id.pestanyaInicio, R.id.iconoInicio, R.id.textoInicio);
        conectarPestanya(actividad, activa, Pestanya.MAPA,
                R.id.pestanyaMapa, R.id.iconoMapa, R.id.textoMapa);
        conectarPestanya(actividad, activa, Pestanya.MIS_DATOS,
                R.id.pestanyaMisDatos, R.id.iconoMisDatos, R.id.textoMisDatos);
        conectarPestanya(actividad, activa, Pestanya.INFO,
                R.id.pestanyaInfo, R.id.iconoInfo, R.id.textoInfo);
        conectarPestanya(actividad, activa, Pestanya.PERFIL,
                R.id.pestanyaPerfil, R.id.iconoPerfil, R.id.textoPerfil);
    }

    // -----------------------------------------------------------------------
    // actual: Pestanya, destino: Pestanya --> cierraLaActual() --x
    // B <--
    // What it does: true if the current screen must be closed when the user
    //               goes to destino. Inicio always stays at the bottom, so
    //               «atrás» from any tab goes back to Inicio, and «atrás» from
    //               Inicio leaves the app.
    // -----------------------------------------------------------------------
    static boolean cierraLaActual(Pestanya actual, Pestanya destino) {
        return actual != destino && actual != Pestanya.INICIO;
    }

    // -----------------------------------------------------------------------
    // pestanya: Pestanya --> pantallaDe() --x
    // Class | null <--
    // What it does: returns the screen of the tab. Mapa and Mis datos are
    //               done in other tasks: until then they open the temporary
    //               screen ProximamenteActivity (T006).
    // -----------------------------------------------------------------------
    static Class<? extends Activity> pantallaDe(Pestanya pestanya) {
        switch (pestanya) {
            case INICIO:
                return InicioActivity.class;
            case INFO:
                return InformacionActivity.class;
            case PERFIL:
                return PerfilActivity.class;
            default:
                return ProximamenteActivity.class;
        }
    }

    // -----------------------------------------------------------------------
    // actividad: Activity, activa: Pestanya, pestanya: Pestanya,
    // idPestanya: Z, idIcono: Z, idTexto: Z --> conectarPestanya() --x      (privado)
    // What it does: paints one tab and connects its click.
    // -----------------------------------------------------------------------
    private static void conectarPestanya(Activity actividad, Pestanya activa, Pestanya pestanya,
                                         int idPestanya, int idIcono, int idTexto) {
        boolean esActiva = pestanya == activa;
        int color = ContextCompat.getColor(actividad, esActiva ? R.color.violeta : R.color.texto_secundario);

        ImageView icono = actividad.findViewById(idIcono);
        ImageViewCompat.setImageTintList(icono, ColorStateList.valueOf(color));
        TextView texto = actividad.findViewById(idTexto);
        texto.setTextColor(color);
        texto.setTypeface(Tipografia.inter(actividad, esActiva ? Tipografia.SEMINEGRITA : Tipografia.NORMAL));

        actividad.findViewById(idPestanya).setSelected(esActiva);
        actividad.findViewById(idPestanya).setOnClickListener(vista -> abrir(actividad, activa, pestanya));
    }

    // -----------------------------------------------------------------------
    // actividad: Activity, actual: Pestanya, destino: Pestanya --> abrir() --x   (privado)
    // What it does: opens the screen of destino without animation (like
    //               switching tabs). Inicio is reused (CLEAR_TOP) instead of
    //               opening it twice.
    // -----------------------------------------------------------------------
    private static void abrir(Activity actividad, Pestanya actual, Pestanya destino) {
        if (destino == actual) {
            return;
        }
        Class<? extends Activity> pantalla = pantallaDe(destino);
        Intent intent = new Intent(actividad, pantalla);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        ProximamenteActivity.Seccion seccion = ProximamenteActivity.seccionDe(destino);
        if (pantalla == ProximamenteActivity.class && seccion != null) {
            intent.putExtra(ProximamenteActivity.EXTRA_SECCION, seccion.name());
            intent.putExtra(ProximamenteActivity.EXTRA_PESTANYA, destino.name());
        }
        if (destino == Pestanya.INICIO) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        }
        actividad.startActivity(intent);
        if (cierraLaActual(actual, destino)) {
            cerrarSinAnimacion(actividad);
        }
    }

    // -----------------------------------------------------------------------
    // actividad: Activity --> cerrarSinAnimacion() --x                       (privado)
    // What it does: closes the screen without the slide animation
    //               (Android 14+ uses overrideActivityTransition()).
    // -----------------------------------------------------------------------
    @SuppressWarnings("deprecation")
    private static void cerrarSinAnimacion(Activity actividad) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            actividad.overrideActivityTransition(Activity.OVERRIDE_TRANSITION_CLOSE, 0, 0);
            actividad.finish();
        } else {
            actividad.finish();
            actividad.overridePendingTransition(0, 0);
        }
    }
}
