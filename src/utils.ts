import { ethers } from 'ethers';

export const formatWei = (amount: string): string => {
  return ethers.utils.formatEther(amount);
};

export const parseWei = (amount: string): string => {
  return ethers.utils.parseEther(amount).toString();
};

export const isValidAddress = (address: string): boolean => {
  return ethers.utils.isAddress(address);
};

export const getBaseChainId = (): number => {
  return 8453; // Base Mainnet Chain ID
};

export const getBaseTestnetChainId = (): number => {
  return 84531; // Base Goerli Testnet Chain ID
};