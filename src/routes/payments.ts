import express from 'express';
import { 
  createCheckout, 
  webhookPayment, 
  getPaymentHistory, 
  getPackages 
} from '../controllers/paymentController';
import { protect } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/payments/checkout
// @desc    Criar checkout com Stripe
// @access  Private
router.post('/checkout', protect, createCheckout);

// @route   POST /api/payments/webhook
// @desc    Webhook do Stripe para processar pagamentos
// @access  Public
router.post('/webhook', webhookPayment);

// @route   GET /api/payments/history
// @desc    Obter histórico de pagamentos
// @access  Private
router.get('/history', protect, getPaymentHistory);

// @route   GET /api/payments/packages
// @desc    Obter pacotes disponíveis
// @access  Public
router.get('/packages', getPackages);

export default router; 