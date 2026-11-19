package com.example.aeris;

public final class LuzSensorSimulada {

    private boolean encendida;

    public LuzSensorSimulada(boolean encendida) {
        this.encendida = encendida;
    }

    public boolean estaEncendida() {
        return encendida;
    }

    public void establecer(boolean encendida) {
        this.encendida = encendida;
    }

    public void desvincular() {
        encendida = false;
    }
}
