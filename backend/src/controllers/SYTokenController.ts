import { Request, Response } from 'express';
import { AppDataSource } from '../database';
import { SYToken } from '../entities/SYToken';
import { PTYTToken } from '../entities/PTYTToken';

export class SYTokenController {
  private syTokenRepository = AppDataSource.getRepository(SYToken);
  private ptytTokenRepository = AppDataSource.getRepository(PTYTToken);

  // Get all SY tokens
  async getAllSYTokens(req: Request, res: Response) {
    try {
      const syTokens = await this.syTokenRepository.find({
        relations: ['ptytTokens'],
        order: { createdAt: 'DESC' }
      });

      const tokensWithInfo = syTokens.map(token => ({
        ...token,
        timeToMaturity: Math.max(0, Number(token.maturity) - Math.floor(Date.now() / 1000)),
        isExpired: Number(token.maturity) <= Math.floor(Date.now() / 1000)
      }));

      res.json({
        success: true,
        data: tokensWithInfo,
        count: tokensWithInfo.length
      });
    } catch (error) {
      console.error('Error fetching SY tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SY tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get SY token by address
  async getSYTokenByAddress(req: Request, res: Response) {
    try {
      const { address } = req.params;
      
      const syToken = await this.syTokenRepository.findOne({
        where: { address: address.toLowerCase() },
        relations: ['ptytTokens']
      });

      if (!syToken) {
        return res.status(404).json({
          success: false,
          message: 'SY token not found'
        });
      }

      const tokenWithInfo = {
        ...syToken,
        timeToMaturity: Math.max(0, Number(syToken.maturity) - Math.floor(Date.now() / 1000)),
        isExpired: Number(syToken.maturity) <= Math.floor(Date.now() / 1000)
      };

      res.json({
        success: true,
        data: tokenWithInfo
      });
    } catch (error) {
      console.error('Error fetching SY token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SY token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Create new SY token (called when new token is deployed)
  async createSYToken(req: Request, res: Response) {
    try {
      const {
        address,
        name,
        symbol,
        underlyingTokenAddress,
        underlyingTokenName,
        underlyingTokenSymbol,
        yieldRate,
        maturity,
        ptTokenAddress,
        ytTokenAddress
      } = req.body;

      // Check if token already exists
      const existingToken = await this.syTokenRepository.findOne({
        where: { address: address.toLowerCase() }
      });

      if (existingToken) {
        return res.status(400).json({
          success: false,
          message: 'SY token already exists'
        });
      }

      // Create SY token
      const syToken = this.syTokenRepository.create({
        address: address.toLowerCase(),
        name,
        symbol,
        underlyingTokenAddress: underlyingTokenAddress.toLowerCase(),
        underlyingTokenName,
        underlyingTokenSymbol,
        yieldRate,
        maturity,
        ptTokenAddress: ptTokenAddress.toLowerCase(),
        ytTokenAddress: ytTokenAddress.toLowerCase()
      });

      const savedSYToken = await this.syTokenRepository.save(syToken);

      // Create PT and YT token records
      const ptToken = this.ptytTokenRepository.create({
        address: ptTokenAddress.toLowerCase(),
        name: `PT-${underlyingTokenName}`,
        symbol: `PT-${underlyingTokenSymbol}`,
        type: 'PT' as any,
        syTokenId: savedSYToken.id
      });

      const ytToken = this.ptytTokenRepository.create({
        address: ytTokenAddress.toLowerCase(),
        name: `YT-${underlyingTokenName}`,
        symbol: `YT-${underlyingTokenSymbol}`,
        type: 'YT' as any,
        syTokenId: savedSYToken.id
      });

      await this.ptytTokenRepository.save([ptToken, ytToken]);

      res.status(201).json({
        success: true,
        data: savedSYToken,
        message: 'SY token created successfully'
      });
    } catch (error) {
      console.error('Error creating SY token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create SY token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update SY token info (e.g., total supply, yield accrued)
  async updateSYToken(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const updates = req.body;

      const syToken = await this.syTokenRepository.findOne({
        where: { address: address.toLowerCase() }
      });

      if (!syToken) {
        return res.status(404).json({
          success: false,
          message: 'SY token not found'
        });
      }

      // Update allowed fields
      if (updates.totalSupply !== undefined) syToken.totalSupply = updates.totalSupply;
      if (updates.totalYieldAccrued !== undefined) syToken.totalYieldAccrued = updates.totalYieldAccrued;
      if (updates.hasMatured !== undefined) syToken.hasMatured = updates.hasMatured;

      const updatedToken = await this.syTokenRepository.save(syToken);

      res.json({
        success: true,
        data: updatedToken,
        message: 'SY token updated successfully'
      });
    } catch (error) {
      console.error('Error updating SY token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update SY token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get tokens by underlying asset
  async getTokensByUnderlying(req: Request, res: Response) {
    try {
      const { underlyingAddress } = req.params;
      
      const syTokens = await this.syTokenRepository.find({
        where: { underlyingTokenAddress: underlyingAddress.toLowerCase() },
        relations: ['ptytTokens'],
        order: { createdAt: 'DESC' }
      });

      res.json({
        success: true,
        data: syTokens,
        count: syTokens.length
      });
    } catch (error) {
      console.error('Error fetching tokens by underlying:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get expiring tokens (within next 7 days)
  async getExpiringTokens(req: Request, res: Response) {
    try {
      const sevenDaysFromNow = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
      
      const expiringTokens = await this.syTokenRepository
        .createQueryBuilder('syToken')
        .where('syToken.maturity <= :sevenDaysFromNow', { sevenDaysFromNow })
        .andWhere('syToken.maturity > :now', { now: Math.floor(Date.now() / 1000) })
        .leftJoinAndSelect('syToken.ptytTokens', 'ptytTokens')
        .orderBy('syToken.maturity', 'ASC')
        .getMany();

      res.json({
        success: true,
        data: expiringTokens,
        count: expiringTokens.length
      });
    } catch (error) {
      console.error('Error fetching expiring tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expiring tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
