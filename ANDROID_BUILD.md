# Android SDK, Linux e builds do CodeMobile

## O que o workflow faz

`.github/workflows/apk.yml` agora é o pipeline principal do projeto. Em `push` para `main`, em pull requests e em execução manual ele:

1. executa a suíte de testes e valida a sintaxe dos módulos;
2. inicia um container Alpine 3.24.4 limpo, instala a mesma família de ferramentas do terminal e testa `apk`, DNS/HTTPS, Java, Node, npm, Python, Git, ZIP e a suíte do projeto dentro do Linux;
3. instala JDK 17, Android Command-line Tools, Platform Tools, Android Platform 34 e Build Tools 34.0.0 no runner Ubuntu;
4. cria/sincroniza a plataforma Android do Capacitor;
5. baixa o rootfs Alpine 3.24.4 ARM64 e valida o SHA-256 publicado pelo espelho oficial;
6. prepara o PRoot ARM64, registra `ShellPlugin` e `FolderPlugin`, sincroniza o Capacitor e compila o APK;
7. inspeciona o APK e falha se faltar DEX, manifesto, rootfs ou qualquer biblioteca nativa obrigatória;
8. publica o APK como artefato do GitHub Actions.

O pipeline não remove o Linux silenciosamente para produzir um APK incompleto. Se `build_linux=true` e o rootfs/PRoot não puderem ser preparados, o job falha com o erro visível.

## SDK local x SDK de CI

O Linux do aplicativo é Alpine ARM64 via PRoot. Ele serve para Git, linguagens, compiladores, ferramentas e Gradle genérico. O Android SDK completo fica no runner Ubuntu x86_64, onde o workflow instala explicitamente:

- `platform-tools`
- `platforms;android-34`
- `build-tools;34.0.0`
- JDK 17 (Temurin)
- Gradle Wrapper do projeto, com cache persistente do Gradle Actions

Isso evita colocar centenas de MB de SDK e ferramentas x86_64 dentro do APK ARM64. O SDK Android não é instalado no Alpine do celular. O Gradle Wrapper do projeto tem prioridade para preservar a versão que o projeto exige.

## Como executar pelo CodeMobile

Com GitHub conectado e o projeto publicado no repositório:

```text
cm android doctor
cm android packages
cm android build
```

`cm android build` solicita o workflow `apk.yml` com Linux ARM64 e teste Alpine habilitados. O build é executado no GitHub Actions; o APK aparece na aba Actions > execução > Artifacts.

Também é possível executar manualmente em GitHub > Actions > CodeMobile · Linux, testes, Android SDK e APK > Run workflow. `build_linux` e `run_alpine_smoke` ficam ativados por padrão.

## Limitações e verificações pendentes

- O job Alpine inicia e testa um ambiente Alpine x86_64 para validar o conjunto de pacotes e os comandos no CI. O rootfs ARM64 destinado ao telefone é empacotado e verificado, mas não é executado no runner x86_64.
- O PRoot é obtido do repositório público `green-green-avk/build-proot-android`; o SHA do commit utilizado fica no resumo do job. O rootfs Alpine é fixado em 3.24.4 e sua soma SHA-256 é validada.
- A compilação real, a instalação do APK e o primeiro boot do Alpine ARM64 ainda precisam ser confirmados por uma execução do workflow e por teste no aparelho físico.
- O APK gerado é `debug` e serve para teste. Publicação/atualização distribuída exige configurar assinatura release com secrets do repositório; nenhuma chave privada é incluída no código.
