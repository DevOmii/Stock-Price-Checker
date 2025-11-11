'use strict';

const mongoose = require('mongoose');
const fetch = require('node-fetch');
const crypto = require('crypto');

// Conexión a Mongoose
// La conexión ahora maneja promesas, imprimiendo el estado de la conexión.
mongoose.connect(process.env.DB)
  .then(() => {
    console.log('MongoDB Conectado.');
  })
  .catch(err => {
    console.error('Error de conexión a MongoDB:', err);
  });

// Definición del esquema y modelo
const stockSchema = new mongoose.Schema({
  stock: { type: String, required: true },
  likes: { type: Number, default: 0 },
  ips: [String]
});

const StockModel = mongoose.model('Stock', stockSchema);

/**
 * Obtiene el precio más reciente de la acción desde el proxy de freeCodeCamp.
 * @param {string} stockSymbol - Símbolo de la acción (e.g., 'GOOG').
 * @returns {Promise<number|null>} El precio de la acción o null si no se encuentra.
 */
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
    // Manejo de errores de fetch
    return null;
  }
}

/**
 * Gestiona los likes de una acción, asegurando que solo se cuenta 1 like por IP anónima.
 * @param {string} stockSymbol - Símbolo de la acción.
 * @param {boolean} addLike - Indica si se debe intentar añadir un like.
 * @param {string} anonIp - IP anónima (hash SHA256) del usuario.
 * @returns {Promise<number>} El número total de likes de la acción.
 */
async function getStockLikes(stockSymbol, addLike, anonIp) {
  // Espera a que la conexión esté abierta para evitar errores de timeout
  if (mongoose.connection.readyState === 0) {
    console.warn('Mongoose not connected, waiting for connection...');
    await new Promise(resolve => mongoose.connection.on('connected', resolve));
  }
  
  let stockDoc;

  if (addLike) {
    stockDoc = await StockModel.findOne({ stock: stockSymbol });

    if (!stockDoc) {
      // Si la acción no existe, la crea con 1 like
      stockDoc = new StockModel({
        stock: stockSymbol,
        likes: 1,
        ips: [anonIp]
      });
      await stockDoc.save();
    }
    else if (!stockDoc.ips.includes(anonIp)) {
      // Si la acción existe y la IP no ha dado like, incrementa el like
      stockDoc.likes++;
      stockDoc.ips.push(anonIp);
      await stockDoc.save();
    }
    // Si la acción existe y la IP ya dio like, no hace nada (no doble like)
    
  } else {
    // Si solo se consulta, busca el documento
    stockDoc = await StockModel.findOne({ stock: stockSymbol });
  }

  return stockDoc ? stockDoc.likes : 0;
}

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const { stock, like } = req.query;
      const addLike = like === 'true';
      // Hash de la IP para anonimizarla, usado para el conteo de likes
      const anonIp = crypto.createHash('sha256').update(req.ip).digest('hex');

      // CASO 1: Una sola acción
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

      // CASO 2: Dos acciones
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

        // Cálculo de likes relativos (diferencia de likes)
        const rel_likes1 = likes1 - likes2;
        const rel_likes2 = likes2 - likes1;

        return res.json({
          stockData: [
            { stock: stockSymbol1, price: price1, rel_likes: rel_likes1 },
            { stock: stockSymbol2, price: price2, rel_likes: rel_likes2 }
          ]
        });
      }
      
      // CASO 3: Petición no válida
      return res.json({ error: "Petición no válida" });
    });
};
