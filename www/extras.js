/* extras.js — terminal Linux/mini, GitHub CLI integrado, conversas em drawer */
let CM_SRV=!!window.CM_PX,CM_BASE='',CM_CAPS=[];
const CM_CAP=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
async function cmCaps(){try{CM_CAPS=(await cmApi('caps')).tools||[]}catch(e){CM_CAPS=[]}}
/* Opcional: detecta um servidor local auxiliar; o uso normal não depende dele. */
async function cmProbe(){if(!CM_CAP){if(CM_SRV)await cmCaps();return CM_SRV}for(const b of['http://127.0.0.1:8787','http://localhost:8787']){try{const r=await fetch(b+'/api/ping');if(r.ok){CM_BASE=b;CM_SRV=true;window.CM_PX=b+'/gh';await cmCaps();return true}}catch(e){}}CM_SRV=false;window.CM_PX='';CM_CAPS=[];return false}
/* token do servidor: fica FORA do estado do app (localStorage 'cm_tok'); no navegador vem do próprio servidor (CM_TOK) */
async function cmApi(p,o={},retry=1){const t=window.CM_TOK||localStorage.getItem('cm_tok')||'';const r=await fetch(CM_BASE+'/api/'+p,{...o,headers:{'Authorization':'Bearer '+t,'content-type':'application/json'}});
 if(r.status==401&&retry&&!window.CM_TOK){const n=prompt('O servidor auxiliar pede um token de acesso. Cole o token exibido por ele ao iniciar.');if(n&&n.trim()){localStorage.setItem('cm_tok',n.trim());return cmApi(p,o,0)}}
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('servidor '+r.status));return j}

/* ---- Linux embutido no APK (Alpine via proot, plugin nativo "Shell"): sem servidor, sem Termux ---- */
const SHP=(()=>{try{const C=window.Capacitor;return CM_CAP&&C?(C.registerPlugin?C.registerPlugin('Shell'):C.Plugins&&C.Plugins.Shell):null}catch(e){return null}})();
let NAT={available:false,ready:false,toolsReady:false};
const real=()=>!!(NAT.ready&&NAT.toolsReady)||CM_SRV;
async function natProbe(){if(!SHP)return;try{NAT=await SHP.status()}catch(e){NAT={available:false,ready:false,toolsReady:false}}if(NAT.ready&&NAT.toolsReady&&!CM_CAPS.length)natCaps()}
async function natCaps(){try{const r=await shellRun('for c in git git-lfs python3 pip node npm npx java javac gradle mvn go rustc cargo ruby php lua rg fd fzf jq yq tree curl wget ssh bash zip unzip make cmake ninja clang sqlite3 adb ffmpeg; do command -v $c >/dev/null 2>&1 && echo $c; done',45);if(!NAT.ready)return;CM_CAPS=r.out.split('\n').map(x=>x.trim()).filter(Boolean)}catch(e){}}
async function natInstall(){
 if(!NAT.available)return alert('Este APK foi gerado sem o Linux embutido. Atualize o APK usando o botão Build APK do GitHub Actions.');
 if(await dlg({title:'Preparar o terminal completo?',text:'O CodeMobile vai instalar automaticamente um Alpine Linux isolado e configurar Git, Git LFS, Python, Node.js, npm, SSH, compiladores, curl, wget e ferramentas de desenvolvimento. Não será necessário abrir o Termux, executar scripts ou digitar comandos de instalação. Precisa de internet e espaço livre (o download dos pacotes pode passar de 100 MB).',btns:['🚀 Configurar tudo','Agora não']})!==0)return;
 dlg({title:'⏳ Preparando o terminal...',text:'O próprio CodeMobile está instalando e configurando as ferramentas. Mantenha o app aberto.'});
 let msg;try{const r=await SHP.install();NAT=await SHP.status();NAT.ready=!!r.ready;NAT.toolsReady=!!r.toolsReady;CM_CAPS=Array.isArray(r.tools)?r.tools:[];if(!CM_CAPS.length)await natCaps();msg=(NAT.toolsReady?'✅ Terminal completo pronto!\n':'⚠️ Linux instalado, mas a configuração de ferramentas não terminou.\n')+(r.out||'').slice(-900)}catch(e){try{NAT=await SHP.status()}catch(_){}msg='❌ '+e.message+'\nVocê pode tocar em Configurar tudo novamente para continuar.'}
 $('#dl').hidden=true;$('#dl').innerHTML='';await dlg({title:'Terminal CodeMobile',text:msg,skip:'Fechar'});ui();if($('#term').classList.contains('on')){TM.log='';termR()}
}

/* ---- terminal: um só executor para o agente e para a aba Terminal ---- */
VSH.hooks.py=(f,m,i)=>pyRun(f,m,i);VSH.hooks.proj=()=>pj();VSH.hooks.get=u=>gt(u);VSH.hooks.js=c=>runHtml('<script>'+c+'<\/script>',2500);
T.push(['shell','TERMINAL: executa comandos reais no Alpine via proot quando instalado (apk, git, npm, pip, Gradle, Java, compiladores e rede); no mini-terminal, só comandos locais/gh/cm. Mantém workspace e caches entre chamadas. Use cwd do terminal; comandos não interativos; projetos grandes/builds ficam no disco Linux, não são copiados como binários para o editor.',{cmd:'string',timeout:'int?'}]);ico.shell='💻';
try{PD.cmd='Comando de shell, ex: ls -la && git status'}catch(e){}
async function shellRun(cmd,to){const p=pj();
 if(/^\s*(gh|cm)\s+/.test(cmd)){VSH.cwd=p.termCwd||'';const r=await vsh(cmd,p.files);p.termCwd=VSH.cwd;return{out:r.out,code:r.code,nm:VSH.dirty?['(comando CodeMobile)']:[]}}
 if(real()){const current=p.files||{},prior=p.termSync||null,hash=v=>{v=String(v);let a=2166136261,b=0x9e3779b9;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519)}return v.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16)};
  const now={},changed={};for(const k of Object.keys(current)){const h=hash(current[k]);now[k]=h;if(!prior||prior[k]!==h)changed[k]=current[k]}
  const deleted=prior?Object.keys(prior).filter(k=>!(k in current)):[];
  const pl={project:S.cur,files:prior?changed:current,delta:!!prior,deletedFiles:deleted,cwd:p.termCwd||'',cmd,timeout:Math.min(+to||60,1800)},j=NAT.ready?await SHP.exec(pl):await cmApi('exec',{method:'POST',body:JSON.stringify(pl)});
  const nm=[];for(const k in j.changed){p.files[k]=j.changed[k];nm.push(k)}for(const k of j.deleted||[]){delete p.files[k];nm.push('-'+k)}
  p.termSync={};for(const k of Object.keys(p.files)){const h=hash(p.files[k]);p.termSync[k]=h}
  save();return{out:j.out||'',code:j.code,to:j.timedOut,nm}}
 VSH.cwd=p.termCwd||VSH.cwd||'';VSH.dirs=new Set(Array.isArray(p.dirs)?p.dirs:[]);for(const k of Object.keys(p.files)){const a=k.split('/');a.pop();let d='';for(const z of a){d=d?d+'/'+z:z;VSH.dirs.add(d)}}if(!vIsDir(p.files,VSH.cwd))VSH.cwd='';const beforeDirs=JSON.stringify(p.dirs||[]);const r=await vsh(cmd,p.files);p.termCwd=VSH.cwd;p.dirs=[...VSH.dirs];const dirsChanged=beforeDirs!==JSON.stringify(p.dirs);return{out:r.out,code:r.code,nm:VSH.dirty||dirsChanged?['(arquivos/pastas alterados)']:[]}}
async function ghTerminal(f,a){
 const [verb,...args]=a,repo=(pj().gh||{}).repo,branch=(pj().gh||{}).branch||'main';
 if(!S.gh||!S.gh.tok||!S.gh.user)return{out:'GitHub não conectado. Abra Ajustes → GitHub e conecte sua conta.\n',code:1};
 try{
  if(!verb||verb==='help')return{out:'CodeMobile GitHub CLI\n  gh status                         conexão e projeto vinculado\n  gh repo list                      listar repositórios\n  gh repo create NOME [--public]    criar repositório\n  gh repo clone dono/repo [branch]  importar para o projeto\n  gh repo sync [dono/repo]          enviar alterações em um commit\n  gh repo publish NOME [--public]   criar repo e publicar este projeto\n  gh workflow list                  workflows do repositório\n  gh build [branch]                 iniciar build do APK na nuvem\n  gh run list                       últimas execuções\n  gh run view [ID]                  detalhes da execução\n  gh run open [ID]                  abrir execução no GitHub\n  gh open                           abrir repositório no GitHub\n',code:0};
  if(verb==='status')return{out:'Conta: @'+S.gh.user+'\nProjeto: '+S.cur+'\nRepositório: '+(repo||'(não vinculado)')+'\nBranch: '+branch+'\nPermissões: '+(S.gh.p&&S.gh.p.write?'leitura e escrita':'somente leitura')+'\n',code:0};
  if(verb==='repo'&&args[0]==='list'){
   const j=await gha('/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member');
   return{out:(j||[]).map(r=>r.full_name+(r.private?' 🔒':'')+' ['+r.default_branch+']').join('\n')+'\n',code:0};
  }
  if(verb==='repo'&&args[0]==='create'){
   const name=args.find(x=>!x.startsWith('--'));if(!name)return{out:'Uso: gh repo create NOME [--public|--private]\n',code:2};
   const pv=args.includes('--public')?'false':'true',r=await ghUiCall('gh_create_repo',{name,private:pv});
   if(String(r).startsWith('ok:')){save();GHUI.selected=(pj().gh||{}).repo||'';GHUI.msg=r;ui()}
   return{out:String(r)+'\n',code:String(r).startsWith('ok:')?0:1};
  }
  if(verb==='repo'&&args[0]==='clone'){
   const target=args[1];if(!target)return{out:'Uso: gh repo clone dono/repo [branch]\n',code:2};
   const p=pj();p.cps=p.cps||[];p.cps.push({t:'importação GitHub '+target+'@'+(args[2]||'branch padrão'),f:{...p.files}});p.cps=p.cps.slice(-6);
   const r=await ghUiCall('gh_pull',{repo:target,branch:args[2]||undefined});
   if(String(r).startsWith('ok:')){save();GHUI.selected=(pj().gh||{}).repo||target;GHUI.msg=r;FT.open.add('');FT.q='';ui()}
   return{out:String(r)+'\n',code:String(r).startsWith('ok:')?0:1};
  }
  if(verb==='repo'&&(args[0]==='sync'||args[0]==='push')){
   const target=args[1]||repo;if(!target)return{out:'Nenhum repositório vinculado. Use gh repo clone ou gh repo create.\n',code:2};
   const r=await ghUiCall('gh_push',{repo:target,branch:args[2]||branch,message:'Atualização via terminal CodeMobile'});
   if(/^(ok:|Nada para enviar)/.test(String(r))){pj().gh={repo:target,branch:args[2]||branch};save()}
   return{out:String(r)+'\n',code:/^(ok:|Nada para enviar)/.test(String(r))?0:1};
  }
  if(verb==='repo'&&args[0]==='publish'){
   const name=args[1];if(!name)return{out:'Uso: gh repo publish NOME [--public]\n',code:2};
   const made=await ghUiCall('gh_create_repo',{name,private:args.includes('--public')?'false':'true'});if(!String(made).startsWith('ok:'))return{out:String(made)+'\n',code:1};
   save();const link=pj().gh||{},target=link.repo,br=link.branch||'main';
   const pushed=await ghUiCall('gh_push',{repo:target,branch:br,message:'Publicação inicial via CodeMobile'});
   if(/^(ok:|Nada para enviar)/.test(String(pushed))){save();GHUI.selected=target;GHUI.msg='Projeto publicado: '+target;ui()}
   return{out:String(made)+'\n'+String(pushed)+'\n',code:/^(ok:|Nada para enviar)/.test(String(pushed))?0:1};
  }
  if(verb==='workflow'&&args[0]==='list'){
   const target=args[1]||repo;if(!target)return{out:'Nenhum repositório vinculado.\n',code:2};const list=await ghWorkflowList(target);return{out:list.map(w=>w.name+' · '+w.path+' · '+w.state).join('\n')+'\n',code:0};
  }
  if(verb==='build'||verb==='workflow'&&args[0]==='run'){
   const target=repo;if(!target)return{out:'Vincule um repositório antes de iniciar o build.\n',code:2};const br=args[verb==='workflow'?1:0]||branch;
   if(!await ghAsk('Iniciar build pelo GitHub Actions?',target+'\nBranch: '+br+'\nO GitHub executará testes e tentará gerar o APK na nuvem.'))return{out:'Build cancelado.\n',code:1};
   const w=await ghWorkflowDispatch(target,br);const link=w.run_url||('https://github.com/'+target+'/actions');return{out:'Build solicitado: '+w.name+' · '+target+'@'+br+(w.run_id?'\nExecução #'+w.run_id:'')+'\nAcompanhe: '+link+'\nUse gh run list para ver o status.\n',code:0};
  }
  if(verb==='run'&&args[0]==='list'){
   const target=repo;if(!target)return{out:'Nenhum repositório vinculado.\n',code:2};const list=await ghRunList(target,branch);return{out:list.map(r=>'#'+r.run_number+' '+r.name+' · '+r.status+(r.conclusion?' / '+r.conclusion:'')+' · '+r.html_url).join('\n')+'\n',code:0};
  }
  if(verb==='run'&&(args[0]==='view'||args[0]==='watch'||args[0]==='open')){
   const target=repo;if(!target)return{out:'Nenhum repositório vinculado.\n',code:2};const runs=await ghRunList(target,branch),id=args[1]|| (runs[0]&&runs[0].id);if(!id)return{out:'Nenhuma execução encontrada.\n',code:1};const r=await gha('/repos/'+target+'/actions/runs/'+encodeURIComponent(id));
   if(args[0]==='open'){ghOpen(r.html_url);return{out:'Abrindo '+r.html_url+'\n',code:0}}
   return{out:'#'+r.run_number+' '+r.name+'\nStatus: '+r.status+'\nConclusão: '+(r.conclusion||'em andamento')+'\nBranch: '+r.head_branch+'\nURL: '+r.html_url+'\n',code:0};
  }
  if(verb==='open'){if(repo)ghOpen('https://github.com/'+repo);return{out:repo?'Abrindo '+repo+' no GitHub.\n':'Nenhum repositório vinculado.\n',code:repo?0:1}}
  return{out:'Subcomando gh desconhecido. Digite gh help.\n',code:2};
 }catch(e){return{out:'gh: '+e.message+(e.status===403?'\nVerifique o escopo repo do token clássico ou Actions: write do token fine-grained.':'')+'\n',code:1}}
}
const CM_PROFILES={
 core:{label:'Ferramentas essenciais',pkgs:['ca-certificates','git','git-lfs','curl','wget','zip','unzip','tar','bash','ripgrep','jq','tree']},
 java:{label:'Java JDK 21',pkgs:['openjdk21-jdk']},
 gradle:{label:'Gradle 9.8.2 oficial + Java 21',pkgs:['openjdk21-jdk','curl','unzip','coreutils']},
 maven:{label:'Apache Maven + Java',pkgs:['maven']},
 python:{label:'Python para desenvolvimento',pkgs:['python3','py3-pip','py3-virtualenv','python3-dev','build-base','libffi-dev','openssl-dev']},
 node:{label:'Node.js e ecossistema web',pkgs:['nodejs','npm','git','python3','make','g++']},
 cpp:{label:'C/C++ e ferramentas nativas',pkgs:['build-base','clang','cmake','ninja','pkgconf','linux-headers']},
 go:{label:'Go toolchain',pkgs:['go','git']},
 rust:{label:'Rust e Cargo',pkgs:['rust','cargo','build-base','pkgconf']},
 ruby:{label:'Ruby e Bundler',pkgs:['ruby','ruby-dev','ruby-bundler','build-base']},
 php:{label:'PHP CLI e Composer',pkgs:['php','php-phar','php-openssl','php-curl','php-mbstring','php-xml','composer']}
};
const cmQuote=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
async function cmRun(cmd,timeout=600){try{return await shellRun(cmd,timeout)}catch(e){return{out:e.message+'\n',code:1}}}
async function cmInstallPackages(names,label){
 if(!NAT.ready||!NAT.toolsReady)return{out:'Configure primeiro o Linux: cm linux\n',code:1};
 if(!names.length||names.length>20||names.some(x=>!/^[a-z0-9][a-z0-9+._-]{0,63}$/i.test(x)))return{out:'Lista de pacotes inválida. Use nomes simples do Alpine (máximo 20 por operação).\n',code:2};
 const large=names.includes('gradle')||/gradle/i.test(label||'');
 const warning='Pacotes: '+names.join(', ')+'\n'+(large?'A instalação inclui JDK 21 e a distribuição Gradle 9.8.2 binária oficial (~145 MB só o ZIP do Gradle), além das dependências. Confira o espaço livre; o checksum SHA-256 será verificado antes da instalação. ':'')+'Os pacotes são baixados dos repositórios HTTPS assinados do Alpine. O cache persistente evita baixar novamente versões já armazenadas.\nA instalação altera somente o Linux privado do CodeMobile.';
 if(await dlg({title:label||'Instalar pacotes Linux?',text:warning,btns:['Instalar','Cancelar']})!==0)return{out:'Instalação cancelada.\n',code:1};
 const r=await cmRun('apk add --update-cache '+names.join(' '),1200);await natCaps();save();
 return{out:r.out+(r.code?'\nInstalação terminou com erro (exit '+r.code+').':'\n✅ Pacotes instalados.')+'\n',code:r.code||0};
}
async function cmInstallGradle(){
 const installed=await cmRun('gradle --version',90);
 if(installed.code===0)return{out:'Gradle já está instalado; reutilizando a distribuição e o cache existentes.\n'+installed.out,code:0};
 const space=await cmRun("df -Pk / | awk 'NR==2 {print $4}'",30);
 const available=Number(String(space.out||'').trim());
 if(space.code===0&&Number.isFinite(available)&&available>0&&available<600000)return{out:'Espaço insuficiente para instalar JDK 21 + Gradle 9.8.2. Há cerca de '+Math.round(available/1024)+' MB livres; libere espaço e tente novamente.\n',code:1};
 const deps=await cmInstallPackages(CM_PROFILES.gradle.pkgs,'Instalar Gradle 9.8.2 + Java 21?');
 if(deps.code)return deps;
 const version='9.8.2',sha='21bd5da2de49b642904077f38c0efdc7778e92b3ed0889392dca61b97e389607';
 const cmd=`set -eu
VERSION=${version}
EXPECTED=${sha}
BASE=/opt/gradle
TARGET="$BASE/gradle-$VERSION"
if [ ! -x "$TARGET/bin/gradle" ]; then
  ZIP="/tmp/gradle-$VERSION-bin.zip"
  trap 'rm -f "\${ZIP:-}"' EXIT
  echo "Baixando Gradle $VERSION (distribuição binária oficial)..."
  curl -fL --retry 3 --connect-timeout 25 --max-time 1200 "https://services.gradle.org/distributions/gradle-$VERSION-bin.zip" -o "$ZIP"
  printf '%s  %s\n' "$EXPECTED" "$ZIP" | sha256sum -c -
  mkdir -p "$BASE"
  unzip -q -o "$ZIP" -d "$BASE"
  rm -f "$ZIP"
fi
test -x "$TARGET/bin/gradle"
ln -sfn "$TARGET" "$BASE/current"
echo "Gradle $VERSION instalado em $BASE/current"
java -version 2>&1 | head -2
"$BASE/current/bin/gradle" --version`;
 const r=await cmRun(cmd,1500);await natCaps();save();
 return{out:(deps.out||'')+'\n'+r.out+(r.code?'\n❌ Gradle não foi instalado. Confira espaço, rede e o resultado do SHA-256.':'\n✅ Gradle oficial verificado e instalado.')+'\n',code:r.code||0};
}
async function cmTerminal(f,a){
 const v=a[0]||'help',sub=a[1]||'';
 if(v==='help')return{out:'CodeMobile Linux Toolkit\n  cm status                 diagnóstico rápido\n  cm doctor                 sistema, arquitetura, internet e espaço\n  cm internet               testar conectividade e DNS\n  cm linux                  preparar o Alpine automaticamente\n  cm install PROFILE        instalar perfil: core, java, gradle, maven, python, node, cpp, go, rust, ruby, php\n  cm packages               ferramentas disponíveis\n  cm pkg add NOME...        instalar pacotes Alpine\n  cm pkg search TERMO       procurar pacote\n  cm pkg info NOME          detalhes do pacote\n  cm pkg remove NOME...     remover pacote (confirmação)\n  cm update                 atualizar índices do Alpine\n  cm upgrade                atualizar pacotes (confirmação)\n  cm clean                  limpar caches APK/npm/pip (mantém Gradle)\n  cm cache                  mostrar uso dos caches e disco\n  cm env                    mostrar ambiente e diretório\n  cm gradle install         instalar JDK 21 + Gradle oficial verificado\n  cm gradle version         mostrar Java/Gradle\n  cm gradle wrapper         gerar Gradle Wrapper binário\n  cm gradle tune            configurar cache e limites para celular\n  cm gradle config-cache on|off habilitar/desabilitar cache de configuração\n  cm gradle cache           inspecionar cache Gradle\n  cm gradle tasks           listar tarefas\n  cm gradle build [TASK...] compilar pelo Wrapper ou Gradle\n  cm gradle test [TASK...]  executar testes\n  cm android doctor         diagnosticar SDK/ADB/Build Tools locais\n  cm android packages       mostrar SDK instalado e pacotes CI\n  cm android build          iniciar build completo pelo GitHub Actions\n\nTambém funcionam diretamente: apk, npm, npx, pip, python, git, curl, wget, make, cmake, clang, go e cargo.\nPython: prefira `python3 -m venv .venv && . .venv/bin/activate && pip install ...`.\nGit: `git clone`, `git pull`, `git push` e branches são Git real no Alpine.\nInstalação online: `npm install PACOTE`, `pip install PACOTE` (prefira venv), `go install`, `cargo install`, `gem install` e `composer require` usam os registries próprios.\n',code:0};
 if(v==='status')return{out:'Projeto: '+S.cur+'\nAmbiente: '+(NAT.toolsReady?'Alpine Linux configurado':NAT.ready?'Alpine básico':'mini-terminal')+'\nLinux disponível no APK: '+(NAT.available?'sim':'não')+'\nFerramentas: '+(CM_CAPS.length?CM_CAPS.join(', '):'(não detectadas)')+'\nGitHub: '+(S.gh&&S.gh.user?'@'+S.gh.user:'não conectado')+'\nRepositório: '+((pj().gh||{}).repo||'(não vinculado)')+'\nArquivos do projeto: '+Object.keys(pj().files).length+'\nCache de sincronização: '+Object.keys(pj().termSync||{}).length+' arquivos\n',code:0};
 if(v==='doctor'||v==='internet'){
  const c=await cmRun("printf 'Alpine: '; cat /etc/alpine-release 2>/dev/null || echo desconhecido; printf 'Arquitetura: '; uname -m; printf 'Kernel: '; uname -r; printf 'Java: '; (java -version 2>&1 | head -1) || true; printf 'Gradle: '; (gradle --version 2>/dev/null | head -4 | tail -1) || echo não-instalado; printf 'Node: '; node --version 2>/dev/null || echo não-instalado; printf 'Python: '; python3 --version 2>/dev/null || echo não-instalado; printf 'Espaço: '; df -h / 2>/dev/null | tail -1; printf 'DNS: '; cat /etc/resolv.conf 2>/dev/null | tr '\\n' ' '; printf '\\nInternet: '; curl -fsSI --max-time 12 https://dl-cdn.alpinelinux.org/alpine/ >/dev/null && echo OK || echo indisponível",45);
  return{out:c.out,code:c.code};
 }
 if(v==='packages')return{out:NAT.toolsReady?'Ferramentas detectadas:\n'+(CM_CAPS.join(' · ')||'(nenhuma)')+'\n\nPerfis: '+Object.entries(CM_PROFILES).map(([k,x])=>k+' ('+x.label+')').join(' | ')+'\nUse cm install gradle para baixar JDK 21 e Gradle 9.8.2 binário oficial com verificação SHA-256. Projetos com gradlew podem usar somente o Wrapper.\n':'Configure primeiro o Linux com `cm linux`.\n',code:NAT.toolsReady?0:1};
 if(v==='linux'||v==='install'&&sub==='linux'){await natInstall();return{out:'A configuração do Linux foi aberta.\n',code:0}}
 if(v==='install'){
  const profile=sub.toLowerCase(),pr=CM_PROFILES[profile];if(!pr)return{out:'Perfil desconhecido. Disponíveis: '+Object.keys(CM_PROFILES).join(', ')+'\n',code:2};
  if(!NAT.ready||!NAT.toolsReady)return{out:'Configure primeiro o Alpine: cm linux\n',code:1};
  if(profile==='gradle')return cmInstallGradle();
  return cmInstallPackages(pr.pkgs,'Instalar perfil '+pr.label+'?');
 }
 if(v==='pkg'&&sub==='add')return cmInstallPackages(a.slice(2).join(' ').split(/[ ,]+/).map(x=>x.trim()).filter(Boolean),'Instalar pacotes Linux?');
 if(v==='pkg'&&sub==='search'){
  const q=a[2];if(!q||!/^[a-z0-9*._+-]{1,60}$/i.test(q))return{out:'Uso: cm pkg search TERMO\n',code:2};return cmRun('apk search -v '+q,90);
 }
 if(v==='pkg'&&sub==='info'){
  const q=a[2];if(!q||!/^[a-z0-9+._-]{1,64}$/i.test(q))return{out:'Uso: cm pkg info NOME\n',code:2};return cmRun('apk info -a '+q,60);
 }
 if(v==='pkg'&&(sub==='list'||sub==='installed'))return cmRun('apk info -v | sort',45);
 if(v==='pkg'&&sub==='remove'){const names=a.slice(2).filter(x=>/^[a-z0-9][a-z0-9+._-]{0,63}$/i.test(x));if(!names.length||names.length!==a.length-2)return{out:'Uso: cm pkg remove NOME [NOME...]. Isso pode remover dependências que ficaram sem uso.\n',code:2};if(await dlg({title:'Remover pacotes?',text:'O Alpine pode remover dependências que não forem mais necessárias.\nPacotes: '+names.join(', '),btns:['Remover','Cancelar']})!==0)return{out:'Remoção cancelada.\n',code:1};const r=await cmRun('apk del '+names.join(' '),300);await natCaps();return r;}
 if(v==='update')return cmRun('apk update',180);
 if(v==='upgrade'){
  if(await dlg({title:'Atualizar o Alpine?',text:'O apk upgrade atualizará os pacotes instalados. Isso pode baixar arquivos grandes e alterar versões. O Linux privado do CodeMobile será modificado.',btns:['Atualizar pacotes','Cancelar']})!==0)return{out:'Atualização cancelada.\n',code:1};
  const r=await cmRun('apk upgrade',1200);await natCaps();return r;
 }
 if(v==='cache')return cmRun("echo 'Armazenamento:'; df -h / /work 2>/dev/null | head -3; echo; for d in /var/cache/apk /opt/gradle/current /root/.npm /root/.cache/pip /root/.gradle/caches /root/.gradle/wrapper/dists /work/node_modules; do [ -e \"$d\" ] && du -sh \"$d\" 2>/dev/null; done",60);
 if(v==='env')return cmRun("echo 'Projeto:'; pwd; echo 'Usuário:'; id; echo 'Arquitetura:'; uname -m; echo 'PATH:'; printf '%s\\n' \"$PATH\"; echo 'Caches:'; printf 'Gradle=%s\\nNPM=%s\\nPIP=%s\\n' \"$GRADLE_USER_HOME\" \"$npm_config_cache\" \"$PIP_CACHE_DIR\"",45);
 if(v==='clean'){
  if(await dlg({title:'Limpar caches?',text:'Remove caches de downloads do apk, npm e pip. Não apaga código do projeto, node_modules, ambientes virtuais ou builds.',btns:['Limpar caches','Cancelar']})!==0)return{out:'Limpeza cancelada.\n',code:1};
  return cmRun('apk cache clean; npm cache clean --force 2>/dev/null || true; python3 -m pip cache purge 2>/dev/null || true; rm -rf /root/.cache/pip/http-v2 /root/.cache/pip/wheels',300);
 }
 if(v==='gradle'){
  const action=sub||'version',tasks=a.slice(2);if(!NAT.ready||!NAT.toolsReady)return{out:'Configure o Linux primeiro.\n',code:1};
  if(action==='install')return cmInstallGradle();
  if(action==='version')return cmRun('java -version 2>&1; gradle --version',90);
  if(action==='wrapper')return cmRun('command -v gradle >/dev/null 2>&1 || { echo "Instale: cm install gradle"; exit 127; }; gradle wrapper --distribution-type bin',300);
  if(action==='tune'){
   const command=`mkdir -p /root/.gradle; F=/root/.gradle/gradle.properties; touch "$F"; setprop(){ if grep -q "^$1=" "$F"; then sed -i "s|^$1=.*|$1=$2|" "$F"; else printf '%s=%s\\n' "$1" "$2" >> "$F"; fi; }; setprop org.gradle.daemon false; setprop org.gradle.caching true; setprop org.gradle.parallel false; setprop org.gradle.workers.max 2; setprop org.gradle.vfs.watch false; setprop org.gradle.jvmargs '-Xmx512m -XX:MaxMetaspaceSize=192m -Dfile.encoding=UTF-8'; echo 'Configuração de baixo consumo salva em /root/.gradle/gradle.properties'; cat "$F"`;
   return cmRun(command,60);
  }
  if(action==='config-cache'){
   const mode=tasks[0];if(!['on','off'].includes(mode))return{out:'Uso: cm gradle config-cache on|off. Alguns plugins antigos podem ser incompatíveis; use off se o build falhar.\n',code:2};
   const val=mode==='on'?'true':'false';
   const command=`mkdir -p /root/.gradle; F=/root/.gradle/gradle.properties; touch "$F"; if grep -q '^org.gradle.configuration-cache=' "$F"; then sed -i 's/^org.gradle.configuration-cache=.*/org.gradle.configuration-cache=${val}/' "$F"; else echo 'org.gradle.configuration-cache=${val}' >> "$F"; fi; grep '^org.gradle.configuration-cache=' "$F"`;
   return cmRun(command,30);
  }
  if(action==='cache')return cmRun("echo 'Cache Gradle:'; for d in /root/.gradle/caches /root/.gradle/wrapper/dists; do [ -e \\\"$d\\\" ] && du -sh \\\"$d\\\"; done; echo 'Use --offline quando todas as dependências já estiverem em cache.'",45);
  if(action==='tasks'||action==='build'||action==='test'){
   const safe=tasks.filter(x=>/^(--offline|--refresh-dependencies|--stacktrace|--info|--quiet|--warning-mode=all|--configuration-cache|--no-configuration-cache|--parallel|--no-parallel|--max-workers=[1-4]|:[A-Za-z0-9_.:-]+|[A-Za-z][A-Za-z0-9_.:-]*)$/.test(x));if(safe.length!==tasks.length)return{out:'Argumento de tarefa inválido. Use nomes de tasks e flags documentadas como --offline.\n',code:2};
   const want=safe.length?safe:(action==='test'?['test']:action==='tasks'?['tasks']:['build']);
   const base='--no-daemon --build-cache --max-workers=2 --console=plain';
   const args=base+(want.length?' '+want.join(' '):'');
   const cmd='if [ -f ./gradlew ] && [ -f ./gradle/wrapper/gradle-wrapper.jar ]; then sh ./gradlew '+args+'; elif command -v gradle >/dev/null 2>&1; then gradle '+args+'; else echo "Sem Gradle: use cm install gradle ou adicione Gradle Wrapper (gradle/wrapper/gradle-wrapper.jar + gradlew)."; exit 127; fi';
   return cmRun(cmd,1500);
  }
  return{out:'Uso: cm gradle install|version|wrapper|tune|config-cache on|off|cache|tasks|build [TASK/FLAGS...]|test [TASK/FLAGS...]\n',code:2};
 }
 if(v==='android'){
  if(sub==='build')return ghTerminal('gh',['build',...a.slice(2)]);
  if(sub==='packages')return{out:`Pacotes Android instalados no runner GitHub Actions:
  platform-tools
  platforms;android-34
  build-tools;34.0.0
  JDK 17 (Temurin)
  Gradle Wrapper do projeto + cache Gradle

O SDK completo fica no runner x86_64 e não é copiado para o Alpine ARM64 do celular.
Use \`cm android build\` para executar o workflow e receber o APK como artefato.
`,code:0};
  const r=await cmRun('echo "=== Android toolchain local ==="; echo ANDROID_HOME=$ANDROID_HOME; echo ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT; for x in adb sdkmanager aapt aapt2 zipalign apksigner d8; do printf "%-12s" "$x"; command -v "$x" || echo ausente; done; echo; echo "=== Java / Gradle ==="; java -version 2>&1 | head -2 || true; gradle --version 2>/dev/null | head -4 || echo "Gradle global não instalado"; echo; echo "O Alpine ARM64 via proot é o Linux de desenvolvimento. O Android SDK oficial e Build Tools são instalados no runner Ubuntu x86_64 para evitar distribuir um SDK incompatível no APK."',45);
  return r;
 }
 return{out:'Uso: cm help\n',code:2};
}
VSH.x.gh=async(f,a)=>ghTerminal(f,a);VSH.x.cm=async(f,a)=>cmTerminal(f,a);VSH.names=[...new Set([...VSH.names,'gh','cm'])].sort();
async function srvShell(a){const cmd=String(a.cmd||'').trim();if(!cmd)return'Erro: cmd vazio';
 if(S.mode=='plan')return'Modo plano: comandos bloqueados. Apresente o plano e peça aprovação.';
 const risky=/\b(rm|mv|dd|chmod|chown|sudo|kill|pkill|curl|wget)\b|git\s+(push|reset|clean)|npm\s+(publish|i(nstall)?\s+-g)|>\s*\S|\|\s*(sh|bash)/.test(cmd);
 if((S.mode=='ask'||(S.mode=='edits'&&risky))&&(await dlg({title:'Executar no terminal?',text:cmd.slice(0,400),btns:['✅ Executar','🚫 Negar']}))!==0)return'Negado: o usuário não autorizou este comando.';
 let r;try{r=await shellRun(cmd,a.timeout)}catch(e){return'Erro no terminal: '+e.message}
 if(r.nm.length){save();ui()}
 return'$ '+cmd+'\n'+r.out+(r.out&&!r.out.endsWith('\n')?'\n':'')+'[exit '+r.code+(r.to?' — TEMPO ESGOTADO':'')+']'+(real()&&r.nm.length?'\n'+r.nm.length+' arquivo(s) sincronizados: '+r.nm.slice(0,15).join(', '):'')}
/* deixa claro para o agente o que ele tem */
function shellPrompt(){const L=CM_CAPS.length?CM_CAPS.join(' '):'git python3 node npm pip rg jq curl';
 if(S.fast)return'\nSHELL: '+(real()?'Alpine/proot com rede e ferramentas: '+L:'mini-terminal local; gh/cm integrados')+'. Use `cm doctor`, `cm install gradle` e `cm gradle build`; cada comando é não interativo.';
 return real()?'\nTERMINAL LINUX (Alpine/aarch64 via proot): shell sh não interativo, rede, apk, Git, Node/npm/npx, Python/pip, curl/wget, compiladores e ferramentas: '+L+'. Instale perfis sob demanda com `cm install java|gradle|maven|python|node|cpp|go|rust|ruby|php`; `cm pkg search/add/info`; `cm doctor`; `cm gradle wrapper|tune|build|test`. Gradle usa GRADLE_USER_HOME persistente, cache e 2 workers; prefira ./gradlew do projeto. `npm install` baixa dependências para node_modules persistente; para Python use venv. O diretório atual é enviado em cwd e os arquivos são sincronizados por delta. Binários, caches, node_modules e outputs de build ficam no disco Linux e não são importados para o editor. Não há TTY, stdin interativo ou serviços Android completos; Android APK deve usar GitHub Actions. `gh` gerencia repositório/build remoto; confirme escritas remotas.'
 :'\nMINI-TERMINAL CodeMobile: ls, cat, head, tail, wc, grep, rg, find, tree, sed, awk, cut, tr, sort, uniq, diff, jq, xargs, tee, printf, seq, echo, mkdir, touch, rm, mv, cp, cd, pwd, test/[ ], basename, dirname, du, stat, base64, sha256sum, curl/wget limitado, Python (Pyodide), Node (JS embutido) e npm run/test com scripts locais. Suporta pipes, &&, ||, ;, redirecionamento, globs e variáveis. Git local: init/add/commit/status/diff/log/branch/checkout/reset/restore/rm. GitHub pela extensão integrada: `gh status`, `gh repo list/create/clone/sync/publish`, `gh workflow list`, `gh build`, `gh run list/view`. `cm status` e `cm linux` diagnosticam/configuram o ambiente. Para npm install, pip, npx, compiladores e Git completo, toque em Configurar Linux; não precisa executar `.sh` nem instalar ferramentas manualmente.'}
/* o prompt do terminal é anexado pelo sys() do ext.js (shellPrompt) */

/* ---- aba Terminal (para você usar também) ---- */
const TM={log:'',h:[],i:0,busy:0};
function termBanner(){const env=NAT.toolsReady?'Alpine Linux completo':CM_SRV?'Servidor auxiliar conectado':NAT.available?'Mini-terminal · Linux disponível para configurar':'Mini-terminal';return'CodeMobile Terminal · '+env+'\nProjeto: '+S.cur+' · '+Object.keys(pj().files).length+' arquivos\n'+(NAT.toolsReady?'Alpine real · apk · Git · npm/pip · compiladores opcionais · Gradle sob demanda':NAT.available?'Toque em “Configurar Linux” para instalar o ambiente base automaticamente':'Modo local com Git básico + comandos CodeMobile `gh` e `cm`')+'\nDigite help, gh help ou cm help.\n\n'}
function termPath(){return TM.cwd?'/'+TM.cwd:'/'}
function termR(){if(!TM.log)TM.log=termBanner();const t=$('#term'),isReal=real();
 const chips=['help','ls -la','tree -L 3','git status','gh status','gh build','cm doctor','cm install gradle','cm gradle version','cm gradle tune','cm gradle build','cm cache','npm test','clear'];
 t.innerHTML='<div class="term-toolbar"><div><b>'+(NAT.toolsReady?'🐧 Alpine Linux':CM_SRV?'⌨️ Terminal conectado':'⌨️ CodeMobile Terminal')+'</b><small>'+(NAT.toolsReady?'Linux completo · '+CM_CAPS.length+' ferramentas':NAT.available?'ambiente pronto para configuração automática':'modo local · GitHub integrado')+'</small></div><div class="r"><button class="s" data-c="__refresh">↻</button><button class="s" data-c="clear">Limpar</button></div></div><div class="term-env"><span class="term-led '+(NAT.toolsReady?'ok':NAT.available?'wait':'local')+'"></span><div><b>'+(NAT.toolsReady?'Ambiente profissional ativo':NAT.available?'Linux completo disponível':'Mini-terminal ativo')+'</b><small>'+(NAT.toolsReady?'Gerenciador apk, rede e ferramentas instaladas':NAT.available?'Uma configuração instala tudo automaticamente':'Arquivos do projeto e GitHub Actions integrados')+'</small></div>'+(NAT.available&&!NAT.toolsReady?'<button class="p" data-c="__install">Configurar Linux</button>':'')+'</div><pre id="tout">'+esc(TM.log)+'</pre><div class="term-prompt"><span>cm:'+esc(termPath())+' $</span><input id="tin" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="git status · gh build · npm test…"><button class="p" id="tgo">↵</button></div><div class="term-shortcuts">'+chips.map(c=>'<button class="ch" data-c="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div><div class="term-help"><small>Atalhos: ↑/↓ histórico · Tab completar · Ctrl+L limpar · `cm install` instala ferramentas · `cm gradle` automatiza builds. Shell não interativo.</small></div>';
 const o=$('#tout');o.scrollTop=1e9}
function termNorm(path){let a=String(path||'').trim().replace(/^['"]|['"]$/g,'');if(!a||a==='~')return'';if(a.startsWith('/'))a=a.replace(/^\/+/, '');const out=a.startsWith('./')?TM.cwd.split('/').filter(Boolean):TM.cwd.split('/').filter(Boolean);for(const x of a.split('/'))if(x&&x!=='.')x==='..'?out.pop():out.push(x);return out.join('/')}
const termQuote=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";
async function termExec(cmd){cmd=String(cmd||'').trim();if(!cmd||TM.busy)return;if(cmd==='clear'){TM.log=termBanner();return termR()}
 if(cmd==='__refresh'){await cmProbe();await natProbe();TM.log=termBanner();termR();return}
 if(cmd==='__connect'){const ok=await cmProbe();await natProbe();TM.log+='\n'+(NAT.toolsReady?'Linux Alpine completo ativo.':ok?'Servidor auxiliar conectado.':NAT.available?'Linux disponível. Toque em Configurar Linux para instalar tudo.':'Mini-terminal ativo; conecte GitHub em Ajustes para usar gh/build.')+'\n';termR();return}
 if(cmd==='__install'){await natInstall();return}
 try{const tk=vTok(cmd);if(tk[0]&&tk[0].v==='cd'&&tk.length<=2){const next=termNorm(tk[1]&&tk[1].v||'');if(real()){const test=await shellRun('test -d '+termQuote(next?'/work/'+next:'/work'),20);if(test.code!==0){TM.log+='$ '+cmd+'\ncd: diretório não encontrado: '+(tk[1]&&tk[1].v||'~')+'\n';termR();return}}else{const p=pj();VSH.dirs=new Set(p.dirs||[]);for(const k of Object.keys(p.files)){let ss=k.split('/');ss.pop();let d='';for(const z of ss){d=d?d+'/'+z:z;VSH.dirs.add(d)}}if(!vIsDir(p.files,next)){TM.log+='$ '+cmd+'\ncd: diretório não encontrado: '+(tk[1]&&tk[1].v||'~')+'\n';termR();return}}TM.cwd=next;pj().termCwd=next;VSH.cwd=next;save();TM.log+='$ '+cmd+'\n';termR();return}}catch(e){}
 TM.h=Array.isArray(pj().termHistory)?pj().termHistory:TM.h;TM.h.push(cmd);TM.h=TM.h.slice(-100);pj().termHistory=TM.h;TM.i=TM.h.length;save();TM.busy=1;TM.log+='$ '+cmd+'\n';termR();let r;try{const p=pj();p.termCwd=TM.cwd||'';const runCmd=cmd;r=await shellRun(runCmd,900)}catch(e){r={out:'erro: '+e.message+'\n',code:1,nm:[]}}
 TM.log+=r.out+(r.out&&!r.out.endsWith('\n')?'\n':'')+(r.code?'[exit '+r.code+']\n':'');TM.log=TM.log.slice(-50000);TM.busy=0;if(r.nm&&r.nm.length){const p=pj();if(!real())p.dirs=[...VSH.dirs];save();ui()}termR();$('#tin').focus()}
$('#term').addEventListener('click',e=>{const c=e.target.closest('[data-c]');if(c){const v=c.dataset.c;if(v==='↑'){if(TM.h.length){TM.i=Math.max(0,TM.i-1);$('#tin').value=TM.h[TM.i]||'';$('#tin').focus()}return}return termExec(v)}if(e.target.id==='tgo')termExec($('#tin').value)});
$('#term').addEventListener('keydown',e=>{if(e.target.id!=='tin')return;if(e.key==='Enter'){e.preventDefault();termExec(e.target.value)}else if(e.key==='ArrowUp'){e.preventDefault();TM.i=Math.max(0,TM.i-1);e.target.value=TM.h[TM.i]||''}else if(e.key==='ArrowDown'){e.preventDefault();TM.i=Math.min(TM.h.length,TM.i+1);e.target.value=TM.h[TM.i]||''}else if(e.key==='Tab'){e.preventDefault();const v=e.target.value.trim(),cmds=['git','gh','cm','ls','cd','pwd','tree','npm','python','node','mkdir','touch','cat','grep','rg','find','help'];const m=cmds.filter(x=>x.startsWith(v));if(m.length===1)e.target.value=m[0]+' ';else if(m.length>1){TM.log+='\n'+m.join('  ')+'\n';termR();$('#tin').value=v}}else if(e.key.toLowerCase()==='l'&&e.ctrlKey){e.preventDefault();termExec('clear')}});
$$('nav button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.t==='term'){TM.cwd=pj().termCwd||'';TM.h=Array.isArray(pj().termHistory)?pj().termHistory:[];TM.i=TM.h.length;VSH.cwd=TM.cwd;termR();natProbe().then(()=>{if($('#term')&&$('#term').classList.contains('on'))termR()});cmProbe()}}));
/* ---- várias conversas por projeto (drawer estilo Claude) ---- */
function chatsInit(p){if(!p.chats){p.chats=[{n:'Novo chat'}];p.cc=0}}
function chatSwitch(i){if(busy)return alert('Aguarde a tarefa terminar');const p=pj();chatsInit(p);if(i==p.cc||!p.chats[i])return;const o=p.chats[p.cc];o.hist=p.hist;o.todos=p.todos;const n=p.chats[i];p.hist=n.hist||[];p.todos=n.todos||[];delete n.hist;delete n.todos;p.cc=i;save();ui()}
function chatNew(){if(busy)return alert('Aguarde a tarefa terminar');const p=pj();chatsInit(p);if(!p.hist.length&&p.chats.length&&p.chats[p.cc].n=='Novo chat')return;p.chats.push({n:'Novo chat',hist:[],todos:[]});chatSwitch(p.chats.length-1)}
function chatRen(){const p=pj();chatsInit(p);const n=prompt('Novo nome da conversa',p.chats[p.cc].n);if(n&&n.trim()){p.chats[p.cc].n=n.trim().slice(0,40);save();ui()}}
function chatDel(){if(busy)return alert('Aguarde a tarefa terminar');const p=pj();chatsInit(p);if(p.chats.length<2){p.hist=[];p.todos=[];p.chats[0].n='Novo chat';save();return ui()}if(!confirm('Apagar a conversa "'+p.chats[p.cc].n+'"? Os arquivos do projeto não são afetados.'))return;p.chats.splice(p.cc,1);const k=Math.max(0,p.cc-1),n=p.chats[k];p.cc=k;p.hist=n.hist||[];p.todos=n.todos||[];delete n.hist;delete n.todos;save();ui()}
const chatLen=(p,i)=>((i==p.cc?p.hist:p.chats[i].hist)||[]).filter(m=>m.role=='user'&&m.text[0]!='[').length;
function drawerR(){const p=pj();chatsInit(p);const q=(($('#dsq')||{}).value||'').toLowerCase();
 $('#dlist').innerHTML=p.chats.map((c,i)=>({c,i})).filter(x=>!q||x.c.n.toLowerCase().includes(q)).reverse().map(({c,i})=>'<div class="cr'+(i==p.cc?' on':'')+'" data-c="'+i+'"><span class="n">'+esc(c.n)+'</span><small>'+chatLen(p,i)+'</small>'+(i==p.cc?'<span class="ca" data-a="ren">✏️</span><span class="ca" data-a="del">🗑</span>':'')+'</div>').join('')||'<div style="color:var(--m);padding:8px">Nenhuma conversa</div>'}
function chatMenu(open=true){const d=$('#dr');if(!open){d.hidden=true;return}if(typeof menu=='function')menu(1);ui();drawerR();d.hidden=false}
$('#dr').addEventListener('click',e=>{const t=e.target.closest('[data-c],[data-a],.bk');if(!t)return;
 if(t.classList.contains('bk')||t.dataset.a=='close')return chatMenu(false);
 if(t.dataset.a=='new'){chatNew();return chatMenu(false)}if(t.dataset.a=='ren'){chatRen();return drawerR()}if(t.dataset.a=='del'){chatDel();return drawerR()}
 if(t.dataset.a=='proj'){chatMenu(false);return newP()}if(t.dataset.a=='cfg'){chatMenu(false);return $$('nav button')[3].click()}
 if(t.dataset.c!=null){chatSwitch(+t.dataset.c);chatMenu(false)}});
$('#dsq').addEventListener('input',drawerR);
$('#ps').addEventListener('change',()=>{drawerR()});
/* título da conversa a partir do 1º pedido */
const _run=run;run=function(t){const p=pj();chatsInit(p);if(t!=null&&!p.hist.some(m=>m.role=='user')&&/^(Conversa \d+|Novo chat)$/.test(p.chats[p.cc].n)){const n=String(t).split('\n\n[')[0].replace(/\s+/g,' ').trim().slice(0,32);if(n&&n[0]!='/')p.chats[p.cc].n=n}return _run(t)};
function ttlR(){const p=pj();chatsInit(p);$('#ttl').innerHTML='<b>'+esc(p.chats[p.cc].n)+'</b><small>'+esc(S.cur)+'</small>'}
const _ui=ui;ui=function(){_ui();ttlR()};
function welcomeH(){const h=new Date().getHours(),g=h<5?'Boa madrugada':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';return'<div class="wl"><div class="lg">✻</div><h1>'+g+'</h1><p>O que vamos construir hoje?</p></div>'}
function cmMenu(){const p=pj();chatsInit(p);return[['💬','Conversas: '+p.chats[p.cc].n,'Abrir a lista de conversas e criar uma nova',chatMenu],
 ['💻','Terminal: '+(NAT.toolsReady?'Linux completo':NAT.available?'configurar Linux':'mini-terminal'),NAT.toolsReady?'Alpine Linux pronto: Git, Python, Node, npm, SSH e ferramentas':NAT.available?'Toque para instalar e configurar tudo automaticamente':'Mini-terminal com Git local e integração GitHub/Actions',async()=>{if(NAT.available&&!NAT.toolsReady)return natInstall();if(NAT.toolsReady)return alert('Linux completo ativo: '+CM_CAPS.join(' '));const ok=await cmProbe();alert(ok?'Servidor auxiliar conectado.':'Mini-terminal ativo. Conecte o GitHub em Ajustes para publicar e gerar builds.')}]]}
/* comandos extras (/init e /walkthrough) */
if(S.cmds!=null&&!/^init\s*=/m.test(S.cmds))S.cmds+='\ninit = Explore o projeto (use o shell: ls, tree, rg) e crie ou atualize o AGENTS.md na raiz: visão geral, estrutura de pastas, comandos de build/teste, convenções e armadilhas. Máximo 60 linhas, direto ao ponto. $ARGS\nwalkthrough = Escreva WALKTHROUGH.md resumindo o que foi feito nesta conversa: plano, arquivos alterados, como testar e pendências. $ARGS';
/* estado em disco (sem chaves de API nem token do GitHub) */
let _st=0;function cmSync(){if(!CM_SRV)return;clearTimeout(_st);_st=setTimeout(()=>{try{const{keys,gh,mcp,...rest}=S,ts=Date.now();localStorage.setItem('cm2ts',ts);cmApi('state',{method:'PUT',body:JSON.stringify({ts,state:rest})}).catch(()=>{})}catch(e){}},2500)}
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
if(CM_SRV&&!CM_CAP)cmCaps();
if(CM_CAP){natProbe().then(()=>ui());cmProbe();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!CM_SRV)cmProbe()})}
ui();
