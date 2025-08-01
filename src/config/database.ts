import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env['MONGODB_URI'];
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI não está definida no arquivo .env');
    }

    await mongoose.connect(mongoURI);
    
    // Configurar debug apenas em desenvolvimento
    mongoose.set('debug', process.env['NODE_ENV'] === 'development');
    
    console.log('✅ Conectado ao MongoDB Atlas');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}; 