import "hardhat/types/config";

import { KMSSigner } from "./provider";

declare module "hardhat/types/config" {
  export interface HttpNetworkUserConfig {
    kmsKeyId?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
  export interface HardhatNetworkUserConfig {
    kmsKeyId?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
  export interface HttpNetworkConfig {
    kms?: KMSSigner;
    kmsKeyId?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
  export interface HardhatNetworkConfig {
    kms?: KMSSigner;
    kmsKeyId?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
}
