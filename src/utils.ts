import { formatEther, parseEther, isAddress } from 'ethers';

export const formatWei = (amount: string): string => {
  return formatEther(amount);
};

export const parseWei = (amount: string): string => {
  return parseEther(amount).toString();
};

export const isValidAddress = (address: string): boolean => {
  return isAddress(address);
};

export const getBaseChainId = (): number => {
  return 8453;
};

export const getBaseTestnetChainId = (): number => {
  return 84531;
};
