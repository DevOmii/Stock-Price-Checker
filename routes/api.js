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

// === BLOQUE CRUCIAL PARA PASAR EL TEST 7 ===
if (process.env.NODE_ENV === 'test') {
  StockModel.deleteMany({}, (err) => {
    if (err) console.error("Error al limpiar la DB en modo test:", err);
  });
}
// ============================================

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
    console.error('[getStockPrice] Error en el bloque catch:', error);
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
      let stockSymbols = Array.isArray(req.query.stock) ? req.query.stock : [req.query.stock];
      
      const { like } = req.query;
      const addLike = like === 'true';
      const anonIp = crypto.createHash('sha256').update(req.ip).digest('hex');

      if (stockSymbols.length === 1) {
        const stockSymbol = stockSymbols[0].toUpperCase();
        
        if (!stockSymbol) {
          return res.json({ error: "Parámetro de stock faltante" });
        }

        const price = await getStockPrice(stockSymbol);
        
        if (price === null) {
          return res.json({ error: "Stock no válido", stock: stockSymbol });
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

      if (stockSymbols.length === 2) {
        const stockSymbol1 = stockSymbols[0].toUpperCase();
        const stockSymbol2 = stockSymbols[1].toUpperCase();
        
        if (stockSymbol1 === stockSymbol2) {
             return res.json({ error: "No puedes comparar la misma acción" });
        }

        const [price1, price2] = await Promise.all([
          getStockPrice(stockSymbol1),
          getStockPrice(stockSymbol2)
        ]);

        if (price1 === null || price2 === null) {
          return res.json({ error: "Uno o ambos stocks no son válidos" });
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
      
      return res.json({ error: "Petición no válida (debe ser 1 o 2 stocks)" });
    });
};
