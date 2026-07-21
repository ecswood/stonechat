import React, { useState, useEffect, useReducer } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";
import { useDate } from "../../hooks/useDate";

const reducer = (state, action) => {
  if (action.type === "LOAD_RATINGS") {
    const ratings = action.payload;
    const newRatings = [];

    ratings.forEach((rating) => {
      const ratingIndex = state.findIndex((r) => r.id === rating.id);
      if (ratingIndex !== -1) {
        state[ratingIndex] = rating;
      } else {
        newRatings.push(rating);
      }
    });

    return [...state, ...newRatings];
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const rateColor = (rate) => {
  if (rate <= 1) return "#ef4444";
  if (rate === 2) return "#f59e0b";
  return "#10b981";
};

const rateLabel = (rate) => {
  if (rate <= 1) return "Insatisfeito";
  if (rate === 2) return "Satisfeito";
  return "Muito Satisfeito";
};

const Ratings = () => {
  const classes = useStyles();
  const { datetimeToClient } = useDate();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [ratings, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, []);

  useEffect(() => {
    setLoading(true);
    const fetchRatings = async () => {
      try {
        const { data } = await api.get("/user-ratings", {
          params: { pageNumber },
        });
        dispatch({ type: "LOAD_RATINGS", payload: data.ratings });
        setHasMore(data.hasMore);
        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    };
    fetchRatings();
  }, [pageNumber]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("mainDrawer.listItems.ratings")}</Title>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Data</TableCell>
              <TableCell align="center">Ticket</TableCell>
              <TableCell align="center">Cliente</TableCell>
              <TableCell align="center">Atendente</TableCell>
              <TableCell align="center">Nota</TableCell>
              <TableCell align="left">Feedback</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {ratings.map((rating) => (
                <TableRow key={rating.id}>
                  <TableCell align="center">
                    {datetimeToClient(rating.createdAt)}
                  </TableCell>
                  <TableCell align="center">
                    {rating.ticket?.id ?? "-"}
                  </TableCell>
                  <TableCell align="center">
                    {rating.ticket?.contact?.name ?? "-"}
                  </TableCell>
                  <TableCell align="center">
                    {rating.user?.name ?? "-"}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={`${rating.rate} - ${rateLabel(rating.rate)}`}
                      style={{
                        backgroundColor: rateColor(rating.rate),
                        color: "#fff",
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="left">{rating.feedback ?? "-"}</TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={6} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Ratings;
