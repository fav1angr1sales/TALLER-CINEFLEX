/**
 * CineFlex - API REST simulada (Mock)
 * -----------------------------------
 * Capas simuladas:
 *   - Autenticación con JWT y bloqueo preventivo (3 intentos fallidos)
 *   - Inventario de salas en memoria (sustituye a la base de datos relacional)
 *   - Pasarela de pagos externa -> STUB (ver función pasarelaPagosStub)
 *
 * Seguridad perimetral: Helmet. Trazabilidad: Morgan.
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cineflex-secret-solo-para-pruebas';
const MAX_INTENTOS = 3;

const app = express();

// ---------------------------------------------------------------------------
// Middleware de seguridad y trazabilidad
// ---------------------------------------------------------------------------
app.use(
  helmet({
    // El frontend mock usa un <script> inline, por eso se relaja solo script-src.
    // En entorno de pruebas (http://localhost) se desactivan HSTS y
    // upgrade-insecure-requests, que forzarían HTTPS y romperían la carga.
    hsts: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(morgan('dev'));
app.use(express.json());

// ---------------------------------------------------------------------------
// "Base de datos" en memoria
// ---------------------------------------------------------------------------
const USUARIOS = [
  { id: 1, email: 'test@cineflex.com', password: 'Cine1234', nombre: 'Usuario QA' },
];

const PELICULAS = [
  { id: 1, titulo: 'Galaxia Final', genero: 'Ciencia ficción', duracion: 148, precio: 18000 },
  { id: 2, titulo: 'Furia en la Ciudad', genero: 'Acción', duracion: 126, precio: 16000 },
  { id: 3, titulo: 'Risas de Domingo', genero: 'Comedia', duracion: 98, precio: 15000 },
  { id: 4, titulo: 'El Último Verano', genero: 'Drama', duracion: 112, precio: 15000 },
];

const FILAS = ['A', 'B', 'C', 'D'];
const COLUMNAS = [1, 2, 3, 4, 5, 6];
const OCUPADOS_INICIALES = ['A1', 'A2', 'B3'];

let asientos; // { [peliculaId]: { A1: 'libre' | 'ocupado' } }
let tickets;
let intentosFallidos; // { [email]: number }
let ticketSeq;

function reiniciarEstado() {
  asientos = {};
  PELICULAS.forEach((p) => {
    asientos[p.id] = {};
    FILAS.forEach((f) =>
      COLUMNAS.forEach((c) => {
        const codigo = `${f}${c}`;
        asientos[p.id][codigo] = OCUPADOS_INICIALES.includes(codigo) ? 'ocupado' : 'libre';
      })
    );
  });
  tickets = [];
  intentosFallidos = {};
  ticketSeq = 1000;
}
reiniciarEstado();

// ---------------------------------------------------------------------------
// STUB de la pasarela de pagos (banco externo)
// Responde de forma determinista según el número de tarjeta, sin red.
// ---------------------------------------------------------------------------
function luhnValido(numero) {
  let suma = 0;
  let alternar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let n = parseInt(numero[i], 10);
    if (alternar) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    suma += n;
    alternar = !alternar;
  }
  return suma % 10 === 0;
}

function pasarelaPagosStub({ numero, cvv, vencimiento, monto }) {
  const limpio = String(numero || '').replace(/\s|-/g, '');

  if (!/^\d{13,19}$/.test(limpio) || !luhnValido(limpio)) {
    return { status: 400, body: { aprobado: false, codigo: 'TARJETA_INVALIDA', mensaje: 'Tarjeta inválida' } };
  }
  if (!/^\d{3,4}$/.test(String(cvv || ''))) {
    return { status: 400, body: { aprobado: false, codigo: 'CVV_INVALIDO', mensaje: 'CVV inválido' } };
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(vencimiento || ''))) {
    return { status: 400, body: { aprobado: false, codigo: 'VENCIMIENTO_INVALIDO', mensaje: 'Fecha de vencimiento inválida' } };
  }
  if (limpio === '4000000000000002') {
    return { status: 402, body: { aprobado: false, codigo: 'TARJETA_RECHAZADA', mensaje: 'Pago rechazado por el banco' } };
  }
  if (limpio === '4000000000009995') {
    return { status: 402, body: { aprobado: false, codigo: 'FONDOS_INSUFICIENTES', mensaje: 'Fondos insuficientes' } };
  }
  return {
    status: 200,
    body: { aprobado: true, codigo: 'APROBADO', mensaje: 'Pago aprobado', autorizacion: `AUT-${Date.now()}`, monto },
  };
}

// ---------------------------------------------------------------------------
// Middleware de autenticación JWT
// ---------------------------------------------------------------------------
function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => res.json({ estado: 'ok' }));

// Utilidad solo para pruebas: restablece asientos, tickets e intentos de login.
app.post('/api/test/reset', (req, res) => {
  reiniciarEstado();
  res.json({ mensaje: 'Estado reiniciado' });
});

// Endpoint 1: Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
  }

  const clave = String(email).toLowerCase();
  if ((intentosFallidos[clave] || 0) >= MAX_INTENTOS) {
    return res.status(423).json({ mensaje: 'Cuenta bloqueada por demasiados intentos fallidos' });
  }

  const usuario = USUARIOS.find((u) => u.email === clave && u.password === password);
  if (!usuario) {
    intentosFallidos[clave] = (intentosFallidos[clave] || 0) + 1;
    if (intentosFallidos[clave] >= MAX_INTENTOS) {
      return res.status(423).json({ mensaje: 'Cuenta bloqueada por demasiados intentos fallidos' });
    }
    return res.status(401).json({
      mensaje: 'Credenciales inválidas',
      intentosRestantes: MAX_INTENTOS - intentosFallidos[clave],
    });
  }

  intentosFallidos[clave] = 0;
  const token = jwt.sign({ sub: usuario.id, email: usuario.email, nombre: usuario.nombre }, JWT_SECRET, {
    expiresIn: '1h',
  });
  res.status(200).json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } });
});

// Endpoint 2: Cartelera (acepta ?genero=)
app.get('/api/cartelera', autenticar, (req, res) => {
  const { genero } = req.query;
  const lista = genero ? PELICULAS.filter((p) => p.genero === genero) : PELICULAS;
  res.json({ total: lista.length, peliculas: lista });
});

// Consulta de asientos de una película
app.get('/api/asientos/:peliculaId', autenticar, (req, res) => {
  const mapa = asientos[req.params.peliculaId];
  if (!mapa) return res.status(404).json({ mensaje: 'Película no encontrada' });
  const lista = Object.entries(mapa).map(([codigo, estado]) => ({ codigo, estado }));
  res.json({
    peliculaId: Number(req.params.peliculaId),
    disponibles: lista.filter((a) => a.estado === 'libre').length,
    asientos: lista,
  });
});

// Endpoint 3: Reserva + pago
app.post('/api/reserva', autenticar, (req, res) => {
  const { peliculaId, asiento, tarjeta } = req.body || {};
  if (!peliculaId || !asiento || !tarjeta) {
    return res.status(400).json({ mensaje: 'peliculaId, asiento y tarjeta son obligatorios' });
  }
  const pelicula = PELICULAS.find((p) => p.id === Number(peliculaId));
  if (!pelicula) return res.status(404).json({ mensaje: 'Película no encontrada' });
  if (!asientos[pelicula.id][asiento]) return res.status(400).json({ mensaje: 'Asiento inexistente' });
  if (asientos[pelicula.id][asiento] === 'ocupado') {
    return res.status(409).json({ mensaje: 'El asiento ya está ocupado' });
  }

  const pago = pasarelaPagosStub({ ...tarjeta, monto: pelicula.precio });
  if (!pago.body.aprobado) {
    // El asiento NO se bloquea si el pago falla.
    return res.status(pago.status).json({ mensaje: pago.body.mensaje, codigo: pago.body.codigo });
  }

  asientos[pelicula.id][asiento] = 'ocupado';
  const ticket = {
    codigo: `CF-${++ticketSeq}`,
    pelicula: pelicula.titulo,
    asiento,
    monto: pelicula.precio,
    autorizacion: pago.body.autorizacion,
    usuario: req.usuario.email,
  };
  tickets.push(ticket);
  res.status(201).json({ mensaje: 'Reserva confirmada', ticket });
});

// Logout (el JWT es stateless; el cliente descarta el token)
app.post('/api/logout', autenticar, (req, res) => res.json({ mensaje: 'Sesión cerrada' }));

// El mismo servidor sirve el frontend mock en http://localhost:3000
app.use(express.static(path.join(__dirname, '..', 'frontend')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`CineFlex mock escuchando en http://localhost:${PORT}`));
}

module.exports = app;
