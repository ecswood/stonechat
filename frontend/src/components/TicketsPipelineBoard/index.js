import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Board from "react-trello";
import { useHistory } from "react-router-dom";

import { i18n } from "../../translate/i18n";
import usePipelineTickets from "../../hooks/usePipelineTickets";
import TicketMessagesDialog from "../TicketMessagesDialog";

const useStyles = makeStyles(() => ({
  root: {
    display: "flex",
    height: "100%",
    overflowX: "auto",
  },
  pullButton: {
    background: "#10a110",
    border: "none",
    padding: "6px",
    color: "white",
    fontWeight: "bold",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: 4,
    fontSize: "0.75rem",
  },
  seeButton: {
    marginTop: 4,
    cursor: "pointer",
    background: "none",
    border: "1px solid #ccc",
    borderRadius: "5px",
    padding: "5px",
    fontSize: "0.75rem",
  },
}));

const laneStyle = { width: 220 };
const cardStyle = { minWidth: 190, maxWidth: 210, fontSize: "0.8rem" };

const buildCard = (ticket, classes, onOpen, onPull) => ({
  id: ticket.id.toString(),
  title: ticket.contact?.name,
  label: `#${ticket.id}`,
  draggable: false,
  description: (
    <div style={{ fontSize: "0.8rem" }}>
      <p style={{ margin: "4px 0" }}>
        {ticket.contact?.number}
        <br />
        {ticket.lastMessage}
      </p>
      {ticket.queue && (
        <div style={{ color: ticket.queue.color, fontWeight: "bold" }}>
          {ticket.queue.name}
        </div>
      )}
      {ticket.tags?.some((t) => t.name === "Atendimento IA") && (
        <div style={{ color: "#8B5CF6", fontWeight: "bold" }}>
          {i18n.t("ticketsPipeline.aiTag")}
        </div>
      )}
      {ticket.user && <div>{ticket.user.name}</div>}
      {onPull && (
        <button
          type="button"
          className={classes.pullButton}
          onClick={() => onPull(ticket)}
        >
          {i18n.t("ticketsPipeline.pull")}
        </button>
      )}
      <button
        type="button"
        className={classes.seeButton}
        onClick={() => onOpen(ticket)}
      >
        {i18n.t("ticketsPipeline.seeTicket")}
      </button>
    </div>
  ),
});

const TicketsPipelineBoard = () => {
  const classes = useStyles();
  const history = useHistory();
  const { pipeline, loading, pullTicket } = usePipelineTickets();
  const [peekTicketId, setPeekTicketId] = useState(null);

  const handleOpenReadOnly = (ticket) => setPeekTicketId(ticket.id);

  const handleOpenNormal = (ticket) => history.push(`/tickets/${ticket.uuid}`);

  const handlePull = async (ticket) => {
    const ok = await pullTicket(ticket.id);
    if (ok) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  if (loading) {
    return null;
  }

  const data = {
    lanes: [
      {
        id: "ia",
        title: i18n.t("ticketsPipeline.ia"),
        label: pipeline.ia.length.toString(),
        cards: pipeline.ia.map((t) =>
          buildCard(t, classes, handleOpenReadOnly, null)
        ),
      },
      {
        id: "aguardando",
        title: i18n.t("ticketsPipeline.aguardando"),
        label: pipeline.aguardando.length.toString(),
        cards: pipeline.aguardando.map((t) =>
          buildCard(t, classes, handleOpenNormal, handlePull)
        ),
      },
      {
        id: "atendendo",
        title: i18n.t("ticketsPipeline.atendendo"),
        label: pipeline.atendendo.length.toString(),
        cards: pipeline.atendendo.map((t) =>
          buildCard(t, classes, handleOpenNormal, null)
        ),
      },
    ],
  };

  return (
    <div className={classes.root}>
      <Board
        data={data}
        draggable={false}
        laneStyle={laneStyle}
        cardStyle={cardStyle}
        style={{
          backgroundColor: "rgba(252, 252, 252, 0.03)",
          height: "100%",
        }}
      />
      <TicketMessagesDialog
        open={!!peekTicketId}
        ticketId={peekTicketId}
        handleClose={() => setPeekTicketId(null)}
      />
    </div>
  );
};

export default TicketsPipelineBoard;
