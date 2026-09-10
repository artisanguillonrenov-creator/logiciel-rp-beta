let finTransaction: Promise<void> = Promise.resolve();

/** Section critique FIFO commune à toutes les transactions du cache embeddings. */
export function planifierTransactionCache<T>(operation: () => Promise<T>): Promise<T> {
  const execution = finTransaction.then(operation, operation);
  finTransaction = execution.then(() => undefined, () => undefined);
  return execution;
}
