'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require.require('./routes/fcctesting.js');
const runner = require.require('./test-runner');

const app = express();

// Middleware de seguridad y configuración de Express
app.use('/public', express.static(process.cwd() + '/public'));
app.use(cors({origin: '*'})); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de Helmet para el Content Security Policy (Punto 2)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://code.jquery.com', 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    xssFilter: true,
    frameguard: { action: 'deny' },
    noSniff: true,
    hsts: { maxAge: 7776000 },
    xPoweredBy: false,
  })
);
app.disable('x-powered-by');

// Ruta de inicio
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// === INICIO DE LA CONEXIÓN A MONGOOSE ===
mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
    console.log('Conectado exitosamente a MongoDB.');

    // Rutas (cargadas SOLO después de la conexión a DB)
    fccTestingRoutes(app);
    apiRoutes(app); 
        
    // Middleware 404
    app.use(function(req, res, next) {
      res.status(404)
        .type('text')
        .send('Not Found');
    });

    // Iniciar el Servidor (Listener)
    const listener = app.listen(process.env.PORT || 3000, function () {
      console.log('Your app is listening on port ' + listener.address().port);
      if(process.env.NODE_ENV==='test') {
        console.log('Running Tests...');
        setTimeout(function () {
          try {
            runner.run();
          } catch(e) {
            console.log('Tests are not valid:');
            console.error(e);
          }
        }, 3500);
      }
    });
})
.catch(err => {
    console.error('Error al conectar a MongoDB:', err);
});
// === FIN DE LA CONEXIÓN A MONGOOSE ===


module.exports = app;
