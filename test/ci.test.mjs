import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('workflow instala Android SDK, plataforma 34 e Build Tools 34', async () => {
  const y = await read('.github/workflows/apk.yml');
  assert.match(y, /android-actions\/setup-android@v4/);
  assert.match(y, /platforms;android-34/);
  assert.match(y, /build-tools;34\.0\.0/);
  assert.match(y, /actions\/setup-java@v4/);
  assert.match(y, /gradle\/actions\/setup-gradle@v6/);
  assert.match(y, /assembleDebug/);
});

test('workflow inicia Alpine, instala toolchain e testa rede e comandos', async () => {
  const y = await read('.github/workflows/apk.yml');
  assert.match(y, /linux-runtime:/);
  assert.match(y, /alpine:3\.24\.4/);
  assert.match(y, /apk add --no-cache/);
  assert.match(y, /openjdk17-jdk/);
  assert.match(y, /curl -fsSI/);
  assert.match(y, /npm test/);
});

test('rootfs ARM64 tem versão fixa e checksum oficial validado', async () => {
  const y = await read('.github/workflows/apk.yml');
  assert.match(y, /ALPINE_VERSION: '3\.24\.4'/);
  assert.match(y, /\.sha256/);
  assert.match(y, /sha256sum -c rootfs\.sha256/);
  assert.match(y, /libproot-loader\.so/);
  assert.match(y, /file \"\$PROOT\" \| grep/);
});

test('build não remove silenciosamente o Linux para fingir sucesso', async () => {
  const y = await read('.github/workflows/apk.yml');
  assert.doesNotMatch(y, /tentando sem o plugin Linux/);
  assert.match(y, /EXPECT_LINUX/);
  assert.match(y, /verify-apk\.mjs/);
});

test('verificador exige DEX, manifesto e os três recursos Linux', async () => {
  const s = await read('scripts/verify-apk.mjs');
  for (const x of ['AndroidManifest.xml', 'resources.arsc', 'classes', 'assets/rootfs.bin', 'lib/arm64-v8a/libproot.so', 'lib/arm64-v8a/libproot-loader.so']) assert.ok(s.includes(x), x);
});

test('dispatch GitHub pede explicitamente Linux e smoke test no workflow CodeMobile', async () => {
  const s = await read('www/app.js');
  assert.match(s, /payload\.inputs=\{build_linux:true,run_alpine_smoke:true\}/);
  assert.match(s, /w\.path==='\.github\/workflows\/apk\.yml'/);
});

test('terminal pode disparar workflow Android e diagnosticar SDK local', async () => {
  const s = await read('www/extras.js');
  assert.match(s, /if\(sub==='build'\)return ghTerminal\('gh',\['build'/);
  assert.match(s, /ANDROID_HOME/);
  assert.match(s, /build-tools;34\.0\.0/);
  assert.match(s, /cm android packages/);
});
