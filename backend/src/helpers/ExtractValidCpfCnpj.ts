import { validaCpfCnpj } from "./ValidateCpfCnpj";

export const extractValidCpfCnpj = (bodyMessage: string): string | null => {
  const digits = bodyMessage.replace(/\D/g, "");

  if (digits.length !== 11 && digits.length !== 14) {
    return null;
  }

  return validaCpfCnpj(digits) ? digits : null;
};
