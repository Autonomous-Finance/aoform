import { deployProcesses } from '../deployProcesses.mjs';

export const applyCommand = async () => {
  try {
    await deployProcesses();
  } catch (err) {
    console.error('Error deploying processes:', err);
  }
};