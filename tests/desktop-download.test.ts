import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WINDOWS_LATEST_URL,windowsDownloadUrl} from '../src/lib/downloads';

// Download do app Windows no site (25/11/2026). O instalador (~110 MB) fica num repositório público só de downloads, porque o
// repositório do código é privado e servir o .exe pela Vercel gastaria a cota de banda.
const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('link do Windows: só https no GitHub ou no nacall.site; vazio deixa o botão "em breve"',()=>{
 assert.equal(windowsDownloadUrl(undefined),'');
 assert.equal(windowsDownloadUrl('  '),'');
 assert.equal(windowsDownloadUrl(WINDOWS_LATEST_URL),WINDOWS_LATEST_URL);
 assert.equal(WINDOWS_LATEST_URL,'https://github.com/Nacall-chat/nacall-downloads/releases/latest/download/NACALL-Setup-x64.exe');
 assert.equal(windowsDownloadUrl('https://downloads.nacall.site/NACALL-Setup-x64.exe'),'https://downloads.nacall.site/NACALL-Setup-x64.exe');
 for(const bad of ['http://github.com/x.exe','https://evil.example/NACALL-Setup-x64.exe','https://github.com.evil.example/x.exe','https://user:pass@github.com/x.exe','javascript:alert(1)','não é url'])
  assert.equal(windowsDownloadUrl(bad),'',bad);
});

test('landing: com o link configurado o botão baixa o instalador e explica o aviso do Windows; sem ele continua "em breve"',async()=>{
 const landing=await read('src/components/landing.tsx');
 assert.match(landing,/const windows=windowsDownloadUrl\(\);/);
 assert.match(landing,/\{windows\?<a className="download-ready" href=\{windows\}[^>]*aria-label="Baixar o NACALL para Windows \(versão de teste\)">/);
 assert.match(landing,/<button disabled aria-label="Download para Windows — em breve">/,'sem link continua "em breve"');
 assert.match(landing,/O Windows protegeu o computador/,'explica o aviso do SmartScreen enquanto não há assinatura digital');
});

test('workflow: publica só da main, no repositório público, com nome fixo e SHA-256, e não falha sem o token',async()=>{
 const yaml=await read('.github/workflows/windows-desktop.yml');
 const job=yaml.slice(yaml.indexOf('\n  publicar:'));
 assert.match(job,/if: github\.ref == 'refs\/heads\/main'/,'nunca publica de outra branch');
 assert.match(job,/needs: windows-exe/);
 assert.match(job,/environment: production/);
 assert.match(job,/GH_TOKEN: \$\{\{ secrets\.DOWNLOADS_TOKEN \}\}/);
 assert.match(job,/if \[ -z "\$GH_TOKEN" \]; then echo "::warning::[^"]*"; exit 0; fi/,'sem token só avisa');
 assert.match(job,/DOWNLOADS_REPO: Nacall-chat\/nacall-downloads/);
 assert.match(job,/cp "\$SETUP" dist\/NACALL-Setup-x64\.exe/,'nome fixo para o link latest');
 assert.match(job,/sha256sum NACALL-Setup-x64\.exe > NACALL-Setup-x64\.exe\.sha256/);
 assert.match(job,/gh release create "\$TAG" dist\/NACALL-Setup-x64\.exe dist\/NACALL-Setup-x64\.exe\.sha256 --repo "\$DOWNLOADS_REPO"[^\n]*--latest/);
 assert.doesNotMatch(job,/echo[^\n]*GH_TOKEN[^\n]*\$GH_TOKEN/,'o token nunca vai para o log');
});
