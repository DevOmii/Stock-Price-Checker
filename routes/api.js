'use strict';

const mongoose = require('mongoose');
const fetch = require('node-fetch');
const crypto = require('crypto');

mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const stockSchema = new mongoose.Schema({
  stock: { type: String, required: true },
  likes: { type: Number, default: 0 },
  ips: [String]
});

const StockModel = mongoose.model('Stock', stockSchema);

async function getStockPrice(stockSymbol) {
  try {
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockSymbol}/quote`;
    const response = await fetch(url);
    const responseText = await response.text();

    if (responseText.includes('Not found') || responseText.includes('Unknown symbol')) {
      return null;
    }
    
    const data = JSON.parse(responseText);
    return data.latestPrice;

  } catch (error) {
    return null;
  }
}

async function getStockLikes(stockSymbol, addLike, anonIp) {
  let stockDoc;

  if (addLike) {
    stockDoc = await StockModel.findOne({ stock: stockSymbol });

    if (!stockDoc) {
      stockDoc = new StockModel({
        stock: stockSymbol,
        likes: 1,
        ips: [anonIp]
      });
      await stockDoc.save();
    }
    else if (!stockDoc.ips.includes(anonIp)) {
      stockDoc.likes++;
      stockDoc.ips.push(anonIp);
      await stockDoc.save();
    }
    
  } else {
    stockDoc = await StockModel.findOne({ stock: stockSymbol });
  }

  return stockDoc ? stockDoc.likes : 0;
}

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const { stock, like } = req.query;
      const addLike = like === 'true';
      const anonIp = crypto.createHash('sha256').update(req.ip).digest('hex');

      if (typeof stock === 'string') {
        const stockSymbol = stock.toUpperCase();
        const price = await getStockPrice(stockSymbol);
        
        if (!price) {
          return res.json({ error: "Stock no válido" });
        }
        
        const likes = await getStockLikes(stockSymbol, addLike, anonIp);

        return res.json({
          stockData: {
            stock: stockSymbol,
            price: price,
            likes: likes
          }
        });
      }

      if (Array.isArray(stock) && stock.length === 2) {
        const stockSymbol1 = stock[0].toUpperCase();
        const stockSymbol2 = stock[1].toUpperCase();

        const [price1, price2] = await Promise.all([
          getStockPrice(stockSymbol1),
          getStockPrice(stockSymbol2)
        ]);

        if (!price1 || !price2) {
          return res.json({ error: "Uno de los stocks no es válido" });
        }

        const [likes1, likes2] = await Promise.all([
          getStockLikes(stockSymbol1, addLike, anonIp),
          getStockLikes(stockSymbol2, addLike, anonIp)
        ]);

        const rel_likes1 = likes1 - likes2;
        const rel_likes2 = likes2 - likes1;

        return res.json({
          stockData: [
            { stock: stockSymbol1, price: price1, rel_likes: rel_likes1 },
            { stock: stockSymbol2, price: price2, rel_likes: rel_likes2 }
          ]
        });
      }
      
      return res.json({ error: "Petición no válida" });
    });
};
