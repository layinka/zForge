import { Request, Response } from 'express';
import { AppDataSource } from '../database';
import { PTYTToken, TokenType } from '../entities/PTYTToken';
import { SYToken } from '../entities/SYToken';

export class PTYTController {
  private ptytTokenRepository = AppDataSource.getRepository(PTYTToken);
  private syTokenRepository = AppDataSource.getRepository(SYToken);

  // Get PT/YT info for a specific SY token
  async getPTYTInfo(req: Request, res: Response) {
    try {
      const { syTokenAddress } = req.params;
      
      const syToken = await this.syTokenRepository.findOne({
        where: { address: syTokenAddress.toLowerCase() },
        relations: ['ptytTokens']
      });

      if (!syToken) {
        return res.status(404).json({
          success: false,
          message: 'SY token not found'
        });
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeToMaturity = Math.max(0, Number(syToken.maturity) - currentTime);
      const hasMatured = Number(syToken.maturity) <= currentTime;

      // Calculate claimable yield (simplified calculation)
      const estimatedYieldRate = syToken.yieldRate / 100; // Convert from percentage
      const timeElapsed = Math.min(currentTime - Math.floor(new Date(syToken.createdAt).getTime() / 1000), Number(syToken.maturity) - Math.floor(new Date(syToken.createdAt).getTime() / 1000));
      const annualizedYield = estimatedYieldRate * (timeElapsed / (365 * 24 * 60 * 60));
      const claimableYield = syToken.totalSupply * annualizedYield;

      const ptToken = syToken.ptytTokens.find(token => token.type === TokenType.PT);
      const ytToken = syToken.ptytTokens.find(token => token.type === TokenType.YT);

      const response = {
        syToken: {
          address: syToken.address,
          name: syToken.name,
          symbol: syToken.symbol,
          maturity: syToken.maturity,
          hasMatured,
          timeToMaturity,
          yieldRate: syToken.yieldRate,
          totalSupply: syToken.totalSupply,
          totalYieldAccrued: syToken.totalYieldAccrued
        },
        ptToken: ptToken ? {
          address: ptToken.address,
          name: ptToken.name,
          symbol: ptToken.symbol,
          totalSupply: ptToken.totalSupply,
          isRedeemable: hasMatured
        } : null,
        ytToken: ytToken ? {
          address: ytToken.address,
          name: ytToken.name,
          symbol: ytToken.symbol,
          totalSupply: ytToken.totalSupply,
          claimableYield: hasMatured ? 0 : claimableYield,
          isExpired: hasMatured
        } : null,
        underlying: {
          address: syToken.underlyingTokenAddress,
          name: syToken.underlyingTokenName,
          symbol: syToken.underlyingTokenSymbol
        }
      };

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('Error fetching PT/YT info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch PT/YT info',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get all PT tokens
  async getAllPTTokens(req: Request, res: Response) {
    try {
      const ptTokens = await this.ptytTokenRepository.find({
        where: { type: TokenType.PT },
        relations: ['syToken'],
        order: { createdAt: 'DESC' }
      });

      const tokensWithInfo = ptTokens.map(token => {
        const currentTime = Math.floor(Date.now() / 1000);
        const hasMatured = Number(token.syToken.maturity) <= currentTime;
        
        return {
          ...token,
          isRedeemable: hasMatured,
          timeToMaturity: Math.max(0, Number(token.syToken.maturity) - currentTime),
          underlyingToken: {
            address: token.syToken.underlyingTokenAddress,
            name: token.syToken.underlyingTokenName,
            symbol: token.syToken.underlyingTokenSymbol
          }
        };
      });

      res.json({
        success: true,
        data: tokensWithInfo,
        count: tokensWithInfo.length
      });
    } catch (error) {
      console.error('Error fetching PT tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch PT tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get all YT tokens
  async getAllYTTokens(req: Request, res: Response) {
    try {
      const ytTokens = await this.ptytTokenRepository.find({
        where: { type: TokenType.YT },
        relations: ['syToken'],
        order: { createdAt: 'DESC' }
      });

      const tokensWithInfo = ytTokens.map(token => {
        const currentTime = Math.floor(Date.now() / 1000);
        const hasExpired = Number(token.syToken.maturity) <= currentTime;
        
        // Calculate estimated claimable yield
        const estimatedYieldRate = token.syToken.yieldRate / 100;
        const timeElapsed = Math.min(currentTime - Math.floor(new Date(token.syToken.createdAt).getTime() / 1000), Number(token.syToken.maturity) - Math.floor(new Date(token.syToken.createdAt).getTime() / 1000));
        const annualizedYield = estimatedYieldRate * (timeElapsed / (365 * 24 * 60 * 60));
        const claimableYield = hasExpired ? 0 : token.totalSupply * annualizedYield;
        
        return {
          ...token,
          isExpired: hasExpired,
          timeToExpiry: Math.max(0, Number(token.syToken.maturity) - currentTime),
          claimableYield,
          underlyingToken: {
            address: token.syToken.underlyingTokenAddress,
            name: token.syToken.underlyingTokenName,
            symbol: token.syToken.underlyingTokenSymbol
          }
        };
      });

      res.json({
        success: true,
        data: tokensWithInfo,
        count: tokensWithInfo.length
      });
    } catch (error) {
      console.error('Error fetching YT tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch YT tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get redeemable PT tokens (matured)
  async getRedeemablePTTokens(req: Request, res: Response) {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      
      const redeemablePTTokens = await this.ptytTokenRepository
        .createQueryBuilder('ptytToken')
        .leftJoinAndSelect('ptytToken.syToken', 'syToken')
        .where('ptytToken.type = :type', { type: TokenType.PT })
        .andWhere('syToken.maturity <= :currentTime', { currentTime })
        .orderBy('syToken.maturity', 'ASC')
        .getMany();

      const tokensWithInfo = redeemablePTTokens.map(token => ({
        ...token,
        isRedeemable: true,
        maturedAt: Number(token.syToken.maturity),
        underlyingToken: {
          address: token.syToken.underlyingTokenAddress,
          name: token.syToken.underlyingTokenName,
          symbol: token.syToken.underlyingTokenSymbol
        }
      }));

      res.json({
        success: true,
        data: tokensWithInfo,
        count: tokensWithInfo.length
      });
    } catch (error) {
      console.error('Error fetching redeemable PT tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch redeemable PT tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get active YT tokens (not expired)
  async getActiveYTTokens(req: Request, res: Response) {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      
      const activeYTTokens = await this.ptytTokenRepository
        .createQueryBuilder('ptytToken')
        .leftJoinAndSelect('ptytToken.syToken', 'syToken')
        .where('ptytToken.type = :type', { type: TokenType.YT })
        .andWhere('syToken.maturity > :currentTime', { currentTime })
        .orderBy('syToken.maturity', 'ASC')
        .getMany();

      const tokensWithInfo = activeYTTokens.map(token => {
        // Calculate estimated claimable yield
        const estimatedYieldRate = token.syToken.yieldRate / 100;
        const timeElapsed = currentTime - Math.floor(new Date(token.syToken.createdAt).getTime() / 1000);
        const annualizedYield = estimatedYieldRate * (timeElapsed / (365 * 24 * 60 * 60));
        const claimableYield = token.totalSupply * annualizedYield;
        
        return {
          ...token,
          isExpired: false,
          timeToExpiry: Number(token.syToken.maturity) - currentTime,
          claimableYield,
          underlyingToken: {
            address: token.syToken.underlyingTokenAddress,
            name: token.syToken.underlyingTokenName,
            symbol: token.syToken.underlyingTokenSymbol
          }
        };
      });

      res.json({
        success: true,
        data: tokensWithInfo,
        count: tokensWithInfo.length
      });
    } catch (error) {
      console.error('Error fetching active YT tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active YT tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update PT/YT token supply
  async updateTokenSupply(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const { totalSupply } = req.body;

      const token = await this.ptytTokenRepository.findOne({
        where: { address: address.toLowerCase() }
      });

      if (!token) {
        return res.status(404).json({
          success: false,
          message: 'Token not found'
        });
      }

      token.totalSupply = totalSupply;
      const updatedToken = await this.ptytTokenRepository.save(token);

      res.json({
        success: true,
        data: updatedToken,
        message: 'Token supply updated successfully'
      });
    } catch (error) {
      console.error('Error updating token supply:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update token supply',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
