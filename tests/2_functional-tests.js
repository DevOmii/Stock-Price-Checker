const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server'); 

chai.use(chaiHttp);

suite('Functional Tests', function() {

  const testStock = 'MSFT'; 
  const testStock2 = 'GOOG'; 

  suiteSetup(async () => {
    const StockModel = require('../routes/api.js').StockModel; 
    if (StockModel) {
      await StockModel.deleteMany({ stock: testStock });
      await StockModel.deleteMany({ stock: testStock2 });
    }
  });

  suite('GET /api/stock-prices', function() {

    test('1. Viewing one stock', function(done) {
      chai.request(server)
        .get('/api/stock-prices')
        .query({ stock: testStock })
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.isObject(res.body);
          assert.property(res.body, 'stockData');
          assert.equal(res.body.stockData.stock, testStock);
          assert.property(res.body.stockData, 'price');
          assert.property(res.body.stockData, 'likes');
          assert.equal(res.body.stockData.likes, 0); 
          done();
        });
    });

    test('2. Viewing one stock and liking it', function(done) {
      chai.request(server)
        .get('/api/stock-prices')
        .query({ stock: testStock, like: 'true' })
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.isObject(res.body);
          assert.property(res.body, 'stockData');
          assert.equal(res.body.stockData.stock, testStock);
          assert.property(res.body.stockData, 'price');
          assert.property(res.body.stockData, 'likes');
          assert.equal(res.body.stockData.likes, 1); 
          done();
        });
    });

    test('3. Viewing the same stock and liking it again', function(done) {
      chai.request(server)
        .get('/api/stock-prices')
        .query({ stock: testStock, like: 'true' })
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.isObject(res.body);
          assert.property(res.body, 'stockData');
          assert.equal(res.body.stockData.stock, testStock);
          assert.property(res.body.stockData, 'price');
          assert.property(res.body.stockData, 'likes');
          assert.equal(res.body.stockData.likes, 1); 
          done();
        });
    });

    test('4. Viewing two stocks', function(done) {
      chai.request(server)
        .get('/api/stock-prices')
        .query({ stock: [testStock, testStock2] }) 
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.isObject(res.body);
          assert.property(res.body, 'stockData');
          assert.isArray(res.body.stockData);
          assert.equal(res.body.stockData.length, 2);
          assert.equal(res.body.stockData[0].stock, testStock);
          assert.equal(res.body.stockData[1].stock, testStock2);
          assert.property(res.body.stockData[0], 'rel_likes');
          assert.property(res.body.stockData[1], 'rel_likes');
          done();
        });
    });

    test('5. Viewing two stocks and liking them', function(done) {
      chai.request(server)
        .get('/api/stock-prices')
        .query({ stock: [testStock, testStock2], like: 'true' })
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.isObject(res.body);
          assert.property(res.body, 'stockData');
          assert.isArray(res.body.stockData);
          assert.equal(res.body.stockData.length, 2);
          assert.equal(res.body.stockData[0].stock, testStock);
          assert.equal(res.body.stockData[0].rel_likes, 0);
          assert.equal(res.body.stockData[1].stock, testStock2);
          assert.equal(res.body.stockData[1].rel_likes, 0);
          done();
        });
    });

  });
});