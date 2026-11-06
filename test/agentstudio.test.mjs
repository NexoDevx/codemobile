import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../www/agentstudio.js', import.meta.url), 'utf8');
const app = () => {
  const files = {};
  const cfg = { querySelector() { return null; }, insertAdjacentHTML() {} };
  const document = {
    head: { appendChild() {} },
    querySelector(selector) { return selector === '#cfg' ? cfg : selector === '#bar' ? { style: {} } : null; },
    querySelectorAll() { return []; },
    createElement() { return {}; }
  };
  const context = {};
  Object.assign(context, {
    document,
    S: { cur: 'teste', cmds: '', mode: 'auto', perm: {}, keys: {}, pj: { teste: { files, hist: [], cps: [] } } },
    T: [], W: [], RO: [], SUB: [], GRP: { write: [] }, ico: {}, PD: {},
    NC: { validar(schema, args) { for (const k in schema) { if (args[k] == null && !schema[k].endsWith('?')) return 'parâmetro ausente: ' + k; if (schema[k] === 'strs' && (!Array.isArray(args[k]) || args[k].some(x => typeof x !== 'string'))) return 'parâmetro ' + k + ' deve ser lista de textos'; } return ''; }, policy() { return { acao: 'permitir', avisos: [] }; } },
    pj() { return context.S.pj.teste; }, save() {}, ui() {}, cfgR() {}, cmMenu() { return []; },
    exec: async (name, args = {}) => {
      if (name === 'write_file') { files[args.path] = args.content; return 'ok, ' + args.content.length + ' bytes'; }
      return 'base:' + name;
    },
    sys() { return 'system'; },
    agent: async task => 'relatório: ' + task,
    stop: false,
    addEventListener() {},
    isImg(value) { return value === 'img:ref'; }, imgData() { return 'data:image/webp;base64,AA=='; }, imgCap() { return 'openai'; },
    addAsset: async () => ({ path: 'assets/out.webp', w: 128, h: 128 }),
    blobData: async () => 'data:image/png;base64,AA==',
    F: async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'AA==' }] }) }), Blob, FormData, atob,
    dlg: async () => 0,
    alert() {}
  });
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'agentstudio.js' });
  return context;
};

test('Agent Studio core exposes safe slugs and readable project trees', () => {
  const c = { window: {} }; vm.createContext(c); vm.runInContext(source, c);
  const core = c.window.CMAgentStudioCore;
  assert.equal(core.slug('Ícone de Cristal.png'), 'icone-de-cristal');
  const tree = core.tree(['src/main.js', 'src/ui/view.js', 'README.md']);
  assert.match(tree, /📁 src/);
  assert.match(tree, /📄 README\.md/);
  assert.match(tree, /main\.js/);
});

test('Wavefront models have valid positive face indices and material references', () => {
  const c = { window: {} }; vm.createContext(c); vm.runInContext(source, c);
  const core = c.window.CMAgentStudioCore;
  for (const kind of ['cube', 'plane', 'sphere', 'cylinder', 'cone', 'torus', 'crystal']) {
    const mesh = core.wavefront(kind, '#4488cc', 'modelo-teste');
    const vertices = mesh.obj.split('\n').filter(x => x.startsWith('v ')).length;
    const faces = mesh.obj.split('\n').filter(x => x.startsWith('f '));
    assert.ok(vertices > 3, kind + ' vertices');
    assert.ok(faces.length > 0, kind + ' faces');
    assert.match(mesh.obj, /mtllib modelo-teste\.mtl/);
    for (const line of faces) for (const value of line.slice(2).trim().split(/\s+/)) {
      const index = Number(value);
      assert.ok(Number.isInteger(index) && index >= 1 && index <= vertices, kind + ' face index');
    }
  }
});

test('Agent Studio registers tools, writes reusable skills/models and runs parallel read-only agents', async () => {
  const c = app();
  for (const name of ['project_map','search_symbols','dependency_report','verify_project','asset_catalog','spawn_team','create_skill','create_3d_asset','edit_image'])
    assert.ok(c.T.some(t => t[0] === name), name + ' registration');
  const map = await c.exec('project_map', {});
  assert.match(map, /PROJETO: teste/);
  assert.match(await c.exec('spawn_team', { tasks: 'texto inválido' }), /lista de textos/);
  assert.match(await c.exec('create_skill', { name: 'sem instruções' }), /parâmetro \"description\" ausente|parâmetro \"instructions\" ausente/);
  const skill = await c.exec('create_skill', { name: 'Revisão JavaScript', description: 'Auditoria', instructions: '1. Ler o código.\n2. Rodar testes.' });
  assert.match(skill, /Skill criada/);
  assert.ok(c.S.pj.teste.files['skills/revisao-javascript/SKILL.md']);
  const model = await c.exec('create_3d_asset', { name: 'Cristal', kind: 'crystal', color: '#33aaff' });
  assert.match(model, /Wavefront OBJ/);
  assert.ok(c.S.pj.teste.files['assets/models/cristal.obj']);
  assert.ok(c.S.pj.teste.files['assets/models/cristal.mtl']);
  c.S.pj.teste.files['assets/referencia.webp'] = 'img:ref';
  const edited = await c.exec('edit_image', { path: 'assets/referencia.webp', prompt: 'Mude a paleta para azul' });
  assert.match(edited, /Imagem editada e salva/);
  const team = await c.exec('spawn_team', { tasks: ['mapear UI', 'revisar testes'], max_parallel: 2 });
  assert.match(team, /relatório: mapear UI/);
  assert.match(team, /relatório: revisar testes/);
});
