export function validaCpfCnpj(val: string): boolean {
  if (val.length === 11) {
    let cpf = val.trim();

    cpf = cpf.replace(/\./g, "");
    cpf = cpf.replace("-", "");
    const digits = cpf.split("");

    let v1 = 0;
    let v2 = 0;
    let aux = false;

    for (let i = 1; digits.length > i; i++) {
      if (digits[i - 1] !== digits[i]) {
        aux = true;
      }
    }

    if (aux === false) {
      return false;
    }

    for (let i = 0, p = 10; digits.length - 2 > i; i++, p--) {
      v1 += Number(digits[i]) * p;
    }

    v1 = (v1 * 10) % 11;

    if (v1 === 10) {
      v1 = 0;
    }

    if (v1 !== Number(digits[9])) {
      return false;
    }

    for (let i = 0, p = 11; digits.length - 1 > i; i++, p--) {
      v2 += Number(digits[i]) * p;
    }

    v2 = (v2 * 10) % 11;

    if (v2 === 10) {
      v2 = 0;
    }

    return v2 === Number(digits[10]);
  }

  if (val.length === 14) {
    let cnpj = val.trim();

    cnpj = cnpj.replace(/\./g, "");
    cnpj = cnpj.replace("-", "");
    cnpj = cnpj.replace("/", "");
    const digits = cnpj.split("");

    let v1 = 0;
    let v2 = 0;
    let aux = false;

    for (let i = 1; digits.length > i; i++) {
      if (digits[i - 1] !== digits[i]) {
        aux = true;
      }
    }

    if (aux === false) {
      return false;
    }

    for (let i = 0, p1 = 5, p2 = 13; digits.length - 2 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v1 += Number(digits[i]) * p1;
      } else {
        v1 += Number(digits[i]) * p2;
      }
    }

    v1 %= 11;
    v1 = v1 < 2 ? 0 : 11 - v1;

    if (v1 !== Number(digits[12])) {
      return false;
    }

    for (let i = 0, p1 = 6, p2 = 14; digits.length - 1 > i; i++, p1--, p2--) {
      if (p1 >= 2) {
        v2 += Number(digits[i]) * p1;
      } else {
        v2 += Number(digits[i]) * p2;
      }
    }

    v2 %= 11;
    v2 = v2 < 2 ? 0 : 11 - v2;

    return v2 === Number(digits[13]);
  }

  return false;
}
