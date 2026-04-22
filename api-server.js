// api-server.js — Servidor API completo para producción
// Arranca con: node api-server.js

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const axios   = require('axios'); 

const { procesarDireccion } = require('./bot');

const app = express();

// ─── MIDDLEWARES ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── LOGS ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('es-CL')}] ${req.method} ${req.path}`);
  next();
});

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ─── ENDPOINT RUT — llama a api.js del celular ────────────────
const API_CELULAR = process.env.API_CELULAR || 'http://192.168.1.7:3000';

app.post('/rut', async (req, res) => {
  const { rut } = req.body;
  if (!rut) return res.status(400).json({ ok: false, error: 'Falta el campo rut' });

  const rutLimpio = rut.replace(/\./g, '').toUpperCase();
  console.log(`[RUT] Consultando: ${rutLimpio}`);

  try {
    console.log(`[HTTP] Conectando a: ${API_CELULAR}/evaluar`);
    
    const respuesta = await axios.post(`${API_CELULAR}/evaluar`, {
      rut: rutLimpio
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    });

    console.log(`[HTTP] Status: ${respuesta.status}`);
    console.log(`[RUT] Resultado: ${respuesta.data.ok ? '✅' : '❌'} ${rutLimpio}`);
    res.json(respuesta.data);

  } catch (e) {
    if (e.code === 'ECONNABORTED') {
      console.error(`[RUT] Timeout: Celular no responde`);
      return res.status(504).json({ ok: false, error: 'Timeout: El celular no respondió' });
    }
    
    if (e.response) {
      console.error(`[RUT] Error HTTP: ${e.response.status}`);
      return res.status(e.response.status).json({ 
        ok: false, 
        error: `Error del celular: HTTP ${e.response.status}` 
      });
    }
    
    console.error(`[RUT] Error: ${e.message}`);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── ENDPOINT VERIFICAR DIRECCIÓN — SSE ───────────────────────
// GET /verificar?direccion=Av+Providencia+1234,+Providencia
app.get('/verificar', async (req, res) => {
  const { direccion } = req.query;
  if (!direccion) return res.status(400).json({ error: 'Falta dirección' });

  console.log(`[DIRECCIÓN] Verificando: ${direccion}`);

  // Headers SSE
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Keepalive cada 20s para que no cierre la conexión
  const keepalive = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  const enviar = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const enviarMensaje = async (texto) => {
    enviar({ tipo: 'mensaje', texto });
  };

  const enviarFoto = async (rutaFoto, caption) => {
    const nombre = path.basename(rutaFoto);
    enviar({ tipo: 'foto', nombre, caption });
  };

  try {
    await procesarDireccion(direccion, enviarMensaje, enviarFoto);
    console.log(`[DIRECCIÓN] ✅ Completado: ${direccion}`);
  } catch (e) {
    console.error(`[DIRECCIÓN] ❌ Error: ${e.message}`);
    enviar({ tipo: 'error', texto: e.message });
  } finally {
    clearInterval(keepalive);
    enviar({ tipo: 'fin' });
    res.end();
  }
});

// ─── ENDPOINT IMÁGENES ────────────────────────────────────────
app.get('/imagen/:nombre', (req, res) => {
  // Evitar path traversal
  const nombre = path.basename(req.params.nombre);
  const ruta   = path.join(__dirname, nombre);

  if (!fs.existsSync(ruta)) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  res.sendFile(ruta);
});

// ─── MANEJO DE ERRORES GLOBAL ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ ok: false, error: err.message });
});

// ─── INICIAR SERVIDOR ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50));
  console.log('🚀 API Server corriendo');
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Celular: ${API_CELULAR}`);
  console.log('─'.repeat(50));
  console.log('Endpoints disponibles:');
  console.log(`  GET  /health`);
  console.log(`  POST /rut         { "rut": "12345678-9" }`);
  console.log(`  GET  /verificar?direccion=Av+Ejemplo+123,+Comuna`);
  console.log(`  GET  /imagen/:nombre`);
  console.log('═'.repeat(50) + '\n');
});

process.on('unhandledRejection', err => console.error('❌ Error no manejado:', err.message));




///////////////////////////////////////////////////////////////////  VAMOS QUE SE PUEDE 
