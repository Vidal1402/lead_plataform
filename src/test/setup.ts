import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente de teste
dotenv.config({ path: '.env.test' });

// Configurar timeout para testes
jest.setTimeout(30000);

// Setup global para testes
beforeAll(async () => {
  // Conectar ao banco de teste
  const mongoTestUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/leadforge_test';
  await mongoose.connect(mongoTestUri);
});

// Cleanup após cada teste
afterEach(async () => {
  // Limpar todas as coleções
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Cleanup após todos os testes
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
}); 