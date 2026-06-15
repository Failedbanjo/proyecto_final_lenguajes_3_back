// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const pendientes = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ── MIDDLEWARE: verifica JWT ──────────────────────────────────
const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// ── POST /api/register ────────────────────────────────────────
const registrarUsuario = async (req, res) => {
  const { username, email, password, tagline, region, fechaNacimiento } = req.body;
  try {
    if (!username || !email || !password)
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });

    const existente = await User.findOne({ $or: [{ email }, { username }] });
    if (existente) return res.status(400).json({ message: 'El usuario o correo ya existe' });

    const passwordHasheada = await bcrypt.hash(password, 10);
    const codigo = String(Math.floor(100000 + Math.random() * 900000));

    // Guarda datos adicionales en el registro pendiente
    pendientes[email] = {
      username, email, passwordHasheada, codigo,
      tagline: tagline || '',
      region: region || '',
      fechaNacimiento: fechaNacimiento || '',
      expira: Date.now() + 10 * 60 * 1000
    };

    await transporter.sendMail({
      from: `"Riot Games" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Bienvenido a Riot Games - Verifica tu cuenta',
      html: `<div style="font-family:Arial;max-width:500px;margin:0 auto">
        <h2 style="color:#C89B3C">Bienvenido a Riot Games, ${username}</h2>
        <p>Tu código de verificación es:</p>
        <h1 style="letter-spacing:8px;color:#C89B3C">${codigo}</h1>
        <p style="color:#888">Este código expira en 10 minutos.</p></div>`
    });

    return res.status(200).json({ message: 'Código enviado al correo' });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

// ── POST /api/verify-email ────────────────────────────────────
const verificarCodigo = async (req, res) => {
  const { email, code } = req.body;
  try {
    const pendiente = pendientes[email];
    if (!pendiente) return res.status(404).json({ status: 'error', message: 'No hay un registro pendiente para este correo.' });
    if (Date.now() > pendiente.expira) {
      delete pendientes[email];
      return res.status(400).json({ status: 'error', message: 'El código expiró. Vuelve a registrarte.' });
    }
    if (String(pendiente.codigo) !== String(code))
      return res.status(400).json({ status: 'error', message: 'El código no coincide.' });

    const nuevoUsuario = await User.create({
      username: pendiente.username,
      email: pendiente.email,
      password: pendiente.passwordHasheada,
      tagline: pendiente.tagline,
      region: pendiente.region,
      fechaNacimiento: pendiente.fechaNacimiento,
      verificado: true
    });

    delete pendientes[email];

    const token = jwt.sign(
      { id: nuevoUsuario._id, username: nuevoUsuario.username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(201).json({ status: 'ok', message: '¡Cuenta creada exitosamente!', token, username: nuevoUsuario.username });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── POST /api/token — Login ───────────────────────────────────
const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) return res.status(400).json({ detail: 'Ingresa usuario/correo y contraseña' });
    // Busca por username O por email (el campo "username" puede ser cualquiera de los dos)
    const usuario = await User.findOne({ $or: [{ username }, { email: username.toLowerCase() }] });
    if (!usuario) return res.status(401).json({ detail: 'Credenciales incorrectas' });
    if (!usuario.verificado) return res.status(403).json({ detail: 'Cuenta no verificada. Revisa tu correo.' });
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) return res.status(401).json({ detail: 'Credenciales incorrectas' });
    const access = jwt.sign({ id: usuario._id, username: usuario.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.status(200).json({ access, username: usuario.username });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// ── GET /api/perfil ───────────────────────────────────────────
const getPerfil = async (req, res) => {
  try {
    const usuario = await User.findById(req.userId).select('-password -codigoVerificacion');
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.status(200).json(usuario);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// ── PUT /api/perfil ───────────────────────────────────────────
const actualizarPerfil = async (req, res) => {
  const { username, email, tagline, region, fechaNacimiento } = req.body;
  try {
    if (!username || !email) return res.status(400).json({ message: 'Username y email son obligatorios' });
    const existente = await User.findOne({ $or: [{ username }, { email }], _id: { $ne: req.userId } });
    if (existente) return res.status(400).json({ message: 'El usuario o correo ya está en uso' });
    const actualizado = await User.findByIdAndUpdate(
      req.userId,
      { username, email, tagline: tagline || '', region: region || '', fechaNacimiento: fechaNacimiento || '' },
      { new: true }
    ).select('-password -codigoVerificacion');
    return res.status(200).json(actualizado);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// ── PUT /api/perfil/password ──────────────────────────────────
const cambiarPassword = async (req, res) => {
  const { passwordActual, nuevaPassword } = req.body;
  try {
    if (!passwordActual || !nuevaPassword) return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    const usuario = await User.findById(req.userId);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    const valida = await bcrypt.compare(passwordActual, usuario.password);
    if (!valida) return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    usuario.password = await bcrypt.hash(nuevaPassword, 10);
    await usuario.save();
    return res.status(200).json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// ── DELETE /api/perfil ────────────────────────────────────────
const eliminarCuenta = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    return res.status(200).json({ message: 'Cuenta eliminada correctamente' });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// ── POST /api/shop/comprar ────────────────────────────────────
// Guarda la compra en el historial del usuario en MongoDB
const realizarCompra = async (req, res) => {
  const { items } = req.body; // items: [{ rp, precio }]
  try {
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'No hay items en el carrito' });

    const usuario = await User.findById(req.userId);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Agrega cada item al historial de compras
    items.forEach((item) => {
      usuario.compras.push({ rp: item.rp, precio: item.precio });
    });

    await usuario.save();

    const totalRp = items.reduce((sum, i) => sum + i.rp, 0);
    const totalPrecio = items.reduce((sum, i) => sum + i.precio, 0);

    return res.status(200).json({
      message: '¡Compra realizada con éxito!',
      totalRp,
      totalPrecio: totalPrecio.toFixed(2),
      compras: usuario.compras
    });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// ── GET /api/shop/historial ───────────────────────────────────
// Devuelve el historial de compras del usuario
const getHistorialCompras = async (req, res) => {
  try {
    const usuario = await User.findById(req.userId).select('compras');
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.status(200).json(usuario.compras);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

module.exports = {
  registrarUsuario, verificarCodigo, login,
  getPerfil, actualizarPerfil, cambiarPassword, eliminarCuenta,
  realizarCompra, getHistorialCompras,
  verificarToken
};
