import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";

import { i18n } from "../../translate/i18n";
import usePipelineTickets from "../../hooks/usePipelineTickets";
import TicketMessagesDialog from "../TicketMessagesDialog";

const useStyles = makeStyles(() => ({
  root: {
    display: "flex",
    height: "100%",
    gap: 4,
    padding: 4,
    overflow: "hidden",
  },
  lane: {
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#e3e3e3",
    borderRadius: 3,
  },
  laneHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 6px",
    fontWeight: "bold",
    fontSize: "0.8rem",
  },
  laneBody: {
    flex: 1,
    overflowY: "auto",
    padding: "0 4px 4px",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 3,
    borderBottom: "1px solid #ccc",
    padding: 8,
    marginBottom: 6,
    fontSize: "0.75rem",
    wordBreak: "break-word",
  },
  cardTitle: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: "0.8rem",
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
    marginRight: 4,
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

const TicketCard = ({ ticket, classes, onOpen, onPull }) => (
  <div className={classes.card}>
    <div className={classes.cardTitle}>
      <span>{ticket.contact?.name}</span>
      <span>#{ticket.id}</span>
    </div>
    <p style={{ margin: "4px 0" }}>{ticket.contact?.number}</p>
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
);

const Lane = ({ title, tickets, classes, onOpen, onPull }) => (
  <div className={classes.lane}>
    <div className={classes.laneHeader}>
      <span>{title}</span>
      <span>{tickets.length}</span>
    </div>
    <div className={classes.laneBody}>
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          classes={classes}
          onOpen={onOpen}
          onPull={onPull}
        />
      ))}
    </div>
  </div>
);

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

  return (
    <div className={classes.root}>
      <Lane
        title={i18n.t("ticketsPipeline.ia")}
        tickets={pipeline.ia}
        classes={classes}
        onOpen={handleOpenReadOnly}
        onPull={null}
      />
      <Lane
        title={i18n.t("ticketsPipeline.aguardando")}
        tickets={pipeline.aguardando}
        classes={classes}
        onOpen={handleOpenNormal}
        onPull={handlePull}
      />
      <Lane
        title={i18n.t("ticketsPipeline.atendendo")}
        tickets={pipeline.atendendo}
        classes={classes}
        onOpen={handleOpenNormal}
        onPull={null}
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
