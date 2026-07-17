interface BrasiliaParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const BRASILIA_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export const getBrasiliaParts = (date: Date = new Date()): BrasiliaParts => {
  const parts = BRASILIA_FORMATTER.formatToParts(date);
  const get = (type: string): number =>
    Number(parts.find(p => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // Intl retorna "24" pra meia-noite em vez de "0"
    minute: get("minute"),
    second: get("second")
  };
};

export const getBrasiliaHour = (date: Date = new Date()): number =>
  getBrasiliaParts(date).hour;

export const getGreetingForBrasiliaTime = (date: Date = new Date()): string => {
  const hour = getBrasiliaHour(date);

  if (hour >= 6 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  if (hour >= 18) return "Boa noite";
  return "Boa madrugada";
};
