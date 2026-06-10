// routes/auth.js
const express = require('express');
const router = express.Router();
const {
  registrarUsuario, verificarCodigo, login,
  getPerfil, actualizarPerfil, cambiarPassword, eliminarCuenta,
  realizarCompra, getHistorialCompras,
  verificarToken
} = require('../controllers/authController');

// Rutas públicas
router.post('/register', registrarUsuario);
router.post('/verify-email', verificarCodigo);
router.post('/token', login);

// Rutas protegidas — perfil
router.get('/perfil', verificarToken, getPerfil);
router.put('/perfil', verificarToken, actualizarPerfil);
router.put('/perfil/password', verificarToken, cambiarPassword);
router.delete('/perfil', verificarToken, eliminarCuenta);

// Rutas protegidas — tienda
router.post('/shop/comprar', verificarToken, realizarCompra);
router.get('/shop/historial', verificarToken, getHistorialCompras);

module.exports = router;
