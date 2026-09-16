import { openDatabaseAsync } from 'expo-sqlite';
import { creerStockageSQLite } from './storyDatabaseSqlite';

export const stockageHistoires = creerStockageSQLite(() => openDatabaseAsync('elyndor-histoires.db'));
