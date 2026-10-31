# Plano hostmel-3.1d — NeoForge legado da 1.20.1 e `redirect:"error"` no `buscarPadrao`

Método M1 (+M4). Sem decisão do Eliel.

1. `resolverNeoForge` ganha o parâmetro `artefato` (`'neoforge'` padrão | `'forge'`): o `'forge'` usa o caminho Maven
   `net/neoforged/forge/<v>/forge-<v>-installer.jar` (1.20.1-47.1.x). Mesma tabela de hashes e mesma conferência
   sidecar × tabela. Nenhum hash inventado: a tabela continua vazia; sem entrada o resolvedor recusa.
2. `buscarPadrao` (versoes.ts): `redirect: "error"`, recusa por `content-length` acima de 8 MB sem ler nada, e leitura
   em pedaços (`getReader`) cortando em 8 MB quando não há `content-length`. O prazo de 15 s continua.
3. Testes primeiro (falham antes): redirect vira erro; content-length acima do teto não lê o corpo; corpo sem
   content-length é cortado; forge legado com hash fixado aceita e com sidecar errado recusa.
4. Pendência: sha1 do instalador forge 1.20.1 não alcançável daqui (Maven bloqueado) → "P: confirmar sha1 do forge 1.20.1".
