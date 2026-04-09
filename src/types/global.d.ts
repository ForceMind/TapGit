import { TapGitBridge } from '../shared/contracts';

declare global {
  interface Window {
    tapgit: TapGitBridge;
  }
}

export {};
