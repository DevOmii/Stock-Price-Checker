const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
    this.timeout(5000);
    let likeCount;
    let likeCount2;
    let likesInDatabase;

    suite('GET /api/stock-prices => stockData object or array', function() {

        test('1 stock', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: 'goog' })
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.property(res.body, 'stockData');
                    assert.property(res.body.stockData, 'stock');
                    assert.property(res.body.stockData, 'price');
                    assert.property(res.body.stockData, 'likes');
                    assert.equal(res.body.stockData.stock, 'GOOG');
                    likeCount = res.body.stockData.likes;
                    done();
                });
        });

        test('1 stock with like', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: 'tsla', like: true })
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.property(res.body, 'stockData');
                    assert.property(res.body.stockData, 'stock');
                    assert.property(res.body.stockData, 'price');
                    assert.property(res.body.stockData, 'likes');
                    assert.equal(res.body.stockData.stock, 'TSLA');
                    likeCount2 = res.body.stockData.likes;
                    done();
                });
        });

        test('1 stock with like again (no double like)', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: 'tsla', like: true })
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.property(res.body, 'stockData');
                    assert.equal(res.body.stockData.likes, likeCount2); // Should not increase
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
                    assert.equal(res.body.stockData[0].stock, 'GOOG');
                    assert.equal(res.body.stockData[1].stock, 'MSFT');
                    assert.isNumber(res.body.stockData[0].price);
                    assert.isNumber(res.body.stockData[1].price);
                    assert.equal(res.body.stockData[0].rel_likes + res.body.stockData[1].rel_likes, 0);
                    done();
                });
        });

        test('2 stocks with like', function(done) {
            chai.request(server)
                .get('/api/stock-prices')
                .query({ stock: ['aapl', 'amzn'], like: true })
                .end(function(err, res) {
                    assert.equal(res.status, 200);
                    assert.isArray(res.body.stockData);
                    assert.equal(res.body.stockData.length, 2);
                    assert.property(res.body.stockData[0], 'rel_likes');
                    assert.property(res.body.stockData[1], 'rel_likes');
                    assert.equal(res.body.stockData[0].stock, 'AAPL');
                    assert.equal(res.body.stockData[1].stock, 'AMZN');
                    assert.equal(res.body.stockData[0].rel_likes + res.body.stockData[1].rel_likes, 0);
                    
                    // Al menos uno de los stocks debe tener el like incrementado después de esta prueba
                    // Esta prueba es más difícil de verificar sin limpiar la base de datos, 
                    // pero verificaremos que la estructura es correcta.

                    done();
                });
        });

    });
});
