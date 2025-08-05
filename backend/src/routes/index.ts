import { Router } from 'express';
import { SYTokenController } from '../controllers/SYTokenController';
import { PTYTController } from '../controllers/PTYTController';

const router = Router();
const syTokenController = new SYTokenController();
const ptytController = new PTYTController();

// SY Token routes
router.get('/sy-tokens', syTokenController.getAllSYTokens.bind(syTokenController));
router.get('/sy-tokens/:address', syTokenController.getSYTokenByAddress.bind(syTokenController));
router.post('/sy-tokens', syTokenController.createSYToken.bind(syTokenController));
router.put('/sy-tokens/:address', syTokenController.updateSYToken.bind(syTokenController));
router.get('/sy-tokens/underlying/:underlyingAddress', syTokenController.getTokensByUnderlying.bind(syTokenController));
router.get('/sy-tokens/expiring/soon', syTokenController.getExpiringTokens.bind(syTokenController));

// PT/YT Token routes
router.get('/ptyt-info/:syTokenAddress', ptytController.getPTYTInfo.bind(ptytController));
router.get('/pt-tokens', ptytController.getAllPTTokens.bind(ptytController));
router.get('/yt-tokens', ptytController.getAllYTTokens.bind(ptytController));
router.get('/pt-tokens/redeemable', ptytController.getRedeemablePTTokens.bind(ptytController));
router.get('/yt-tokens/active', ptytController.getActiveYTTokens.bind(ptytController));
router.put('/tokens/:address/supply', ptytController.updateTokenSupply.bind(ptytController));

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'zPendle API is running',
    timestamp: new Date().toISOString()
  });
});

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'zPendle API',
    version: '1.0.0',
    description: 'Backend API for zPendle yield tokenization protocol',
    endpoints: {
      'GET /api/sy-tokens': 'Get all SY tokens',
      'GET /api/sy-tokens/:address': 'Get SY token by address',
      'POST /api/sy-tokens': 'Create new SY token',
      'PUT /api/sy-tokens/:address': 'Update SY token',
      'GET /api/sy-tokens/underlying/:underlyingAddress': 'Get SY tokens by underlying asset',
      'GET /api/sy-tokens/expiring/soon': 'Get expiring SY tokens',
      'GET /api/ptyt-info/:syTokenAddress': 'Get PT/YT info for SY token',
      'GET /api/pt-tokens': 'Get all PT tokens',
      'GET /api/yt-tokens': 'Get all YT tokens',
      'GET /api/pt-tokens/redeemable': 'Get redeemable PT tokens',
      'GET /api/yt-tokens/active': 'Get active YT tokens',
      'PUT /api/tokens/:address/supply': 'Update token supply',
      'GET /api/health': 'Health check'
    }
  });
});

export default router;
