require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const moviesRouter = require('./routes/movies');
const tmdbRouter = require('./routes/tmdb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/movies', moviesRouter);
app.use('/api/tmdb', tmdbRouter);

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`B&B Movies rodando em http://localhost:${PORT}`);
});
