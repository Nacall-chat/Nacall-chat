import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// O vídeo da transmissão era forçado num quadro 16:9. Tela ultrawide (2560×1080), janela ou qualquer formato que não
// fosse 16:9 ganhava faixas pretas. Agora o quadro segue o formato real do que está sendo transmitido. A resolução e
// a qualidade da transmissão continuam as mesmas (720p/1080p).
test('vídeo da transmissão usa o formato real da tela, sem quadro 16:9 forçado',async()=>{
 const css=await readFile(new URL('../src/app/jacall.css',import.meta.url),'utf8');
 const rule=css.match(/(?:^|\})\.screen-stream video\{([^}]*)\}/m)?.[1]??'';
 assert.ok(rule,'regra principal do vídeo da transmissão');
 assert.doesNotMatch(rule,/aspect-ratio:16\/9/,'sem quadro 16:9 forçado');
 assert.match(rule,/aspect-ratio:auto/);
 assert.match(rule,/width:auto;max-width:100%/,'encolhe para o tamanho do vídeo, sem faixas dos lados');
 assert.match(rule,/margin-inline:auto/,'centralizado');
});
