import { getBrasiliaParts } from "./GreetingByTime";

export const buildTicketProtocol = (
  ticketId: number,
  date: Date = new Date()
): string => {
  const { year, month, day } = getBrasiliaParts(date);
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${year}${dd}${mm}${ticketId}`;
};
