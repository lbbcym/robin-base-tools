export interface BaseChainConfig {
  rpcUrl: string;
  chainId: number;
  name?: string;
}

export interface Transaction {
  to: string;
  from: string;
  value: string;
  data?: string;
  nonce?: number;
}

export interface L2BridgeConfig {
  l1BridgeAddress: string;
  l2BridgeAddress: string;
  tokenAddress: string;
}