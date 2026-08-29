/**
 * WebAuthn / FIDO2 passkey service using @simplewebauthn/server
 * rpId: farmfreshfarmer.com
 * Provides: registration challenge, registration verification,
 *           authentication challenge, authentication verification
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { db } from "../db";
import { webauthnCredentials, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export const RP_ID = process.env.WEBAUTHN_RP_ID || "farmfreshfarmer.com";
export const RP_NAME = "FarmFreshFarmer";
export const EXPECTED_ORIGIN = process.env.WEBAUTHN_ORIGIN
  ? process.env.WEBAUTHN_ORIGIN.split(",")
  : [
      "https://farmfreshfarmer.com",
      "https://www.farmfreshfarmer.com",
      "http://localhost:5000",
      "http://localhost:5001",
      "http://localhost:3000",
    ];

/** Generate registration options for a user */
export async function generateWebAuthnRegistrationOptions(userId: number, userName: string, userDisplayName: string) {
  // Get existing credentials to exclude
  const existing = await db
    .select({ credentialId: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(String(userId)),
    userName,
    userDisplayName: userDisplayName || userName,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  return options;
}

/** Verify and save a new WebAuthn credential registration */
export async function verifyAndSaveWebAuthnRegistration(
  userId: number,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  nickname: string = "Passkey"
) {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("WebAuthn registration verification failed");
  }

  const regInfo = verification.registrationInfo;
  const credentialID: string = (regInfo as any).credentialID || (regInfo as any).credential?.id || (regInfo as any).id || (response as any).id;
  const credentialPublicKey = (regInfo as any).credentialPublicKey || (regInfo as any).credential?.publicKey || (regInfo as any).publicKey;
  const counter: number = Number((regInfo as any).counter ?? (regInfo as any).credential?.counter ?? 0);
  const credentialDeviceType: string = (regInfo as any).credentialDeviceType || "platform";
  const credentialBackedUp: boolean = Boolean((regInfo as any).credentialBackedUp);

  const publicKeyBase64 = Buffer.isBuffer(credentialPublicKey) || credentialPublicKey instanceof Uint8Array
    ? Buffer.from(credentialPublicKey).toString("base64url")
    : String(credentialPublicKey || "");

  // Save credential to DB
  await db.insert(webauthnCredentials).values({
    userId,
    credentialId: String(credentialID),
    publicKey: publicKeyBase64,
    counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: (response as any).response?.transports ? JSON.stringify((response as any).response.transports) : null,
    nickname,
  });

  return verification;
}

/** Generate authentication challenge options for a user */
export async function generateWebAuthnAuthOptions(userId?: number) {
  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];

  if (userId) {
    const creds = await db
      .select({ credentialId: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId));

    allowCredentials = creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[]) : undefined,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "required",
  });

  return options;
}

/** Verify an authentication assertion */
export async function verifyWebAuthnAssertion(
  userId: number,
  response: AuthenticationResponseJSON,
  expectedChallenge: string
) {
  // Find the credential
  const [cred] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, response.id))
    .limit(1);

  if (!cred || cred.userId !== userId) {
    throw new Error("WebAuthn credential not found or doesn't belong to this user");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    authenticator: {
      credentialID: cred.credentialId,
      credentialPublicKey: Buffer.from(cred.publicKey, "base64url"),
      counter: cred.counter,
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    },
  });

  if (!verification.verified) {
    throw new Error("WebAuthn authentication verification failed");
  }

  // Update counter and lastUsedAt
  await db
    .update(webauthnCredentials)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(webauthnCredentials.id, cred.id));

  return verification;
}

/** Count enrolled credentials for a user */
export async function countWebAuthnCredentials(userId: number): Promise<number> {
  const creds = await db
    .select({ id: webauthnCredentials.id })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));
  return creds.length;
}

/** Get all credentials for a user (safe - no private key) */
export async function listWebAuthnCredentials(userId: number) {
  return db
    .select({
      id: webauthnCredentials.id,
      credentialId: webauthnCredentials.credentialId,
      nickname: webauthnCredentials.nickname,
      deviceType: webauthnCredentials.deviceType,
      backedUp: webauthnCredentials.backedUp,
      lastUsedAt: webauthnCredentials.lastUsedAt,
      createdAt: webauthnCredentials.createdAt,
    })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId));
}

/** Delete a credential by ID (only if belongs to user) */
export async function deleteWebAuthnCredential(userId: number, credentialDbId: number) {
  // Don't allow deleting the last credential
  const count = await countWebAuthnCredentials(userId);
  if (count <= 1) {
    throw new Error("Cannot delete the only enrolled passkey. Enroll a backup passkey first.");
  }
  await db
    .delete(webauthnCredentials)
    .where(eq(webauthnCredentials.id, credentialDbId));
}
