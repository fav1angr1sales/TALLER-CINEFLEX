const { By, until } = require('selenium-webdriver');

/**
 * Page Object: Login
 * Solo localizadores (IDs / CSS) y acciones puras. SIN aserciones.
 */
class LoginPage {
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Localizadores
    this.vistaLogin = By.id('login-view');
    this.inputEmail = By.id('email');
    this.inputPassword = By.id('password');
    this.botonIngresar = By.id('btn-login');
    this.mensaje = By.css('#login-message.mensaje:not(.hidden)');
  }

  async abrir() {
    await this.driver.get(this.baseUrl);
    await this.driver.executeScript('window.sessionStorage.clear();');
    await this.driver.navigate().refresh();
    await this.driver.wait(until.elementIsVisible(await this.driver.wait(until.elementLocated(this.vistaLogin), 10000)), 10000);
  }

  async ingresarCredenciales(email, password) {
    const campoEmail = await this.driver.findElement(this.inputEmail);
    const campoPassword = await this.driver.findElement(this.inputPassword);
    await campoEmail.clear();
    await campoPassword.clear();
    if (email) await campoEmail.sendKeys(email);
    if (password) await campoPassword.sendKeys(password);
  }

  async hacerClicIngresar() {
    await this.driver.findElement(this.botonIngresar).click();
  }

  async iniciarSesion(email, password) {
    await this.ingresarCredenciales(email, password);
    await this.hacerClicIngresar();
  }

  async esperarMensaje() {
    const el = await this.driver.wait(until.elementLocated(this.mensaje), 10000);
    await this.driver.wait(until.elementIsVisible(el), 10000);
    return el;
  }

  async obtenerTextoMensaje() {
    const el = await this.esperarMensaje();
    return el.getText();
  }

  async esperarMensajeConTexto(fragmento) {
    await this.driver.wait(async () => {
      const els = await this.driver.findElements(this.mensaje);
      if (!els.length) return false;
      return (await els[0].getText()).includes(fragmento);
    }, 10000);
    return this.obtenerTextoMensaje();
  }

  async estaVistaLoginVisible() {
    const els = await this.driver.findElements(this.vistaLogin);
    return els.length > 0 && (await els[0].isDisplayed());
  }

  async estaBotonIngresarHabilitado() {
    return this.driver.findElement(this.botonIngresar).isEnabled();
  }
}

module.exports = LoginPage;
