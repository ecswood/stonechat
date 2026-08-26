import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

import {
  makeStyles,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Typography
} from "@material-ui/core";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TabPanel from "../../components/TabPanel";
import SchedulesForm from "../../components/SchedulesForm";
import HolidayModal from "../../components/HolidayModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import useCompanies from "../../hooks/useCompanies";
import useSettings from "../../hooks/useSettings";

const useStyles = makeStyles(theme => ({
  mainPaper: {
    ...theme.scrollbarStyles,
    overflowY: "scroll",
    flex: 1
  },
  tab: {
    backgroundColor: theme.palette.options,
    borderRadius: 4
  },
  container: {
    width: "100%",
    maxHeight: "100%",
    padding: theme.spacing(2)
  },
  selectContainer: {
    width: "100%",
    maxWidth: 320,
    marginBottom: theme.spacing(2)
  }
}));

const BusinessHours = () => {
  const classes = useStyles();
  const [tab, setTab] = useState("schedules");

  const [company, setCompany] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const [scheduleType, setScheduleType] = useState("disabled");
  const [loadingScheduleType, setLoadingScheduleType] = useState(false);

  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [deletingHoliday, setDeletingHoliday] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { find, updateSchedules } = useCompanies();
  const { getAll: getAllSettings, update: updateSetting } = useSettings();

  const fetchCompanyData = useCallback(async () => {
    try {
      const companyId = localStorage.getItem("companyId");
      const companyData = await find(companyId);
      const settingList = await getAllSettings();
      setCompany(companyData);
      setSchedules(companyData.schedules);

      if (Array.isArray(settingList)) {
        const setting = settingList.find(s => s.key === "scheduleType");
        if (setting) setScheduleType(setting.value);
      }
    } catch (err) {
      toastError(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const { data } = await api.get("/holidays");
      setHolidays(data);
    } catch (err) {
      toastError(err);
    }
    setLoadingHolidays(false);
  }, []);

  useEffect(() => {
    fetchCompanyData();
    fetchHolidays();
  }, [fetchCompanyData, fetchHolidays]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleSubmitSchedules = async data => {
    setLoadingSchedules(true);
    try {
      setSchedules(data);
      await updateSchedules({ id: company.id, schedules: data });
      toast.success(i18n.t("businessHours.schedulesUpdated"));
    } catch (err) {
      toastError(err);
    }
    setLoadingSchedules(false);
  };

  const handleScheduleTypeChange = async value => {
    setLoadingScheduleType(true);
    try {
      setScheduleType(value);
      await updateSetting({ key: "scheduleType", value });
      toast.success(i18n.t("businessHours.scheduleTypeUpdated"));
    } catch (err) {
      toastError(err);
    }
    setLoadingScheduleType(false);
  };

  const handleOpenHolidayModal = () => {
    setEditingHoliday(null);
    setHolidayModalOpen(true);
  };

  const handleEditHoliday = holiday => {
    setEditingHoliday(holiday);
    setHolidayModalOpen(true);
  };

  const handleDeleteHoliday = async holidayId => {
    try {
      await api.delete(`/holidays/${holidayId}`);
      toast.success(i18n.t("holidays.toasts.deleted"));
      fetchHolidays();
    } catch (err) {
      toastError(err);
    }
    setDeletingHoliday(null);
  };

  const formatDateBR = iso => {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingHoliday &&
          `${i18n.t("holidays.confirmationModal.deleteTitle")} ${deletingHoliday.description}?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteHoliday(deletingHoliday.id)}
      >
        {i18n.t("holidays.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <HolidayModal
        open={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        editingHoliday={editingHoliday}
        onSuccess={fetchHolidays}
      />
      <MainHeader>
        <Title>{i18n.t("businessHours.title")}</Title>
      </MainHeader>
      <Paper className={classes.mainPaper} elevation={1}>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={handleTabChange}
          className={classes.tab}
        >
          <Tab
            label={i18n.t("businessHours.tabs.schedules")}
            value={"schedules"}
          />
          <Tab
            label={i18n.t("businessHours.tabs.holidays")}
            value={"holidays"}
          />
        </Tabs>

        <TabPanel className={classes.container} value={tab} name={"schedules"}>
          <FormControl className={classes.selectContainer} variant="outlined" size="small">
            <InputLabel id="schedule-type-label">
              {i18n.t("businessHours.scheduleType.title")}
            </InputLabel>
            <Select
              labelId="schedule-type-label"
              label={i18n.t("businessHours.scheduleType.title")}
              value={scheduleType}
              onChange={e => handleScheduleTypeChange(e.target.value)}
            >
              <MenuItem value={"disabled"}>
                {i18n.t("businessHours.scheduleType.disabled")}
              </MenuItem>
              <MenuItem value={"company"}>
                {i18n.t("businessHours.scheduleType.company")}
              </MenuItem>
              <MenuItem value={"queue"}>
                {i18n.t("businessHours.scheduleType.queue")}
              </MenuItem>
            </Select>
            <FormHelperText>
              {loadingScheduleType
                ? i18n.t("businessHours.updating")
                : i18n.t("businessHours.scheduleType.help")}
            </FormHelperText>
          </FormControl>
          <SchedulesForm
            loading={loadingSchedules}
            onSubmit={handleSubmitSchedules}
            initialValues={schedules}
          />
        </TabPanel>

        <TabPanel className={classes.container} value={tab} name={"holidays"}>
          <Grid container justifyContent="space-between" alignItems="center" style={{ marginBottom: 16 }}>
            <Grid item>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("holidays.subtitle")}
              </Typography>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenHolidayModal}
              >
                {i18n.t("holidays.buttons.add")}
              </Button>
            </Grid>
          </Grid>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">
                  {i18n.t("holidays.table.date")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("holidays.table.description")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("holidays.table.recurrent")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("holidays.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loadingHolidays && holidays.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    {i18n.t("holidays.empty")}
                  </TableCell>
                </TableRow>
              )}
              {holidays.map(holiday => (
                <TableRow key={holiday.id}>
                  <TableCell align="center">
                    {formatDateBR(holiday.date)}
                  </TableCell>
                  <TableCell align="center">{holiday.description}</TableCell>
                  <TableCell align="center">
                    {holiday.recurrent
                      ? i18n.t("holidays.table.yes")
                      : i18n.t("holidays.table.no")}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleEditHoliday(holiday)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setConfirmModalOpen(true);
                        setDeletingHoliday(holiday);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {loadingHolidays && <TableRowSkeleton columns={4} />}
            </TableBody>
          </Table>
        </TabPanel>
      </Paper>
    </MainContainer>
  );
};

export default BusinessHours;
