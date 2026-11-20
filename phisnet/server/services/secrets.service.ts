import { randomBytes } from "node:crypto";
import { pool } from "../db";
import {
  encryptSecret,
  decryptSecret,
  encryptedValue,
  queueSecretRotation,
} from "./versioned-secrets";
export class SecretsService {
  static generateOrgKey() {
    return randomBytes(32).toString("base64");
  }
  static encrypt(organizationId: number, plaintext: string) {
    return encryptSecret(organizationId, plaintext);
  }
  static decrypt(organizationId: number, ciphertext: string) {
    return decryptSecret(organizationId, ciphertext);
  }
  static isEncrypted(value: string) {
    return encryptedValue(value);
  }
  static rotateOrgKey(organizationId: number) {
    return queueSecretRotation(organizationId);
  }
  static async ensureOrgKey(organizationId: number) {
    const result = await pool.query(
      "UPDATE organizations SET encryption_key=COALESCE(encryption_key,$2) WHERE id=$1 RETURNING id",
      [organizationId, this.generateOrgKey()],
    );
    if (!result.rowCount) throw new Error("Organization not found");
  }
}
export default SecretsService;
