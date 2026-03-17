import { JsonRpcProvider, Interface, TransactionResponse } from 'ethers';
import { BaseChainConfig, Transaction, L2BridgeConfig } from './types';

export class BaseChain {
  private provider: JsonRpcProvider;
  private config: BaseChainConfig;

  constructor(config: BaseChainConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl);
  }

  async getL2Status(): Promise<boolean> {
    try {
      await this.provider.getNetwork();
      return true;
    } catch {
      return false;
    }
  }

  async sendTransaction(tx: Transaction): Promise<TransactionResponse> {
    const signer = await this.provider.getSigner(tx.from);
    return signer.sendTransaction(tx);
  }

  async bridgeToL2(bridgeConfig: L2BridgeConfig, amount: string): Promise<TransactionResponse> {
    const bridgeInterface = new Interface([
      'function depositERC20(address l1Token, address l2Token, uint256 amount)',
    ]);

    const data = bridgeInterface.encodeFunctionData('depositERC20', [
      bridgeConfig.tokenAddress,
      bridgeConfig.l2BridgeAddress,
      amount,
    ]);

    const signer = await this.provider.getSigner();
    const from = await signer.getAddress();

    const tx: Transaction = {
      to: bridgeConfig.l1BridgeAddress,
      from,
      value: '0',
      data,
    };

    return this.sendTransaction(tx);
  }
}
