const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');
// Importar mongoose es CRUCIAL para acceder al modelo y limpiar la DB
const mongoose = require('mongoose'); 

chai.use(chaiHttp);

suite('Functional Tests', function() {
    this.timeout(5000);
    
    // Hook para limpiar la base de datos ANTES de que comiencen todas las pruebas
    suiteSetup(function(done) {
        // Obtenemos el modelo 'Stock' que fue creado en api.js
        const Stock = mongoose.model('Stock');

        // Eliminamos todos los documentos para asegurar un estado inicial limpio
        Stock.deleteMany({}, (err) => {
            if (err) {
                console.error("Error al limpiar la DB en suiteSetup:", err);
            }
            done();
        });
    });

    suite('GET /api/stock-prices => stockData object or array', function() {

        test('1 stock', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: 'goog' })
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.property(res.body, 'stockData');
                    assert.equal(res.body.stockData.stock, 'GOOG');
                    assert.isNumber(res.body.stockData.likes);
                    done();
                });
        });

        test('1 stock with like', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: 'tsla', like: true })
                .set('X-Forwarded-For', '10.0.0.1') // Usamos una IP fija
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.equal(res.body.stockData.stock, 'TSLA');
                    assert.equal(res.body.stockData.likes, 1); // Debe ser 1
                    done();
                });
        });

        test('1 stock with like again (no double like)', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: 'tsla', like: true })
                .set('X-Forwarded-For', '10.0.0.1') // Misma IP
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    // El contador NO debe haber aumentado, debe seguir siendo 1
                    assert.equal(res.body.stockData.likes, 1); 
                    done();
                });
        });

        test('2 stocks', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: ['goog', 'msft'] })
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.isArray(res.body.stockData);
                    assert.equal(res.body.stockData.length, 2);
                    assert.property(res.body.stockData[0], 'rel_likes');
                    assert.property(res.body.stockData[1], 'rel_likes');
                    assert.equal(res.body.stockData[0].rel_likes + res.body.stockData[1].rel_likes, 0);
                    done();
                });
        });

        test('2 stocks with like', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: ['aapl', 'amzn'], like: true })
                .set('X-Forwarded-For', '10.0.0.2') // Nueva IP para esta prueba
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.isArray(res.body.stockData);
                    assert.property(res.body.stockData[0], 'rel_likes');
                    assert.equal(res.body.stockData[0].rel_likes + res.body.stockData[1].rel_likes, 0);
                    done();
                });
        });

    });
});
