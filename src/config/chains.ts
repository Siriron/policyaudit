import { studionet } from 'genlayer-js/chains'

/** Deployed PolicyAudit address on StudioNet. One plain constant, edited in this single place after deploy. */
export const CONTRACT_ADDRESS: string = '0x8bAAC1F6A9889a723f9e87DB3028eaC60Ed9131a'

export const CHAIN = studionet
export const CHAIN_ID_HEX = '0xF22F' // 61999
export const RPC_URL = 'https://studio.genlayer.com/api'
export const EXPLORER_URL = 'https://explorer-studio.genlayer.com'
export const REPO_URL = 'https://github.com/Siriron/policyaudit'

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`
