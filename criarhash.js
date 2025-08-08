const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('senha123', 10);
console.log('Hash gerado:', hash);