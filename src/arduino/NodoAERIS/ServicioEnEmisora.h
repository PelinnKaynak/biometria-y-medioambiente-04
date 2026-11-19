// -*- mode: c++ -*-

// ---------------------------------------------------------------------------
// Fichero:     ServicioEnEmisora.h
// Descripción: Servicio BLE con sus características (clase interna Caracteristica).
//              Diseño en doc/arduino_design.md.
// Autor:       Jordi Bataller i Mascarell (código original proporcionado)
// Aportación:  Pelin Kaynak - cabeceras de fichero y de función con el
//              diseño lógico (29/09/2026)
//              Equipo 04 (AERIS, T004): sin cambios, se usa tal cual
// Copyright:   (c) Jordi Bataller i Mascarell - EPSG-UPV
// ---------------------------------------------------------------------------

// ----------------------------------------------------------
// Jordi Bataller i Mascarell
// 2019-07-17
// ----------------------------------------------------------
#ifndef SERVICIO_EMISORA_H_INCLUIDO
#define SERVICIO_EMISORA_H_INCLUIDO

// ----------------------------------------------------
// ----------------------------------------------------
#include <vector>


   // ----------------------------------------------------
   // Compatibilidad (Pelin Kaynak, 29/09/2026): en el núcleo
   // Adafruit nRF52 >= 1.0 el tipo BleSecurityMode se llama
   // SecureMode_t. Este alias permite compilar el código
   // original sin cambiarlo.
   // ----------------------------------------------------
   using BleSecurityMode = SecureMode_t;

// ----------------------------------------------------
// alReves() utilidad
// pone al revés el contenido de una array en el mismo array
// ------------------------------------------------------------
// p: [N], n: N --> alReves() --> [N]        (plantilla: sirve para cualquier tipo)
// What it does: reverses an array in place ([1,2,3] -> [3,2,1]). Not used in Sprint 0.
// ------------------------------------------------------------
template< typename T >
T *  alReves( T * p, int n ) {
  T aux;

  for( int i=0; i < n/2; i++ ) {
	aux = p[i];
	p[i] = p[n-i-1];
	p[n-i-1] = aux;
  }
  return p;
} // ()

// ------------------------------------------------------------
// pString: Text, pUint: [N], tamMax: N --> stringAUint8AlReves() --> [N]
// What it does: copies a text into a byte array in reverse order (to build a BLE UUID).
// ------------------------------------------------------------
uint8_t * stringAUint8AlReves( const char * pString, uint8_t * pUint, int tamMax ) {

	int longitudString =  strlen( pString );
	int longitudCopiar = ( longitudString > tamMax ? tamMax : longitudString );
	// copio nombreServicio -> uuidServicio pero al revés
	for( int i=0; i<=longitudCopiar-1; i++ ) {
	  pUint[ tamMax-i-1 ] = pString[ i ];
	} // for

	return pUint;
} // ()

// ----------------------------------------------------------
// ----------------------------------------------------------
// ServicioEnEmisora class: a BLE service = a 'folder' of values a connected phone can read. Not used in Sprint 0.
class ServicioEnEmisora {

public:


  // --------------------------------------------------------
  // --------------------------------------------------------

  // .........................................................
  // .........................................................
  using CallbackCaracteristicaEscrita = void ( uint16_t conn_handle,
											   BLECharacteristic * chr,
											   uint8_t * data, uint16_t len); 
  // .........................................................
  // .........................................................
  // Caracteristica class: one value inside a service (a 'file' inside the folder).
  class Caracteristica {
  private:
	uint8_t uuidCaracteristica[16] = { // el uuid se copia aquí (al revés) a partir de un string-c
	  // least signficant byte, el primero
	  '0', '1', '2', '3', 
	  '4', '5', '6', '7', 
	  '8', '9', 'A', 'B', 
	  'C', 'D', 'E', 'F'
	};

	// 
	// 
	// 
	BLECharacteristic laCaracteristica;

  public:

	// ------------------------------------------------------------
	// nombreCaracteristica: Text --> Caracteristica() -->
	// What it does: creates a characteristic whose UUID is made from its name.
	// ------------------------------------------------------------
	Caracteristica( const char * nombreCaracteristica_ )
	  :
	  laCaracteristica( stringAUint8AlReves( nombreCaracteristica_, &uuidCaracteristica[0], 16 ) )
	{
	  
	} // ()

	// ------------------------------------------------------------
	// nombreCaracteristica: Text, props: N, permisoRead: BleSecurityMode,
	// permisoWrite: BleSecurityMode, tam: N --> Caracteristica() -->
	// What it does: creates a characteristic and also sets its properties, permissions and size.
	// ------------------------------------------------------------
	Caracteristica( const char * nombreCaracteristica_ ,
					uint8_t props,
					BleSecurityMode permisoRead,
					BleSecurityMode permisoWrite, 
					uint8_t tam ) 
	  :
	  Caracteristica( nombreCaracteristica_ ) // llamada al otro constructor
	{
	  (*this).asignarPropiedadesPermisosYTamanyoDatos( props, permisoRead, permisoWrite, tam );
	} // ()

  private:
	// .........................................................
	// CHR_PROPS_WRITE , CHR_PROPS_READ ,  CHR_PROPS_NOTIFY 
	// ------------------------------------------------------------
	// props: N --> asignarPropiedades() -->
	// What it does: sets what the phone can do with this value (read, write, notify).
	// ------------------------------------------------------------
	void asignarPropiedades ( uint8_t props ) {
	  // no puedo escribir AUN si el constructor llama a esto: Serial.println( " laCaracteristica.setProperties( props ); ");
	  (*this).laCaracteristica.setProperties( props );
	} // ()

	// .........................................................
	// BleSecurityMode::SECMODE_OPEN  , BleSecurityMode::SECMODE_NO_ACCESS
	// ------------------------------------------------------------
	// permisoRead: BleSecurityMode, permisoWrite: BleSecurityMode --> asignarPermisos() -->
	// What it does: sets who is allowed to read and write this value.
	// ------------------------------------------------------------
	void asignarPermisos( BleSecurityMode permisoRead, BleSecurityMode permisoWrite ) {
	  // no puedo escribir AUN si el constructor llama a esto: Serial.println( "laCaracteristica.setPermission( permisoRead, permisoWrite ); " );
	  (*this).laCaracteristica.setPermission( permisoRead, permisoWrite );
	} // ()

	// ------------------------------------------------------------
	// tam: N --> asignarTamanyoDatos() -->
	// What it does: sets the maximum size (in bytes) of this value.
	// ------------------------------------------------------------
	void asignarTamanyoDatos( uint8_t tam ) {
	  // no puedo escribir AUN si el constructor llama a esto: Serial.print( " (*this).laCaracteristica.setFixedLen( tam = " );
	  // no puedo escribir AUN si el constructor llama a esto: Serial.println( tam );
	  // (*this).laCaracteristica.setFixedLen( tam );
	  (*this).laCaracteristica.setMaxLen( tam );
	} // ()

  public:
	// ------------------------------------------------------------
	// props: N, permisoRead: BleSecurityMode, permisoWrite: BleSecurityMode, tam: N
	//     --> asignarPropiedadesPermisosYTamanyoDatos() -->
	// What it does: sets properties, permissions and size in one call.
	// ------------------------------------------------------------
	void asignarPropiedadesPermisosYTamanyoDatos( uint8_t props,
												 BleSecurityMode permisoRead,
												 BleSecurityMode permisoWrite, 
												 uint8_t tam ) {
	  asignarPropiedades( props );
	  asignarPermisos( permisoRead, permisoWrite );
	  asignarTamanyoDatos( tam );
	} // ()
												 

	// ------------------------------------------------------------
	// str: Text --> escribirDatos() --> N
	// What it does: saves a new value; returns how many bytes were written.
	// ------------------------------------------------------------
	uint16_t escribirDatos( const char * str ) {
	  // Serial.print( " return (*this).laCaracteristica.write( str  = " );
	  // Serial.println( str );

	  uint16_t r = (*this).laCaracteristica.write( str );

	  // Serial.print( ">>>Escritos " ); Serial.print( r ); Serial.println( " bytes con write() " );

	  return r;
	} // ()

	// ------------------------------------------------------------
	// str: Text --> notificarDatos() --> N
	// What it does: saves a new value and notifies the connected phone; returns bytes sent.
	// ------------------------------------------------------------
	uint16_t notificarDatos( const char * str ) {
	  
	  uint16_t r = laCaracteristica.notify( &str[0] );

	  return r;
	} //  ()

	// ------------------------------------------------------------
	// instalarCallbackCaracteristicaEscrita() -->   (el callback se omite en la notación)
	// What it does: says which function to call when the phone writes this value.
	// ------------------------------------------------------------
	void instalarCallbackCaracteristicaEscrita( CallbackCaracteristicaEscrita cb ) {
	  (*this).laCaracteristica.setWriteCallback( cb );
	} // ()

	// ------------------------------------------------------------
	// activar() -->
	// What it does: starts the characteristic so the phone can use it.
	// ------------------------------------------------------------
	void activar() {
	  err_t error = (*this).laCaracteristica.begin();
	  Globales::elPuerto.escribir(  " (*this).laCaracteristica.begin(); error = " );
	  Globales::elPuerto.escribir(  error );
	} // ()

  }; // class Caracteristica
  
  // --------------------------------------------------------
  // --------------------------------------------------------
private:
  
  uint8_t uuidServicio[16] = { // el uuid se copia aquí (al revés) a partir de un string-c
	// least signficant byte, el primero
	'0', '1', '2', '3', 
	'4', '5', '6', '7', 
	'8', '9', 'A', 'B', 
	'C', 'D', 'E', 'F'
  };

  //
  //
  //
  BLEService elServicio;

  //
  //
  //
  std::vector< Caracteristica * > lasCaracteristicas;

public:
  
  // ------------------------------------------------------------
  // nombreServicio: Text --> ServicioEnEmisora() -->
  // What it does: creates a service whose UUID is made from its name.
  // ------------------------------------------------------------
  ServicioEnEmisora( const char * nombreServicio_ )
	:
	elServicio( stringAUint8AlReves( nombreServicio_, &uuidServicio[0], 16 ) )
  {
	
  } // ()
  
  // ------------------------------------------------------------
  // escribeUUID() <--          (solo lee el estado)
  // What it does: prints the service UUID on the Serial Monitor (for debugging).
  // ------------------------------------------------------------
  void escribeUUID() {
	Serial.println ( "**********" );
	for (int i=0; i<= 15; i++) {
	  Serial.print( (char) uuidServicio[i] );
	}
	Serial.println ( "\n**********" );
  } // ()

  // ------------------------------------------------------------
  // car: Caracteristica --> anyadirCaracteristica() -->
  // What it does: adds a characteristic to the list of this service.
  // ------------------------------------------------------------
  void anyadirCaracteristica( Caracteristica & car ) {
	(*this).lasCaracteristicas.push_back( & car );
  } // ()

  // ------------------------------------------------------------
  // activarServicio() -->
  // What it does: starts the service and all its characteristics.
  // ------------------------------------------------------------
  void activarServicio( ) {
	// entiendo que al llegar aquí ya ha sido configurado
	// todo: características y servicio

	err_t error = (*this).elServicio.begin();
	Serial.print( " (*this).elServicio.begin(); error = " );
	Serial.println( error );

	for( auto pCar : (*this).lasCaracteristicas ) {
	  (*pCar).activar();
	} // for

  } // ()

  // ------------------------------------------------------------
  // operator BLEService&() --> BLEService
  // What it does: lets this object be used where Bluefruit expects a BLEService.
  // ------------------------------------------------------------
  operator BLEService&() {
	// "conversión de tipo": si pongo esta clase en un sitio donde necesitan un BLEService
	return elServicio;
  } // ()
	
}; // class

#endif

// ----------------------------------------------------------
// ----------------------------------------------------------
// ----------------------------------------------------------
// ----------------------------------------------------------

