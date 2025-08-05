import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PTYTToken } from './PTYTToken';

@Entity()
export class SYToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  address: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  underlyingTokenAddress: string;

  @Column()
  underlyingTokenName: string;

  @Column()
  underlyingTokenSymbol: string;

  @Column('decimal', { precision: 10, scale: 2 })
  yieldRate: number;

  @Column('bigint')
  maturity: number;

  @Column({ default: false })
  hasMatured: boolean;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalSupply: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalYieldAccrued: number;

  @Column()
  ptTokenAddress: string;

  @Column()
  ytTokenAddress: string;

  @OneToMany(() => PTYTToken, ptytToken => ptytToken.syToken)
  ptytTokens: PTYTToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
