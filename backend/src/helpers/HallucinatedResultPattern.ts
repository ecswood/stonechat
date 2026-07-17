// Padrão único, compartilhado, pra detectar quando a IA afirma um RESULTADO
// de consulta (CPF não cadastrado, sem fatura em aberto, etc.) que só a
// Ação correspondente pode confirmar de verdade. Usado tanto pra decidir se
// vale insistir com o modelo (EnsureActionMarker) quanto pra sanitizar a
// narração antes de uma Ação já presente (AiAgentActions/dispatchAiAction) -
// fonte única pra evitar os dois ficarem dessincronizados.
export const HALLUCINATED_RESULT_PATTERN =
  /\bn[ãa]o\s+(consegui\s+)?(localiz\w+|encontr\w+|est[áa]\s+cadastrad\w*|consta\w*|h[áa]\s+cadastro)\b/i;
