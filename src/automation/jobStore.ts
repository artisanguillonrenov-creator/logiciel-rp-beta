import { stockageEvolutif } from '../storage/stockageEvolutif';
import { createAutomationJobRepository } from './jobRepositoryCore';

export const automationJobs = createAutomationJobRepository(stockageEvolutif);
