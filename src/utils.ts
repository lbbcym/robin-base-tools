import { formatEther, isAddress, parseEther } from 'ethers';

export const formatWei = (amount: string): string => formatEther(amount);

export const parseWei = (amount: string): string => parseEther(amount).toString();

export const isValidAddress = (address: string): boolean => isAddress(address);

export const getBaseChainId = (): number => 8453;

export const getBaseTestnetChainId = (): number => 84531;
