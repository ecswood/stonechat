import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  btnWrapper: {
    position: "relative"
  }
}));

const HolidaySchema = Yup.object().shape({
  date: Yup.string().required(),
  description: Yup.string().min(2).required()
});

const initialState = {
  date: "",
  description: "",
  recurrent: false
};

const HolidayModal = ({ open, onClose, editingHoliday, onSuccess }) => {
  const classes = useStyles();
  const [holiday, setHoliday] = useState(initialState);

  useEffect(() => {
    if (!open) return;
    setHoliday(
      editingHoliday
        ? {
            date: editingHoliday.date,
            description: editingHoliday.description,
            recurrent: editingHoliday.recurrent
          }
        : initialState
    );
  }, [editingHoliday, open]);

  const handleClose = () => {
    setHoliday(initialState);
    onClose();
  };

  const handleSave = async values => {
    try {
      if (editingHoliday) {
        await api.put(`/holidays/${editingHoliday.id}`, values);
      } else {
        await api.post("/holidays", values);
      }
      toast.success(i18n.t("holidays.toasts.success"));
      onSuccess();
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {editingHoliday
          ? i18n.t("holidays.modal.editTitle")
          : i18n.t("holidays.modal.addTitle")}
      </DialogTitle>
      <Formik
        initialValues={holiday}
        enableReinitialize
        validationSchema={HolidaySchema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSave(values);
            actions.setSubmitting(false);
          }, 300);
        }}
      >
        {({ touched, errors, isSubmitting, values, setFieldValue }) => (
          <Form>
            <DialogContent dividers>
              <Field
                as={TextField}
                label={i18n.t("holidays.modal.date")}
                name="date"
                type="date"
                error={touched.date && Boolean(errors.date)}
                helperText={touched.date && errors.date}
                variant="outlined"
                margin="dense"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <Field
                as={TextField}
                label={i18n.t("holidays.modal.description")}
                name="description"
                error={touched.description && Boolean(errors.description)}
                helperText={touched.description && errors.description}
                variant="outlined"
                margin="dense"
                fullWidth
                placeholder={i18n.t("holidays.modal.descriptionPlaceholder")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.recurrent}
                    onChange={e =>
                      setFieldValue("recurrent", e.target.checked)
                    }
                    color="primary"
                  />
                }
                label={i18n.t("holidays.modal.recurrent")}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleClose}
                color="secondary"
                disabled={isSubmitting}
                variant="outlined"
              >
                {i18n.t("holidays.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={isSubmitting}
                variant="contained"
                className={classes.btnWrapper}
              >
                {editingHoliday
                  ? i18n.t("holidays.buttons.okEdit")
                  : i18n.t("holidays.buttons.okAdd")}
                {isSubmitting && (
                  <CircularProgress size={24} className={classes.buttonProgress} />
                )}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default HolidayModal;
