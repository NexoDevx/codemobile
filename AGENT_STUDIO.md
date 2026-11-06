# CodeMobile Agent Studio

Camada original de engenharia assistida por IA para o CodeMobile. Ela combina recursos já existentes no app (planejamento, permissões, diff, checkpoints, memória do projeto e skills) com ferramentas novas de inspeção, coordenação e assets.

## Fluxo de trabalho

1. **Orientar-se:** `project_map` cria uma árvore de pastas e destaca manifestos, entradas e linguagens. `search_symbols` localiza funções, classes e referências com linhas.
2. **Entender dependências:** `dependency_report` lê manifests e lockfiles sem instalar nada.
3. **Delegar com limites:** `spawn_team` executa de 1 a 4 subagentes em paralelo. Os subagentes são somente leitura; o agente principal mantém a autoridade sobre as alterações.
4. **Planejar e alterar:** use o modo Plan para plano sem escrita, skills em `skills/<nome>/SKILL.md`, instruções `AGENTS.md` e permissões configuráveis.
5. **Revisar e verificar:** `verify_project` verifica JSON, sintaxe JavaScript clássica e referências locais em HTML. Depois disso, ainda é necessário executar os testes/build apropriados: preview, `run_file`, npm test ou GitHub Actions.
6. **Preservar contexto:** a compactação e a memória de projeto existentes mantêm decisões importantes entre turnos. `/memoria`, `/compact` e a skill `use_skill` continuam disponíveis.

## Assets e modelos

- `generate_image`: cria um asset raster usando o provedor de imagem configurado.
- `edit_image`: usa um asset já existente como referência e salva uma nova versão, sem apagar o original. A imagem é enviada ao provedor selecionado; verifique sua política e possíveis custos antes de usar.
- `create_3d_asset`: gera uma malha paramétrica Wavefront OBJ com material MTL em `assets/models/`. Tipos: `cube`, `plane`, `sphere`, `cylinder`, `cone`, `torus` e `crystal`. Os arquivos são editáveis em Blender, Godot e ferramentas que aceitam OBJ/MTL.

Os modelos OBJ são geometria procedural simples, não uma reconstrução 3D neural de malhas orgânicas complexas. Para modelos detalhados, o agente pode planejar a geometria ou usar uma API 3D externa que o usuário configure.

## Comandos rápidos

- `/mapa` — documenta a estrutura do projeto em `PROJECT_MAP.md`.
- `/auditar` — coordena auditoria, revisão e verificação.
- `/equipe <tarefa>` — delega investigação em paralelo.
- `/assets <pedido>` — planeja e cria assets 2D/3D.
- `/skill <fluxo>` — cria uma skill reutilizável.
- `/verificar` — executa verificações disponíveis.
- `/memoria` — consulta ou atualiza a memória do projeto.
- `/review` — revisa alterações do checkpoint atual.

## Segurança e limites

- Os agentes paralelos não escrevem arquivos; todas as mudanças ficam com o agente principal.
- Alterações passam pelas permissões do CodeMobile; arquivos de skill/modelos são gravados via ferramenta de escrita já protegida.
- A edição de imagem consulta regras e hooks do projeto, pede aprovação quando o modo de permissão exige e preserva o arquivo original.
- A verificação estática não substitui testes reais nem prova que um build está correto.
- Não existe execução de agente em segundo plano com o app fechado; a coordenação ocorre durante a sessão ativa.
- O código é uma implementação independente inspirada em práticas públicas de engenharia de agentes. Não contém código proprietário, segredos, nem trechos copiados de vazamentos.

## Referências públicas de design

- Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code/cli-usage
- Anthropic prompting best practices: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables
- Gemini image generation/editing: https://ai.google.dev/gemini-api/docs/image-generation
- OpenAI image generation guide: https://platform.openai.com/docs/guides/image-generation

As referências informam padrões e capacidades documentadas. Os nomes, fluxos e código do Agent Studio são próprios do CodeMobile.
