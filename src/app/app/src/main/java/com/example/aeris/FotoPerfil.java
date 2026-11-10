// ---------------------------------------------------------------------------
// Fichero:     FotoPerfil.java
// Descripción: Prepara la foto de perfil: la recorta en cuadrado, la reduce a
//              256x256, la guarda como JPEG y la pasa a texto base64 para
//              enviarla al servidor (POST /cambiarFoto); y al revés, convierte
//              el base64 que llega del servidor en una imagen.
//              Diseño en doc/app_design.md. Tarea T010.
// Autores:     Equipo 04 – SenseTech
// Fecha:       04/11/2026
// Copyright:   (c) 2026 Equipo 04 - Proyecto Biometría y Medio Ambiente, EPSG-UPV
// ---------------------------------------------------------------------------
package com.example.aeris;

import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;

// FotoPerfil class: converts the profile photo between image and base64 text.
public class FotoPerfil {

    static final int LADO_PIXELES = 256;      // la foto se guarda de 256x256
    static final int CALIDAD_JPEG = 80;

    // -----------------------------------------------------------------------
    // resolver: ContentResolver, uri: Uri --> prepararFoto() --x
    // Text <--
    // What it does: reads the chosen image (turned the right way), cuts the
    //               centre square, makes it 256x256 and returns the JPEG in
    //               base64 (about 20-40 KB). Slow: call it outside the main thread.
    // -----------------------------------------------------------------------
    public static String prepararFoto(ContentResolver resolver, Uri uri) throws IOException {
        ImageDecoder.Source origen = ImageDecoder.createSource(resolver, uri);
        Bitmap original = ImageDecoder.decodeBitmap(origen, (decodificador, info, fuente) -> {
            decodificador.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            // Para no cargar fotos enormes en memoria: se lee ya reducida
            int ladoCorto = Math.min(info.getSize().getWidth(), info.getSize().getHeight());
            int reduccion = Math.max(1, ladoCorto / (LADO_PIXELES * 2));
            decodificador.setTargetSampleSize(reduccion);
        });

        int[] recorte = recorteCuadrado(original.getWidth(), original.getHeight());
        Bitmap cuadrada = Bitmap.createBitmap(original, recorte[0], recorte[1], recorte[2], recorte[2]);
        Bitmap pequena = Bitmap.createScaledBitmap(cuadrada, LADO_PIXELES, LADO_PIXELES, true);

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        pequena.compress(Bitmap.CompressFormat.JPEG, CALIDAD_JPEG, bytes);
        return Base64.getEncoder().encodeToString(bytes.toByteArray());
    }

    // -----------------------------------------------------------------------
    // base64: Text --> aImagen() --x
    // Bitmap | null <--
    // What it does: turns the photo that comes from the server into an image;
    //               null if there is no photo or it is not valid.
    // -----------------------------------------------------------------------
    public static Bitmap aImagen(String base64) {
        if (base64 == null || base64.isEmpty()) {
            return null;
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException noEsBase64) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // ancho: N, alto: N --> recorteCuadrado() --x
    // [x: N, y: N, lado: N] <--
    // What it does: returns the biggest square in the centre of the image.
    // -----------------------------------------------------------------------
    static int[] recorteCuadrado(int ancho, int alto) {
        int lado = Math.min(ancho, alto);
        return new int[]{(ancho - lado) / 2, (alto - lado) / 2, lado};
    }
}
