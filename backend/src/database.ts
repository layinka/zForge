import { DataSource } from 'typeorm';
import { SYToken } from './entities/SYToken';
import { PTYTToken } from './entities/PTYTToken';
import { UserTransaction } from './entities/UserTransaction';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  synchronize: true, // Set to false in production
  logging: process.env.NODE_ENV !== 'production',
  entities: [SYToken, PTYTToken, UserTransaction],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
});

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
};
