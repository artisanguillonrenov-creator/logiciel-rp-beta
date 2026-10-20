import { automationJobs } from './jobStore';
import { createAutomationKernel } from './kernelCore';

export type {
  AutomationDiagnostics,
  AutomationHandler,
  AutomationHandlerContext,
  AutomationRunInfo,
} from './kernelCore';

const kernel = createAutomationKernel(automationJobs);

export const {
  registerAutomationHandler,
  setAutomationCapabilities,
  getAutomationDiagnostics,
  subscribeAutomationDiagnostics,
  initializeAutomationKernel,
  enqueueAutomation,
  removeAutomationJobsForStory,
  listAutomationJobs,
  processAutomationQueue,
  retryFailedAutomationJobs,
} = kernel;
