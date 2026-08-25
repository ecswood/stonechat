import { Op, Includeable } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  companyId: number;
  profile: string;
  queueIds: number[];
}

interface Response {
  ia: Ticket[];
  aguardando: Ticket[];
  atendendo: Ticket[];
}

const includeCondition: Includeable[] = [
  {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number", "profilePicUrl"]
  },
  { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
  { model: User, as: "user", attributes: ["id", "name"] },
  { model: Tag, as: "tags", attributes: ["id", "name", "color"] },
  { model: Whatsapp, as: "whatsapp", attributes: ["name"] }
];

const ListTicketsServicePipeline = async ({
  companyId,
  profile,
  queueIds
}: Request): Promise<Response> => {
  const ia = await Ticket.findAll({
    where: { companyId, status: "pending", queueId: null, userId: null },
    include: includeCondition,
    order: [["updatedAt", "DESC"]]
  });

  const aguardandoWhere: any = {
    companyId,
    status: "pending",
    queueId: { [Op.ne]: null },
    userId: null
  };

  if (profile !== "admin") {
    aguardandoWhere.queueId = {
      [Op.and]: [{ [Op.ne]: null }, { [Op.in]: queueIds }]
    };
  }

  const aguardando = await Ticket.findAll({
    where: aguardandoWhere,
    include: includeCondition,
    order: [["updatedAt", "DESC"]]
  });

  // Antes exigia status "open" - mas um ticket pode ficar atribuído a um
  // usuário (userId setado) e ainda estar "pending" (nunca formalmente
  // aceito, ex: atribuição automática, ou o botão "Voltar atendimento
  // para IA" acionado antes do aceite) e nesse caso não aparecia em
  // NENHUMA das 3 colunas - regressão real 2026-08-25 (ticket do
  // Fabricio: pending + userId setado + aiTakeover, sumiu da lista).
  // Qualquer ticket não fechado com userId setado agora conta como
  // "Atendendo", independente do status exato.
  const atendendo = await Ticket.findAll({
    where: {
      companyId,
      status: { [Op.ne]: "closed" },
      userId: { [Op.ne]: null }
    },
    include: includeCondition,
    order: [["updatedAt", "DESC"]]
  });

  return { ia, aguardando, atendendo };
};

export default ListTicketsServicePipeline;
