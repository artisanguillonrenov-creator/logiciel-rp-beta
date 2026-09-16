import { useSyncExternalStore } from 'react';
import {
  getAutomationDiagnostics,
  subscribeAutomationDiagnostics,
} from './kernel';

export function useAutomationDiagnostics() {
  return useSyncExternalStore(
    subscribeAutomationDiagnostics,
    getAutomationDiagnostics,
    getAutomationDiagnostics,
  );
}
