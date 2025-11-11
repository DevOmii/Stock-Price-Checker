'use strict';

const mongoose = require('mongoose');
const fetch = require('node-fetch');
const crypto = require('crypto');

// Conexión a Mongoose
const dbUrl = process.env.DB; 
mongoose.connect(dbUrl)
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
  ips: [String] // Almacena los hashes de IP para prevenir doble like
});

const StockModel = mongoose.model('Stock', stockSchema);

/**
 * Obtiene el precio más reciente de la acción desde el proxy de freeCodeCamp.
 */
async function getStockPrice(stockSymbol) {
  try {
    // Usamos el proxy oficial para obtener datos de acciones
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stockSymbol}/quote`;
    const response = await fetch(url);
    const responseText = await response.text();

    if (responseText.includes('Not found') || responseText.includes('Unknown symbol')) {
      return null;
    }
    
    const data = JSON.parse(responseText);
    return data.latestPrice;

  } catch (error) {
    console.error('Error al obtener el precio de la acción:', error);
    return null;
  }
}

/**
 * Gestiona los likes de una acción, asegurando que solo se permita 1 like por IP.
 */
async function getStockLikes(stockSymbol, addLike, anonIp) {
  // Verificamos si la conexión está lista. Si no, esperamos brevemente (esto es para el entorno de prueba)
  if (mongoose.connection.readyState !== 1) {
     await new Promise(resolve => setTimeout(resolve, 100));
  }

  let stockDoc;
  const upperStock = stockSymbol.toUpperCase();

  if (addLike) {
    stockDoc = await StockModel.findOne({ stock: upperStock });

    if (!stockDoc) {
      // Si la acción no existe, la creamos y añadimos el like
      stockDoc = new StockModel({
        stock: upperStock,
        likes: 1,
        ips: [anonIp]
      });
      await stockDoc.save();
    }
    else if (!stockDoc.ips.includes(anonIp)) {
      // Si la acción existe y la IP es nueva, aumentamos el like
      stockDoc.likes++;
      stockDoc.ips.push(anonIp);
      await stockDoc.save();
    }
    // Si ya existe y la IP ya votó, no hacemos nada (no double like)
    
  } else {
    // Si no se pide like, solo obtenemos el documento
    stockDoc = await StockModel.findOne({ stock: upperStock });
  }

  return stockDoc ? stockDoc.likes : 0;
}

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      const { stock, like } = req.query;
      // Convertimos el string 'true' a booleano
      const addLike = like === 'true'; 
      // Hasheamos la IP para anonimizarla
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

        // Obtenemos precios y likes en paralelo para mayor velocidad
        const [price1, price2, likes1, likes2] = await Promise.all([
          getStockPrice(stockSymbol1),
          getStockPrice(stockSymbol2),
          getStockLikes(stockSymbol1, addLike, anonIp),
          getStockLikes(stockSymbol2, addLike, anonIp)
        ]);

        if (!price1 || !price2) {
          return res.json({ error: "Uno de los stocks no es válido" });
        }

        // Calculamos los likes relativos
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
