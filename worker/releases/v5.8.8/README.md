# Fluxo Lab Worker V5.8.8

Versão oficial central do Fluxo Lab. O navegador, o aplicativo Windows e o aplicativo Android acessam o mesmo sistema em produção:

- **Endereço oficial:** https://app.markfree.com.br/
- **Worker:** `fluxo-lab`
- **Módulos:** 27
- **D1 de produção:** `fluxo-lab-db`
- **Buckets de produção:** `fluxo-lab-downloads`, `fluxo-lab-importacoes` e `fluxo-lab-stl`

## Novidades desta versão

- **Missão Cumprida:** primeira tarefa criada por ADMINISTRADOR, atribuída a outra pessoa e concluída pelo próprio responsável. O prazo não interfere.
- **Pontualidade de Ouro:** 20 tarefas criadas por ADMINISTRADOR, atribuídas a outra pessoa e concluídas pelo próprio responsável até a data limite.
- Tarefas sem prazo não contam para pontualidade.
- Tarefas canceladas, reabertas, concluídas pela administração ou autoatribuídas não contam.
- **Resgate Digital não faz parte do catálogo.**
- A coleção antiga de emblemas permanece preservada.
- A etiqueta visível do sistema e o cache PWA identificam a V5.8.8.

## Instalação dos aplicativos

Os aplicativos são clientes do sistema central e não possuem banco de dados próprio.

- Windows: cliente Electron 0.1.5, conectado a `https://app.markfree.com.br/`.
- Android: APK 0.1.5, `versionCode=5`, mesmo `applicationId` e mesma assinatura permanente.
- Downloads oficiais: `/downloads/windows` e `/downloads/android`.

Atualizações de telas, regras, tarefas, emblemas e dados são publicadas no Worker central. Não é necessário gerar novo EXE ou APK para cada atualização do sistema. Os instaladores só precisam ser reconstruídos quando houver mudanças específicas dos clientes nativos.

## Dados e segurança

- Nenhuma migração ou alteração de schema D1 nesta entrega.
- O D1 e os três buckets de produção permanecem vinculados ao Worker oficial.
- O Worker de homologação foi desativado. Os recursos D1/R2 de teste foram preservados como arquivo e não estão conectados ao aplicativo oficial.
- Os instaladores 0.1.4 permanecem arquivados no R2, mas não são oferecidos pelas rotas oficiais.
