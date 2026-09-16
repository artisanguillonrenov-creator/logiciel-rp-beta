import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAutomationJobRepository } from './jobRepositoryCore';

export const automationJobs = createAutomationJobRepository(AsyncStorage);
