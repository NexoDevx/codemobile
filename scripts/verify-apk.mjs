import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import process from 'node:process';

const apk = process.argv[2];
if (!apk || !existsSync(apk)) throw new Error(`APK não encontrado: ${apk || '(argumento ausente)'}`);
const entries = execFileSync('unzip', ['-Z1', apk], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const has = name => entries.includes(name);
const dex = entries.some(x => /^classes(\d+)?\.dex$/.test(x));
const linuxExpected = process.env.EXPECT_LINUX !== 'false';
const required = ['AndroidManifest.xml', 'resources.arsc'];
for (const x of required) if (!has(x)) throw new Error(`APK inválido: falta ${x}`);
if (!dex) throw new Error('APK inválido: nenhum classes*.dex encontrado');
if (linuxExpected) {
  for (const x of ['assets/rootfs.bin', 'lib/arm64-v8a/libproot.so', 'lib/arm64-v8a/libproot-loader.so']) {
    if (!has(x)) throw new Error(`APK Linux incompleto: falta ${x}`);
  }
}
const size = statSync(apk).size;
console.log(`APK válido: ${(size / 1024 / 1024).toFixed(2)} MiB`);
console.log(`Entradas ZIP: ${entries.length}`);
console.log(`DEX: ${dex ? 'OK' : 'FALHA'}`);
console.log(`Linux ARM64: ${linuxExpected ? 'rootfs + PRoot verificados no APK' : 'desabilitado por opção'}`);
