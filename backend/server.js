// server.js
// Punto de entrada del backend Express + MongoDB

require('dotenv').config(); // Carga las variables de entorno del archivo .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 8000;

// ─────────────────────────────────────────────
// Middlewares globales
// ─────────────────────────────────────────────

// Habilita CORS para que Angular (localhost:4200) pueda consumir la API
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsea el body de las peticiones como JSON
app.use(express.json());

// ─────────────────────────────────────────────
// Rutas de la API
// ─────────────────────────────────────────────
app.use('/api', authRoutes);

// Ruta de prueba: GET / → confirma que el servidor está corriendo
app.get('/', (req, res) => {
  res.json({ message: 'Backend Express corriendo correctamente' });
});

// Manejo de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// ─────────────────────────────────────────────
// Conexión a MongoDB y arranque del servidor
// ─────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Conectado a MongoDB');
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB:', err.message);
    process.exit(1); // Sale del proceso si la DB no conecta
  });
