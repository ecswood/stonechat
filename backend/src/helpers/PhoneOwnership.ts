// Números de WhatsApp neste projeto às vezes perdem o 9º dígito do celular
// na hora de salvar (bug antigo já documentado), e o SGP formata telefone
// com parênteses/traço, sem DDI. Comparar pelos últimos 8 dígitos (a linha,
// sem DDI/DDD/9) resolve as duas ambiguidades de uma vez.
const last8Digits = (phone: string): string => phone.replace(/\D/g, "").slice(-8);

const phoneOwnershipMatches = (
  waNumber: string,
  sgpTelefones: string[]
): boolean => {
  const waDigits = last8Digits(waNumber);
  return sgpTelefones.some(tel => last8Digits(tel) === waDigits);
};

export default phoneOwnershipMatches;
