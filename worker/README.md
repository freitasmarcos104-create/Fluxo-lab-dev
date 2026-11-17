# Fluxo Lab Worker V5.13.0

Fonte oficial do Worker de produção. Navegador, Windows e Android continuam usando o mesmo Worker e banco.

- Endereço oficial: https://app.markfree.com.br/
- Worker: fluxo-lab
- Ponto de entrada: worker/index.js

## Novidade da V5.13.0

O antigo **Chat equipe Digital** agora é o **Chat Geral do Fluxo Lab**. Digital, Convencional, Almoxarifado e os perfis de gestão participam do mesmo canal, com histórico, mensagens favoritas, expiração de 48 horas, atualização automática, som e notificações preservados.

A atualização reutiliza a tabela existente `chat_equipe_digital`; não cria um novo histórico nem duplica conversas. As rotas e chamadas internas antigas continuam compatíveis. A tabela vazia `almoxarifado_chat_mensagens`, criada na V5.12.0 e nunca utilizada, é removida pela migração aditiva `0004_v5130_remove_almoxarifado_chat.sql`.

## Novidade da V5.12.0

O Almoxarifado abre dentro do layout padrão do Fluxo Lab pela barra lateral. Funcionários comuns consultam materiais e fazem requisições; Almoxarifes têm gestão de estoque e não acessam produção.

## Novidade da V5.11.0

O funcionário com vínculo ativo de Almoxarife entra diretamente no Almoxarifado. O Worker bloqueia páginas e APIs gerais de produção para esse perfil, mantendo ferramentas do Espaço do Colaborador.

## Novidade da V5.9.0

Minhas anotações oferece negrito e marca-texto colorido, mantendo compatibilidade com anotações antigas.

## Caminho único de atualização

- Desenvolver em `worker/` e abrir Pull Request para `main`.
- GitHub Actions valida sintaxe, configuração Cloudflare e testes.
- Após merge aprovado, o job oficial publica a pasta no Worker `fluxo-lab`.
- O deploy não executa migrações D1. Migrações são aplicadas como etapas separadas, revisadas e registradas.
- Não criar Workers ou bancos paralelos.

## Banco e bindings oficiais

- D1: `fluxo-lab-db` (`1806ff34-36f6-4cfc-a6df-aa2f5e04b6c6`)
- R2: `fluxo-lab-downloads`, `fluxo-lab-importacoes`, `fluxo-lab-stl`
- Workers AI: binding `AI`

Não alterar bindings nem criar recursos substitutos sem revisão.
