import * as asn1 from "asn1.js";
import BN from "bn.js";

interface EcdsaPubKeyOutput {
  algo: {
    a: number[]
    b: number[]
  }
  pubKey: {
    unused: number
    data: Buffer
  }
}

export function toHexString(
  value: BN | Buffer | undefined
): string | undefined {
  if (value === undefined) {
    return;
  }
  return `0x${value.toString("hex")}`;
}

export const EcdsaPubKey: asn1.AsnObject<EcdsaPubKeyOutput> = asn1.define('EcdsaPubKey', function (this: any) {
  this.seq().obj(
    this.key('algo').seq().obj(this.key('a').objid(), this.key('b').objid()),
    this.key('pubKey').bitstr()
  );
});
