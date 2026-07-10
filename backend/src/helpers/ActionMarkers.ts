export const ACTION_MARKERS = {
  transferirAtendimento: "Ação: Transferir para Atendimento",
  transferirTecnico: "Ação: Transferir para Técnico",
  buscarBoleto: "Ação: Buscar Boleto",
  liberarConfianca: "Ação: Liberar Confiança",
  desvincularCpf: "Ação: Desvincular CPF",
  verificarBloqueio: "Ação: Verificar Bloqueio",
  encerrarAtendimento: "Ação: Encerrar Atendimento"
} as const;

// O modelo às vezes promete uma ação ("Vou liberar a conexão...") sem
// incluir a frase-gatilho exigida, deixando o cliente sem resposta (a
// ação nunca dispara). Usado como sinal pra decidir se vale a pena
// insistir com o modelo antes de aceitar a resposta como definitiva.
export const hasAnyActionMarker = (responseText: string): boolean =>
  Object.values(ACTION_MARKERS).some(marker => responseText.includes(marker));
