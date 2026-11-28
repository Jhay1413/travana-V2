/**
 * Which Face ID control to show, as pure decisions (the screens only render the answer).
 *
 * A passkey is stored on the device and on the server. The device also keeps a small marker of which passkey it used
 * (`portal_credential_id` in localStorage). After the portal moved to its own address the marker is gone (it lived in the
 * old address's storage) although the passkey itself may have carried over, so the marker alone cannot decide.
 */

/** The quiet "Log in with Face ID" text button on the sign-in screen. */
export function showFaceIdOnLogin(input: { hasMarker: boolean; hasWebAuthn: boolean; platformAuthenticatorAvailable: boolean }): boolean {
  // A device that remembers a set-up keeps offering it (unchanged). One that does not still offers it, when the browser
  // says a built-in biometric exists, so a passkey that carried over can be used straight away.
  return input.hasMarker ? input.hasWebAuthn : input.platformAuthenticatorAvailable;
}

/** After a PIN sign-in: start a NEW Face ID registration only when the account has none (and the server could say). */
export function offerRegistrationAfterPin(input: { hasBiometric: boolean; biometricCheckFailed: boolean; credentialsApi: boolean }): boolean {
  // An account that already has a credential must not register again from this path: the device may hold it already, and
  // the server lists it in excludeCredentials, so a new registration would fail with InvalidStateError.
  return !input.hasBiometric && !input.biometricCheckFailed && input.credentialsApi;
}

export type FaceIdAffordance = "unavailable" | "on" | "use-here" | "set-up";

/** The Face ID row on the Account page. */
export function faceIdAffordance(input: {
  supported: boolean;
  /** This device remembers a set-up that still exists on the account. */
  enabledHere: boolean;
  /** The account already has at least one verified Face ID (on any device). */
  accountHasCredential: boolean;
  /** Trying the account's existing Face ID on this device just failed (there is none here). */
  useHereFailed: boolean;
}): FaceIdAffordance {
  if (!input.supported) return "unavailable";
  if (input.enabledHere) return "on";
  // The account has one but this device has not used it yet: try it here first. Registering again would be refused
  // (InvalidStateError) if the device already holds it. Only when it is not here is a new set-up offered.
  if (input.accountHasCredential && !input.useHereFailed) return "use-here";
  return "set-up";
}
