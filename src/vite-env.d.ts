/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in the no-backend static build (npm run build:static); undefined otherwise. */
  readonly VITE_STATIC?: string
}
