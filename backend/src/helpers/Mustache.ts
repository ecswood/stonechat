import Mustache from "mustache";
import Contact from "../models/Contact";
import { getBrasiliaParts } from "./GreetingByTime";

export const greeting = (date: Date = new Date()): string => {
  const greetings = ["Boa madrugada", "Bom dia", "Boa tarde", "Boa noite"];
  const { hour } = getBrasiliaParts(date);
  // eslint-disable-next-line no-bitwise
  return greetings[(hour / 6) >> 0];
};

export const firstName = (contact?: Contact): string => {
  if (contact && contact?.name) {
    const nameArr = contact?.name.split(' ');
    return nameArr[0];
  }
  return '';
};

export default (body: string, contact: Contact, date: Date = new Date()): string => {
  let ms = "";

  const { year, month, day, hour, minute, second } = getBrasiliaParts(date);

  const dd: string = `0${day}`.slice(-2);
  const mm: string = `0${month}`.slice(-2);
  const yy: string = String(year);
  const hh: number = hour;
  const min: string = `0${minute}`.slice(-2);
  const ss: string = `0${second}`.slice(-2);

  if (hh >= 6) {
    ms = "Bom dia";
  }
  if (hh > 11) {
    ms = "Boa tarde";
  }
  if (hh > 17) {
    ms = "Boa noite";
  }
  if (hh > 23 || hh < 6) {
    ms = "Boa madrugada";
  }

  const protocol = yy + mm + dd + String(hh) + min + ss;

  const hora = `${hh}:${min}:${ss}`;

  const view = {
    firstName: firstName(contact),
    name: contact ? contact.name : "",
    gretting: greeting(date),
    ms,
    protocol,
    hora
  };
  return Mustache.render(body, view);
};
