// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'El nombre de usuario es obligatorio'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El correo es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria']
  },
  // Riot ID
  tagline: {
    type: String,
    default: ''
  },
  // Información personal
  region: {
    type: String,
    default: ''
  },
  fechaNacimiento: {
    type: String,
    default: ''
  },
  // Historial de compras en la tienda
  compras: [{
    rp: Number,
    precio: Number,
    fecha: { type: Date, default: Date.now }
  }],
  verificado: {
    type: Boolean,
    default: false
  },
  codigoVerificacion: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
