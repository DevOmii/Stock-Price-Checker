'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner');
const helmet = require('helmet');

const app = express();

app.use('/public', express.static(process.cwd() + '/public'));

app.use(cors({origin: '*'}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de Seguridad: CSP estricta
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], 
    styleSrc: ["'self'"], 
    // Permite la conexión al proxy de stock para la funcionalidad de la API
    connectSrc: ["'self'", "https://stock-price-checker-proxy.freecodecamp.rocks"],
    frameSrc: ["'self'"]
  },
}));

// Otras configuraciones de seguridad de Helmet
app.use(helmet.frameguard({ action: 'deny' })); // Clickjacking protection
app.use(helmet.xssFilter()); // XSS protection
app.use(helmet.noSniff()); // MIME type sniffing protection
app.use(helmet.hsts({ maxAge: 7776000 })); // HSTS (HTTP Strict Transport Security)
app.disable('x-powered-by'); // Remove X-Powered-By header


app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

fccTestingRoutes(app);

apiRoutes(app); 
    
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

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

module.exports = app;
