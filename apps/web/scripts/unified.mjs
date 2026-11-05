import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {existsSync,cpSync} from 'node:fs';
import {loadEnv} from 'vite';
const web=fileURLToPath(new URL('../',import.meta.url));
// The web client is self-contained, including its own dependency lockfile.
const client=resolve(web,'client');
const build=process.argv[2]==='build',env=loadEnv(build?'production':'development',web,'VITE_');
if(build&&!process.env.VITE_API_URL&&!env.VITE_API_URL)throw new Error("Postavi VITE_API_URL za web build.");
const bin=resolve(client,'node_modules/expo/bin/cli');
if(build||!existsSync(bin)){
 const r=spawnSync(process.execPath,[process.env.npm_execpath,'--prefix',client,'ci','--workspaces=false','--include=dev','--no-audit','--no-fund'],{cwd:client,stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);
}
const output=resolve(web,'dist');
const proc=spawn(process.execPath,[bin,...(build?['export','--platform','web','--max-workers','2','--output-dir',output]:['start','--web','--port','5173'])],{cwd:client,stdio:'inherit',env:{...process.env,EXPO_NO_DOTENV:'1',EXPO_PUBLIC_API_URL:process.env.VITE_API_URL||env.VITE_API_URL||'http://localhost:4000',EXPO_PUBLIC_WEB_URL:process.env.VITE_WEB_URL||env.VITE_WEB_URL||'',EXPO_PUBLIC_GOOGLE_CLIENT_ID:process.env.VITE_GOOGLE_CLIENT_ID||env.VITE_GOOGLE_CLIENT_ID||''}});
proc.on('exit',code=>{if(!code&&build&&existsSync(resolve(web,'public/favicon.png')))cpSync(resolve(web,'public/favicon.png'),resolve(output,'favicon.png'));process.exit(code??1)});
