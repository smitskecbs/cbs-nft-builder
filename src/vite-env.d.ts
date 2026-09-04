/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HELIUS_DEVNET_RPC?: string;
  readonly VITE_HELIUS_MAINNET_RPC?: string;
  readonly VITE_PINATA_UPLOAD_API?: string;
  /** Public Devnet/test program ID only. Never a secret key. */
  readonly VITE_CBS_COLLECTION_CAP_PROGRAM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
