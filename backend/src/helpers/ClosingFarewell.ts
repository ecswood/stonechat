const closingFarewell = (hour: number): string => {
  if (hour < 6) return "Tenha uma boa madrugada!";
  if (hour < 12) return "Tenha um bom dia!";
  if (hour < 18) return "Tenha uma boa tarde!";
  return "Tenha uma boa noite!";
};

export default closingFarewell;
