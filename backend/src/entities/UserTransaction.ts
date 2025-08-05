import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum TransactionType {
  WRAP = 'WRAP',
  UNWRAP = 'UNWRAP',
  SPLIT = 'SPLIT',
  MERGE = 'MERGE',
  REDEEM_PT = 'REDEEM_PT',
  CLAIM_YT = 'CLAIM_YT'
}

@Entity()
export class UserTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userAddress: string;

  @Column()
  transactionHash: string;

  @Column({
    type: 'simple-enum',
    enum: TransactionType
  })
  type: TransactionType;

  @Column({ nullable: true })
  syTokenAddress?: string;

  @Column({ nullable: true })
  ptTokenAddress?: string;

  @Column({ nullable: true })
  ytTokenAddress?: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column('bigint')
  blockNumber: number;

  @Column('bigint')
  timestamp: number;

  @Column({ default: 'pending' })
  status: string; // pending, confirmed, failed

  @CreateDateColumn()
  createdAt: Date;
}
