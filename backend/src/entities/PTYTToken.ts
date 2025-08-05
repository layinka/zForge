import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SYToken } from './SYToken';

export enum TokenType {
  PT = 'PT',
  YT = 'YT'
}

@Entity()
export class PTYTToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  address: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column({
    type: 'simple-enum',
    enum: TokenType
  })
  type: TokenType;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalSupply: number;

  @Column()
  syTokenId: number;

  @ManyToOne(() => SYToken, syToken => syToken.ptytTokens)
  @JoinColumn({ name: 'syTokenId' })
  syToken: SYToken;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
