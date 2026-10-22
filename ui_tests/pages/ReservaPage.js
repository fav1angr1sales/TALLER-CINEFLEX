const { By, until } = require('selenium-webdriver');

/**
 * Page Object: Reserva (selección de asiento, pago y ticket)
 * Solo localizadores (IDs / CSS) y acciones puras. SIN aserciones.
 */
class ReservaPage {
  constructor(driver) {
    this.driver = driver;

    // Localizadores - selección de asiento
    this.vistaReserva = By.id('reserva-view');
    this.tituloReserva = By.id('reserva-title');
    this.asientos = By.css('#seat-map .seat');
    this.asientoSeleccionadoTexto = By.id('selected-seat');

    // Localizadores - pago
    this.inputNombre = By.id('card-name');
    this.inputNumero = By.id('card-number');
    this.inputVencimiento = By.id('card-expiry');
    this.inputCvv = By.id('card-cvv');
    this.botonPagar = By.id('btn-pagar');
    this.botonVolver = By.id('btn-volver');
    this.errorPago = By.css('#payment-error:not(.hidden)');

    // Localizadores - ticket
    this.vistaTicket = By.id('ticket-view');
    this.ticketCodigo = By.id('ticket-code');
    this.ticketPelicula = By.id('ticket-movie');
    this.ticketAsiento = By.id('ticket-seat');
    this.botonVolverCartelera = By.id('btn-volver-cartelera');
  }

  asiento(codigo) {
    return By.css(`#seat-map .seat[data-seat="${codigo}"]`);
  }

  async esperarMapaAsientos() {
    await this.driver.wait(until.elementLocated(this.asientos), 10000);
    await this.driver.wait(until.elementIsVisible(await this.driver.findElement(this.vistaReserva)), 10000);
  }

  async obtenerTituloReserva() {
    return this.driver.findElement(this.tituloReserva).getText();
  }

  async contarAsientos() {
    return (await this.driver.findElements(this.asientos)).length;
  }

  async hacerClicAsiento(codigo) {
    await this.driver.findElement(this.asiento(codigo)).click();
  }

  async estaAsientoOcupado(codigo) {
    const el = await this.driver.findElement(this.asiento(codigo));
    return (await el.getAttribute('class')).split(' ').includes('ocupado');
  }

  async estaAsientoHabilitado(codigo) {
    return this.driver.findElement(this.asiento(codigo)).isEnabled();
  }

  async estaAsientoSeleccionado(codigo) {
    const el = await this.driver.findElement(this.asiento(codigo));
    return (await el.getAttribute('class')).split(' ').includes('seleccionado');
  }

  async obtenerTextoAsientoSeleccionado() {
    return this.driver.findElement(this.asientoSeleccionadoTexto).getText();
  }

  async llenarFormularioPago({ nombre, numero, vencimiento, cvv }) {
    await this.driver.findElement(this.inputNombre).sendKeys(nombre);
    await this.driver.findElement(this.inputNumero).sendKeys(numero);
    await this.driver.findElement(this.inputVencimiento).sendKeys(vencimiento);
    await this.driver.findElement(this.inputCvv).sendKeys(cvv);
  }

  async hacerClicPagar() {
    await this.driver.findElement(this.botonPagar).click();
  }

  async hacerClicVolver() {
    await this.driver.findElement(this.botonVolver).click();
  }

  async esperarErrorPago() {
    const el = await this.driver.wait(until.elementLocated(this.errorPago), 10000);
    await this.driver.wait(until.elementIsVisible(el), 10000);
    return el.getText();
  }

  async esperarTicket() {
    const vista = await this.driver.wait(until.elementLocated(this.vistaTicket), 10000);
    await this.driver.wait(until.elementIsVisible(vista), 10000);
  }

  async obtenerCodigoTicket() {
    return this.driver.findElement(this.ticketCodigo).getText();
  }

  async obtenerPeliculaTicket() {
    return this.driver.findElement(this.ticketPelicula).getText();
  }

  async obtenerAsientoTicket() {
    return this.driver.findElement(this.ticketAsiento).getText();
  }

  async hacerClicVolverACartelera() {
    await this.driver.findElement(this.botonVolverCartelera).click();
  }
}

module.exports = ReservaPage;
