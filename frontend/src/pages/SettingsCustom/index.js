import React, { useState, useEffect, useCallback } from "react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
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
  Grid,
  Typography
} from "@material-ui/core";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import TabPanel from "../../components/TabPanel";

import SchedulesForm from "../../components/SchedulesForm";
import CompaniesManager from "../../components/CompaniesManager";
import PlansManager from "../../components/PlansManager";
import HelpsManager from "../../components/HelpsManager";
import Options from "../../components/Settings/Options";
import HolidayModal from "../../components/HolidayModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import { i18n } from "../../translate/i18n.js";
import { toast } from "react-toastify";

import useCompanies from "../../hooks/useCompanies";
import useAuth from "../../hooks/useAuth.js";
import useSettings from "../../hooks/useSettings";

import OnlyForSuperUser from "../../components/OnlyForSuperUser";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.paper,
  },
  mainPaper: {
    ...theme.scrollbarStyles,
    overflowY: "scroll",
    flex: 1,
  },
  tab: {
    backgroundColor: theme.palette.options,
    borderRadius: 4,
  },
  paper: {
    ...theme.scrollbarStyles,
    overflowY: "scroll",
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  container: {
    width: "100%",
    maxHeight: "100%",
  },
  control: {
    padding: theme.spacing(1),
  },
  textfield: {
    width: "100%",
  },
}));

const SettingsCustom = () => {
  const classes = useStyles();
  const [tab, setTab] = useState("options");
  const [schedules, setSchedules] = useState([]);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [settings, setSettings] = useState({});
  const [schedulesEnabled, setSchedulesEnabled] = useState(false);

  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [deletingHoliday, setDeletingHoliday] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { getCurrentUserInfo } = useAuth();
  const { find, updateSchedules } = useCompanies();
  const { getAll: getAllSettings } = useSettings();

  useEffect(() => {
    async function findData() {
      setLoading(true);
      try {
        const companyId = localStorage.getItem("companyId");
        const company = await find(companyId);
        const settingList = await getAllSettings();
        setCompany(company);
        setSchedules(company.schedules);
        setSettings(settingList);

        if (Array.isArray(settingList)) {
          const scheduleType = settingList.find(
            (d) => d.key === "scheduleType"
          );
          if (scheduleType) {
            setSchedulesEnabled(scheduleType.value === "company");
          }
        }

        const user = await getCurrentUserInfo();
        setCurrentUser(user);
      } catch (e) {
        toast.error(e);
      }
      setLoading(false);
    }
    findData();
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
    fetchHolidays();
  }, [fetchHolidays]);

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

  const handleTabChange = (event, newValue) => {
      async function findData() {
        setLoading(true);
        try {
          const companyId = localStorage.getItem("companyId");
          const company = await find(companyId);
          const settingList = await getAllSettings();
          setCompany(company);
          setSchedules(company.schedules);
          setSettings(settingList);
  
          if (Array.isArray(settingList)) {
            const scheduleType = settingList.find(
              (d) => d.key === "scheduleType"
            );
            if (scheduleType) {
              setSchedulesEnabled(scheduleType.value === "company");
            }
          }
  
          const user = await getCurrentUserInfo();
          setCurrentUser(user);
        } catch (e) {
          toast.error(e);
        }
        setLoading(false);
      }
      findData();
      // eslint-disable-next-line react-hooks/exhaustive-deps

    setTab(newValue);
  };

  const handleSubmitSchedules = async (data) => {
    setLoading(true);
    try {
      setSchedules(data);
      await updateSchedules({ id: company.id, schedules: data });
      toast.success(i18n.t("settings.schedulesUpdated"));
    } catch (e) {
      toast.error(e);
    }
    setLoading(false);
  };

  const isSuper = () => {
    return currentUser.super;
  };

  return (
    <MainContainer className={classes.root}>
      <MainHeader>
        <Title>{i18n.t("settings.title")}</Title>
      </MainHeader>
      <Paper className={classes.mainPaper} elevation={1}>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          onChange={handleTabChange}
          className={classes.tab}
        >
          <Tab label={i18n.t("settings.tabs.options")} value={"options"} />
          {schedulesEnabled && <Tab label={i18n.t("settings.tabs.schedules")} value={"schedules"} />}
          {isSuper() ? <Tab label={i18n.t("settings.tabs.companies")} value={"companies"} /> : null}
          {isSuper() ? <Tab label={i18n.t("settings.tabs.plans")} value={"plans"} /> : null}
          {isSuper() ? <Tab label={i18n.t("settings.tabs.helps")} value={"helps"} /> : null}
        </Tabs>
        <Paper className={classes.paper} elevation={0}>
          <TabPanel
            className={classes.container}
            value={tab}
            name={"schedules"}
          >
            <SchedulesForm
              loading={loading}
              onSubmit={handleSubmitSchedules}
              initialValues={schedules}
            />

            <Typography variant="h6" style={{ marginTop: 32, marginBottom: 4 }}>
              {i18n.t("holidays.title")}
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
              {i18n.t("holidays.subtitle")}
            </Typography>
            <Grid container justifyContent="flex-end" style={{ marginBottom: 8 }}>
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
          </TabPanel>
          <OnlyForSuperUser
            user={currentUser}
            yes={() => (
              <TabPanel
                className={classes.container}
                value={tab}
                name={"companies"}
              >
                <CompaniesManager />
              </TabPanel>
            )}
          />
          <OnlyForSuperUser
            user={currentUser}
            yes={() => (
              <TabPanel
                className={classes.container}
                value={tab}
                name={"plans"}
              >
                <PlansManager />
              </TabPanel>
            )}
          />
          <OnlyForSuperUser
            user={currentUser}
            yes={() => (
              <TabPanel
                className={classes.container}
                value={tab}
                name={"helps"}
              >
                <HelpsManager />
              </TabPanel>
            )}
          />
          <TabPanel className={classes.container} value={tab} name={"options"}>
            <Options
              settings={settings}
              scheduleTypeChanged={(value) =>
                setSchedulesEnabled(value === "company")
              }
            />
          </TabPanel>
        </Paper>
      </Paper>
    </MainContainer>
  );
};

export default SettingsCustom;
