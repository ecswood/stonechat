// msg.status vem null/undefined para mensagens recebidas (o ack só existe
// de verdade pra mensagens que a gente envia). A coluna "ack" do Messages
// é NOT NULL - salvar null derruba o upsert inteiro (e com ele o
// processamento da mensagem, incluindo a IA) com "null value in column ack".
const resolveAckStatus = (status: number | null | undefined): number =>
  status ?? 0;

export default resolveAckStatus;
