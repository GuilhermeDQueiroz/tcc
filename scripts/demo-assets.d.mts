import type {Plugin} from 'vite'
export function demoAssetsPlugin(mode:string):Plugin
export function readDemoAssets():Promise<{file:string;contents:Uint8Array}[]>
