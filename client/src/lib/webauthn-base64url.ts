// WebAuthn <-> JSON helpers for the customer portal's Face ID / Touch ID flow.
// The server speaks base64url JSON; the browser API wants ArrayBuffers. Hand-rolled
// so no extra dependency is needed. Pure functions only.

export function bytesToBase64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface DescriptorJSON {
  id: string;
  type: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
}

export interface CreationOptionsJSON {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: DescriptorJSON[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
}

export interface RequestOptionsJSON {
  challenge: string;
  rpId?: string;
  timeout?: number;
  allowCredentials?: DescriptorJSON[];
  userVerification?: UserVerificationRequirement;
}

function toDescriptor(d: DescriptorJSON): PublicKeyCredentialDescriptor {
  return { id: base64urlToBytes(d.id), type: d.type, transports: d.transports };
}

export function toCreationOptions(json: CreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    challenge: base64urlToBytes(json.challenge),
    rp: json.rp,
    user: { id: base64urlToBytes(json.user.id), name: json.user.name, displayName: json.user.displayName },
    pubKeyCredParams: json.pubKeyCredParams,
    timeout: json.timeout,
    excludeCredentials: json.excludeCredentials?.map(toDescriptor),
    authenticatorSelection: json.authenticatorSelection,
    attestation: json.attestation,
  };
}

export function toRequestOptions(json: RequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return {
    challenge: base64urlToBytes(json.challenge),
    rpId: json.rpId,
    timeout: json.timeout,
    allowCredentials: json.allowCredentials?.map(toDescriptor),
    userVerification: json.userVerification,
  };
}

export function registrationToJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: "public-key" as const,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      attestationObject: bytesToBase64url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  };
}

export function authenticationToJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: "public-key" as const,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      authenticatorData: bytesToBase64url(response.authenticatorData),
      signature: bytesToBase64url(response.signature),
      ...(response.userHandle ? { userHandle: bytesToBase64url(response.userHandle) } : {}),
    },
  };
}
