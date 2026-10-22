/**
 * Suite principal de pruebas UI - CineFlex
 * Selenium WebDriver + Mocha + Page Object Model
 *
 * Todas las aserciones viven AQUÍ; las clases de /pages solo contienen
 * localizadores y acciones.
 *
 * Variables de entorno opcionales:
 *   BASE_URL      (default http://localhost:3000)
 *   HEADLESS      ("false" para ver el navegador)
 *   CHROME_BIN    (ruta a un binario de Chrome/Chromium)
 *   CHROMEDRIVER_PATH (ruta a chromedriver)
 */
const assert = require('assert');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const LoginPage = require('./pages/LoginPage');
const CarteleraPage = require('./pages/CarteleraPage');
const ReservaPage = require('./pages/ReservaPage');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USUARIO = { email: 'test@cineflex.com', password: 'Cine1234' };
const TARJETA_OK = { nombre: 'Usuario QA', numero: '4111 1111 1111 1111', vencimiento: '12/30', cvv: '123' };
const TARJETA_RECHAZADA = { nombre: 'Usuario QA', numero: '4000 0000 0000 0002', vencimiento: '12/30', cvv: '123' };

async function reiniciarBackend() {
  const r = await fetch(`${BASE_URL}/api/test/reset`, { method: 'POST' });
  assert.strictEqual(r.status, 200, 'No se pudo reiniciar el estado del backend');
}

function construirDriver() {
  const opciones = new chrome.Options();
  if (process.env.HEADLESS !== 'false') opciones.addArguments('--headless=new');
  opciones.addArguments('--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900');
  if (process.env.CHROME_BIN) opciones.setChromeBinaryPath(process.env.CHROME_BIN);

  const builder = new Builder().forBrowser('chrome').setChromeOptions(opciones);
  if (process.env.CHROMEDRIVER_PATH) {
    builder.setChromeService(new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH));
  }
  return builder.build();
}

describe('CineFlex - Suite de pruebas UI (Selenium + POM)', function () {
  let driver;
  let loginPage;
  let carteleraPage;
  let reservaPage;

  before(async function () {
    driver = await construirDriver();
    loginPage = new LoginPage(driver, BASE_URL);
    carteleraPage = new CarteleraPage(driver);
    reservaPage = new ReservaPage(driver);
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // Cada caso parte de un estado limpio: backend reiniciado y sesión cerrada.
  beforeEach(async function () {
    await reiniciarBackend();
    await loginPage.abrir();
  });

  async function iniciarSesionValida() {
    await loginPage.iniciarSesion(USUARIO.email, USUARIO.password);
    await carteleraPage.esperarCartelera();
  }

  async function irAReserva(peliculaId) {
    await carteleraPage.hacerClicComprar(peliculaId);
    await reservaPage.esperarMapaAsientos();
  }

  // -------------------------------------------------------------------------
  describe('Módulo Login', function () {
    it('TC01 - La pantalla de login muestra los campos y el botón Ingresar', async function () {
      assert.ok(await loginPage.estaVistaLoginVisible(), 'La vista de login debe estar visible');
      assert.ok(await loginPage.estaBotonIngresarHabilitado(), 'El botón Ingresar debe estar habilitado');
    });

    it('TC02 - Credenciales vacías muestran mensaje de validación', async function () {
      await loginPage.hacerClicIngresar();
      const texto = await loginPage.obtenerTextoMensaje();
      assert.ok(texto.includes('obligatorios'), `Mensaje inesperado: "${texto}"`);
    });

    it('TC03 - Credenciales erróneas muestran error con intentos restantes', async function () {
      await loginPage.iniciarSesion(USUARIO.email, 'ClaveIncorrecta');
      const texto = await loginPage.esperarMensajeConTexto('Credenciales inválidas');
      assert.ok(texto.includes('Intentos restantes: 2'), `Mensaje inesperado: "${texto}"`);
    });

    it('TC04 - Bloqueo preventivo tras 3 intentos fallidos consecutivos', async function () {
      for (let i = 0; i < 3; i++) {
        await loginPage.iniciarSesion(USUARIO.email, `ClaveMala${i}`);
        if (i < 2) await loginPage.esperarMensajeConTexto('Credenciales inválidas');
      }
      const texto = await loginPage.esperarMensajeConTexto('Cuenta bloqueada');
      assert.ok(texto.includes('Cuenta bloqueada'), `Mensaje inesperado: "${texto}"`);
      assert.strictEqual(await loginPage.estaBotonIngresarHabilitado(), false, 'El botón debe quedar deshabilitado');
    });

    it('TC05 - Una cuenta bloqueada rechaza incluso las credenciales correctas', async function () {
      for (let i = 0; i < 3; i++) {
        await loginPage.iniciarSesion(USUARIO.email, `ClaveMala${i}`);
        if (i < 2) await loginPage.esperarMensajeConTexto('Credenciales inválidas');
      }
      await loginPage.esperarMensajeConTexto('Cuenta bloqueada');

      // Se recarga la página (el botón vuelve a habilitarse) pero el bloqueo vive en el servidor.
      await driver.navigate().refresh();
      await loginPage.iniciarSesion(USUARIO.email, USUARIO.password);
      const texto = await loginPage.esperarMensajeConTexto('Cuenta bloqueada');
      assert.ok(texto.includes('Cuenta bloqueada'));
      assert.strictEqual(await carteleraPage.estaTituloVisible(), false, 'No debe mostrarse la cartelera');
    });

    it('TC06 - Login exitoso renderiza el título "Cartelera" en el DOM', async function () {
      await iniciarSesionValida();
      assert.strictEqual(await carteleraPage.obtenerTitulo(), 'Cartelera');
      assert.ok(await carteleraPage.estaTituloVisible());
    });
  });

  // -------------------------------------------------------------------------
  describe('Módulo Cartelera', function () {
    it('TC07 - La cartelera lista las 4 películas disponibles', async function () {
      await iniciarSesionValida();
      assert.strictEqual(await carteleraPage.contarPeliculas(), 4);
      const titulos = await carteleraPage.obtenerTitulosPeliculas();
      assert.ok(titulos.includes('Galaxia Final'));
    });

    it('TC08 - El filtro por género muestra solo películas del género elegido', async function () {
      await iniciarSesionValida();
      await carteleraPage.seleccionarGenero('Comedia');
      assert.strictEqual(await carteleraPage.contarPeliculas(), 1);
      assert.deepStrictEqual(await carteleraPage.obtenerTitulosPeliculas(), ['Risas de Domingo']);
    });

    it('TC09 - Se muestra el nombre del usuario autenticado', async function () {
      await iniciarSesionValida();
      assert.strictEqual(await carteleraPage.obtenerNombreUsuario(), 'Usuario QA');
    });
  });

  // -------------------------------------------------------------------------
  describe('Módulo Reserva y Pago', function () {
    it('TC10 - Comprar una película abre el mapa de 24 asientos', async function () {
      await iniciarSesionValida();
      await irAReserva(2);
      assert.strictEqual(await reservaPage.obtenerTituloReserva(), 'Furia en la Ciudad');
      assert.strictEqual(await reservaPage.contarAsientos(), 24);
    });

    it('TC11 - Un asiento ocupado aparece marcado y deshabilitado', async function () {
      await iniciarSesionValida();
      await irAReserva(1);
      assert.ok(await reservaPage.estaAsientoOcupado('A1'), 'A1 debe estar ocupado');
      assert.strictEqual(await reservaPage.estaAsientoHabilitado('A1'), false, 'A1 no debe poder seleccionarse');
    });

    it('TC12 - Seleccionar un asiento libre lo marca como seleccionado', async function () {
      await iniciarSesionValida();
      await irAReserva(1);
      await reservaPage.hacerClicAsiento('C3');
      assert.ok(await reservaPage.estaAsientoSeleccionado('C3'));
      assert.strictEqual(await reservaPage.obtenerTextoAsientoSeleccionado(), 'C3');
    });

    it('TC13 - Una tarjeta rechazada muestra error y NO genera ticket', async function () {
      await iniciarSesionValida();
      await irAReserva(1);
      await reservaPage.hacerClicAsiento('C3');
      await reservaPage.llenarFormularioPago(TARJETA_RECHAZADA);
      await reservaPage.hacerClicPagar();
      const error = await reservaPage.esperarErrorPago();
      assert.ok(error.includes('rechazado'), `Mensaje inesperado: "${error}"`);
      assert.strictEqual(await reservaPage.estaAsientoOcupado('C3'), false, 'El asiento no debe bloquearse');
    });

    it('TC14 - Flujo E2E completo: película, asiento, pago y ticket virtual', async function () {
      await iniciarSesionValida();
      await irAReserva(2);
      await reservaPage.hacerClicAsiento('C3');
      await reservaPage.llenarFormularioPago(TARJETA_OK);
      await reservaPage.hacerClicPagar();
      await reservaPage.esperarTicket();

      assert.match(await reservaPage.obtenerCodigoTicket(), /^CF-\d+$/);
      assert.strictEqual(await reservaPage.obtenerPeliculaTicket(), 'Furia en la Ciudad');
      assert.strictEqual(await reservaPage.obtenerAsientoTicket(), 'C3');
    });

    it('TC15 - Tras una compra exitosa el asiento queda ocupado', async function () {
      await iniciarSesionValida();
      await irAReserva(3);
      await reservaPage.hacerClicAsiento('D5');
      await reservaPage.llenarFormularioPago(TARJETA_OK);
      await reservaPage.hacerClicPagar();
      await reservaPage.esperarTicket();

      await reservaPage.hacerClicVolverACartelera();
      await carteleraPage.esperarCartelera();
      await irAReserva(3);
      assert.ok(await reservaPage.estaAsientoOcupado('D5'), 'D5 debe figurar como ocupado');
      assert.strictEqual(await reservaPage.estaAsientoHabilitado('D5'), false);
    });
  });

  // -------------------------------------------------------------------------
  describe('Módulo Navegación Segura', function () {
    it('TC16 - "Cerrar sesión" regresa a la pantalla de login', async function () {
      await iniciarSesionValida();
      await carteleraPage.hacerClicCerrarSesion();
      await driver.wait(async () => loginPage.estaVistaLoginVisible(), 10000);
      assert.ok(await loginPage.estaVistaLoginVisible());
      assert.strictEqual(await carteleraPage.estaTituloVisible(), false);
    });

    it('TC17 - Tras cerrar sesión, el botón "Atrás" no permite ver la cartelera', async function () {
      await iniciarSesionValida();
      await carteleraPage.hacerClicCerrarSesion();
      await driver.wait(async () => loginPage.estaVistaLoginVisible(), 10000);

      await driver.navigate().back();
      await driver.sleep(500);

      assert.ok(await loginPage.estaVistaLoginVisible(), 'Debe seguir mostrándose el login');
      assert.strictEqual(await carteleraPage.estaTituloVisible(), false, 'La cartelera no debe ser accesible');
      assert.ok((await driver.getCurrentUrl()).endsWith('#/login'));
    });

    it('TC18 - Acceder directamente a #/cartelera sin sesión redirige al login', async function () {
      await driver.get(`${BASE_URL}/#/cartelera`);
      await driver.wait(async () => loginPage.estaVistaLoginVisible(), 10000);
      assert.strictEqual(await carteleraPage.estaTituloVisible(), false);
    });
  });
});
