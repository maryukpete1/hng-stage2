const { Sequelize } = require('sequelize');
require('dotenv').config();

// 1. Create a new Sequelize instance
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql', // We are using MySQL
  logging: false, // Set to true to see all SQL queries
});

// 2. Export the instance
module.exports = sequelize;