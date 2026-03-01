import { ethers } from 'ethers';
import { BaseChainConfig, Transaction, L2BridgeConfig } from './types';

export class BaseChain {
  private provider: ethers.providers.JsonRpcProvider;
  private config: BaseChainConfig;

  constructor(config: BaseChainConfig) {
    this.config = config;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  }

  async getL2Status(): Promise<boolean> {
    try {
      await this.provider.getNetwork();
      return true;
    } catch (error) {
      return false;
    }
  }

  async sendTransaction(tx: Transaction): Promise<ethers.providers.TransactionResponse> {
    const signer = this.provider.getSigner(tx.from);
    return await signer.sendTransaction(tx);
  }

  async bridgeToL2(bridgeConfig: L2BridgeConfig, amount: string): Promise<ethers.providers.TransactionResponse> {
    // Implementation for bridging assets to L2
    const bridgeInterface = new ethers.utils.Interface([
      'function depositERC20(address l1Token, address l2Token, uint256 amount)'
    ]);

    const data = bridgeInterface.encodeFunctionData('depositERC20', [
      bridgeConfig.tokenAddress,
      bridgeConfig.l2BridgeAddress,
      amount
    ]);

    const tx: Transaction = {
      to: bridgeConfig.l1BridgeAddress,
      from: await this.provider.getSigner().getAddress(),
      value: '0',
      data
    };

    return this.sendTransaction(tx);
  }
}