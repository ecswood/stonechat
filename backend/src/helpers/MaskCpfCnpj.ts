export const maskCpfCnpj = (value: string): string => {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/^(\d{3})\d{3}\d{3}(\d{2})$/, "$1.XXX.XXX-$2");
  }

  if (digits.length === 14) {
    return digits.replace(/^(\d{2})\d{3}\d{3}\d{4}(\d{2})$/, "$1.XXX.XXX/XXXX-$2");
  }

  return value;
};
