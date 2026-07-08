import { useState, useEffect, useContext, useCallback } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";

const usePipelineTickets = () => {
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const [pipeline, setPipeline] = useState({ ia: [], aguardando: [], atendendo: [] });
  const [loading, setLoading] = useState(true);

  const queueIds = user.queues.map((q) => q.id);
  const queueIdsKey = JSON.stringify(queueIds);

  const fetchPipeline = useCallback(async () => {
    try {
      const { data } = await api.get("/ticket/pipeline", {
        params: { queueIds: queueIdsKey },
      });
      setPipeline(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  }, [queueIdsKey]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => socket.emit("joinTicketsPipeline"));

    socket.on(`company-${companyId}-ticket`, () => {
      fetchPipeline();
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      if (data.action === "create") {
        fetchPipeline();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [socketManager, fetchPipeline]);

  const pullTicket = async (ticketId) => {
    try {
      await api.put(`/tickets/${ticketId}/pull`);
      return true;
    } catch (err) {
      toastError(err);
      return false;
    }
  };

  return { pipeline, loading, pullTicket };
};

export default usePipelineTickets;
