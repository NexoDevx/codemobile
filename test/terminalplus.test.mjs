import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

test('Linux configura DNS de Android, repositórios Alpine e cache APK persistente', async () => {
  const s = await read('native/ShellPlugin.java');
  assert.match(s, /configureRepositories\(r\)/);
  assert.match(s, /Build\.VERSION\.SDK_INT\s*>=\s*23/);
  assert.match(s, /var\/cache\/apk/);
  assert.match(s, /apk update && apk add /);
  assert.doesNotMatch(s, /apk add --no-cache/);
});

test('terminal suporta toolchains, pacotes, Gradle e cache offline', async () => {
  const s = await read('www/extras.js');
  for (const x of ['openjdk21-jdk', "gradle:{label:'Gradle 9.8.2 oficial + Java 21'", "maven:{label:'Apache Maven + Java'", "v==='pkg'&&sub==='remove'", "action==='config-cache'", "action==='cache'", "--offline", "org.gradle.caching true", "GRADLE_USER_HOME"]) assert.ok(s.includes(x), `ausente: ${x}`);
  assert.match(s, /apk add --update-cache/);
  assert.match(s, /SHP\.exec\(pl\)/);
  assert.match(s, /services\.gradle\.org\/distributions\/gradle-\$VERSION-bin\.zip/);
  assert.match(s, /sha256sum -c/);
  assert.match(s, /21bd5da2de49b642904077f38c0efdc7778e92b3ed0889392dca61b97e389607/);
  assert.match(s, /cmInstallGradle/);
  assert.match(s, /save\(\);return\{out:j\.out/);
});

test('workflow adiciona permissões Android de rede', async () => {
  const s = await read('.github/workflows/apk.yml');
  assert.match(s, /android\.permission\.INTERNET/);
  assert.match(s, /android\.permission\.ACCESS_NETWORK_STATE/);
});

test('agente oferece /clear e /context locais', async () => {
  const s = await read('www/nucleo.js');
  assert.match(s, /compactar\|clear\|limpar\|context\|contexto/);
  assert.match(s, /Histórico desta conversa limpo/);
  assert.match(s, /Diagnóstico aproximado de contexto/);
});

test('Gradle oficial usa Java 21, checksum e PATH persistente', async () => {
  const js = await read('www/extras.js');
  const java = await read('native/ShellPlugin.java');
  assert.match(js, /openjdk21-jdk/);
  assert.match(js, /Gradle 9\.8\.2 binária oficial/);
  assert.match(js, /600000/);
  assert.match(js, /Espaço insuficiente/);
  assert.match(java, /\/opt\/gradle\/current\/bin/);
  assert.match(java, /GRADLE_HOME/);
});

test('índice compacto do projeto limita caminhos no prompt do agente', async () => {
  const s = await read('www/app.js');
  assert.match(s, /function projectIndex\(files,fast=false\)/);
  assert.match(s, /Amostra de caminhos/);
  assert.match(s, /projectIndex\(f,true\)/);
});

test('saídas grandes de ferramentas preservam começo e final', async () => {
  const s = await read('www/app.js');
  assert.match(s, /const toolExcerpt=/);
  assert.match(s, /s\.slice\(-tail\)/);
  assert.match(s, /toolExcerpt\(res,S\.fast\?4500:10000\)/);
});
