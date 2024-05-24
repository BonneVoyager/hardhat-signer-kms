import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { computePublicKey } from "@ethersproject/signing-key";
import { createSignature, getEthAddressFromKMS } from "@rumblefishdev/eth-signer-kms";
import { BigNumber, utils } from "ethers";
import { hashPersonalMessage } from "ethereumjs-util";
import { rpcTransactionRequest } from "hardhat/internal/core/jsonrpc/types/input/transactionRequest";
import { validateParams } from "hardhat/internal/core/jsonrpc/types/input/validation";
import { ProviderWrapperWithChainId } from "hardhat/internal/core/providers/chainId";
import type { EIP1193Provider, RequestArguments } from "hardhat/types";

import { toHexString, EcdsaPubKey } from "./utils";

export class KMSSigner extends ProviderWrapperWithChainId {
  public kmsKeyId: string;
  public kmsInstance: KMSClient;
  public ethAddress?: string;
  public publicKey?: string;

  constructor(provider: EIP1193Provider, kmsKeyId: string) {
    super(provider);
    this.kmsKeyId = kmsKeyId;
    this.kmsInstance = new KMSClient();
  }

  public async request(args: RequestArguments): Promise<unknown> {
    const method = args.method;
    const params = this._getParams(args);
    const sender = await this._getSender();

    if (method === "eth_sendTransaction") {
      const [txRequest] = validateParams(params, rpcTransactionRequest);
      const tx = await utils.resolveProperties(txRequest);
      const nonce = tx.nonce ?? (await this._getNonce(sender));
      const baseTx: utils.UnsignedTransaction = {
        chainId: (await this._getChainId()) || undefined,
        data: tx.data,
        gasLimit: tx.gas,
        gasPrice: tx.gasPrice,
        nonce: Number(nonce),
        type: 2,
        to: toHexString(tx.to),
        value: tx.value,
        maxFeePerGas: tx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
      };

      if (
        baseTx.maxFeePerGas === undefined &&
        baseTx.maxPriorityFeePerGas === undefined
      ) {
        baseTx.type = 0;
        delete baseTx.maxFeePerGas;
        delete baseTx.maxPriorityFeePerGas;
      }

      const unsignedTx = utils.serializeTransaction(baseTx);
      const hash = utils.keccak256(utils.arrayify(unsignedTx));
      const sig = await createSignature({
        kmsInstance: this.kmsInstance,
        keyId: this.kmsKeyId,
        message: hash,
        address: sender,
      });

      const rawTx = utils.serializeTransaction(baseTx, sig);

      return this._wrappedProvider.request({
        method: "eth_sendRawTransaction",
        params: [rawTx],
      });
    } else if (args.method === "eth_accounts" || args.method === "eth_requestAccounts") {
      return [sender];
    } else if (args.method === "personal_sign") {
      const message = params[0];
      const messageBuffer = Buffer.from(message.slice(2), 'hex');
      const hash = hashPersonalMessage(messageBuffer).toString('hex');
      const sig = await createSignature({
        kmsInstance: this.kmsInstance,
        keyId: this.kmsKeyId,
        message: `0x${hash}`,
        address: sender,
      });
      return utils.joinSignature(sig);
    } else if (args.method === "eth_estimateGas") {
      return this._wrappedProvider.request({
        method: "eth_estimateGas",
        params: {
          ...args.params,
          from: sender,
        }
      });
    }

    return this._wrappedProvider.request(args);
  }

  public async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      const command = new GetPublicKeyCommand({ KeyId: this.kmsKeyId });
      const output = await this.kmsInstance.send(command);
      const publicKeyBuffer = Buffer.from(output.PublicKey as Uint8Array);
      const publicKeyDec = EcdsaPubKey.decode(publicKeyBuffer, 'der');
      this.publicKey = computePublicKey(publicKeyDec.pubKey.data);

      if (!this.ethAddress) {
        this.ethAddress = utils.computeAddress(publicKeyBuffer);
      }
    }
    return this.publicKey;
  }

  private async _getSender(): Promise<string> {
    if (!this.ethAddress) {
      this.ethAddress = await getEthAddressFromKMS({
        keyId: this.kmsKeyId,
        kmsInstance: this.kmsInstance,
      });
    }
    return this.ethAddress;
  }

  private async _getNonce(address: string): Promise<number> {
    const response = await this._wrappedProvider.request({
      method: "eth_getTransactionCount",
      params: [address, "pending"],
    });

    return BigNumber.from(response).toNumber();
  }
}
