export const createSerializedRunner = (
  run: () => Promise<void>,
): (() => Promise<boolean>) => {
  let isRunning = false;

  return async () => {
    if (isRunning) {
      return false;
    }

    isRunning = true;
    try {
      await run();
      return true;
    } finally {
      isRunning = false;
    }
  };
};
