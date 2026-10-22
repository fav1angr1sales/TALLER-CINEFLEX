const { By, until } = require('selenium-webdriver');

/**
 * Page Object: Cartelera
 * Solo localizadores (IDs / CSS) y acciones puras. SIN aserciones.
 */
class CarteleraPage {
  constructor(driver) {
    this.driver = driver;

    // Localizadores
    this.vistaCartelera = By.id('cartelera-view');
    this.titulo = By.id('cartelera-title');
    this.tarjetasPelicula = By.css('#movies-list .movie-card');
    this.titulosPelicula = By.css('#movies-list .movie-title');
    this.filtroGenero = By.id('genre-filter');
    this.nombreUsuario = By.id('user-name');
    this.botonCerrarSesion = By.id('btn-logout');
  }

  botonComprar(peliculaId) {
    return By.id(`btn-comprar-${peliculaId}`);
  }

  async esperarCartelera() {
    await this.driver.wait(until.elementLocated(this.tarjetasPelicula), 10000);
    const titulo = await this.driver.wait(until.elementLocated(this.titulo), 10000);
    await this.driver.wait(until.elementIsVisible(titulo), 10000);
  }

  async obtenerTitulo() {
    return this.driver.findElement(this.titulo).getText();
  }

  async estaTituloVisible() {
    const els = await this.driver.findElements(this.titulo);
    return els.length > 0 && (await els[0].isDisplayed());
  }

  async contarPeliculas() {
    return (await this.driver.findElements(this.tarjetasPelicula)).length;
  }

  async obtenerTitulosPeliculas() {
    const els = await this.driver.findElements(this.titulosPelicula);
    return Promise.all(els.map((e) => e.getText()));
  }

  async seleccionarGenero(genero) {
    const select = await this.driver.findElement(this.filtroGenero);
    await select.click();
    await select.findElement(By.css(`option[value="${genero}"]`)).click();
    await this.driver.sleep(500); // la lista se recarga desde la API
  }

  async obtenerNombreUsuario() {
    const el = await this.driver.findElement(this.nombreUsuario);
    await this.driver.wait(until.elementIsVisible(el), 10000);
    return el.getText();
  }

  async hacerClicComprar(peliculaId) {
    await this.driver.findElement(this.botonComprar(peliculaId)).click();
  }

  async hacerClicCerrarSesion() {
    await this.driver.findElement(this.botonCerrarSesion).click();
  }
}

module.exports = CarteleraPage;
