import mongoose, { Document, Schema } from 'mongoose';

export interface ILead extends Document {
  nome: string;
  email: string;
  telefone?: string;
  idade: number;
  cidade: string;
  estado: string;
  pais: string;
  nicho: string;
  origem: string;
  dataInsercao: Date;
  isActive: boolean;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  telefone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Telefone inválido']
  },
  idade: {
    type: Number,
    required: [true, 'Idade é obrigatória'],
    min: [18, 'Idade mínima é 18 anos'],
    max: [100, 'Idade máxima é 100 anos']
  },
  cidade: {
    type: String,
    required: [true, 'Cidade é obrigatória'],
    trim: true,
    maxlength: [50, 'Cidade não pode ter mais de 50 caracteres']
  },
  estado: {
    type: String,
    required: [true, 'Estado é obrigatório'],
    trim: true,
    maxlength: [2, 'Estado deve ter 2 caracteres']
  },
  pais: {
    type: String,
    required: [true, 'País é obrigatório'],
    default: 'Brasil',
    trim: true
  },
  nicho: {
    type: String,
    required: [true, 'Nicho é obrigatório'],
    trim: true,
    enum: {
      values: [
        'estetica', 'petshop', 'advocacia', 'medicina', 'educacao',
        'tecnologia', 'financas', 'imoveis', 'automoveis', 'beleza',
        'fitness', 'gastronomia', 'moda', 'turismo', 'outros'
      ],
      message: 'Nicho inválido'
    }
  },
  origem: {
    type: String,
    required: [true, 'Origem é obrigatória'],
    trim: true
  },
  dataInsercao: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  score: {
    type: Number,
    default: 60,
    min: [0, 'Score não pode ser negativo'],
    max: [100, 'Score não pode ser maior que 100']
  }
}, {
  timestamps: true
});

// Índices para performance
leadSchema.index({ email: 1 });
leadSchema.index({ nicho: 1 });
leadSchema.index({ cidade: 1 });
leadSchema.index({ estado: 1 });
leadSchema.index({ isActive: 1 });
leadSchema.index({ score: -1 });
leadSchema.index({ dataInsercao: -1 });

export const Lead = mongoose.model<ILead>('Lead', leadSchema); 