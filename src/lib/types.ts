export interface SsoPasskey {
    /** Base64url WebAuthn credential id. Public metadata, not a secret. */
    credentialId: string;
    /** Relying-party id under which the SSO passkey was registered. */
    rpId: string;
    /** Registration-time capability hint; runtime PRF output is authoritative. */
    prfCapable: boolean;
}

export interface SsoUser {
    uuid: string;
    elevated: boolean;
    /** Null unless the SSO account has exactly one passkey. */
    passkey: SsoPasskey | null;
}

export interface AesGcmEnvelope {
    v: 1;
    alg: 'A256GCM';
    iv: string;
    ct: string;
}

export interface KeyringMetadata {
    v: 1;
    credentialId: string;
    prfInput: string;
    hkdfSalt: string;
}

export type NoteApiState =
    | { state: 'absent' }
    | {
          state: 'pending';
          keyring: KeyringMetadata;
      }
    | {
          state: 'ready';
          keyring: KeyringMetadata & { wrappedDek: AesGcmEnvelope };
          note: {
              ciphertext: AesGcmEnvelope;
              revision: number;
          };
      };
