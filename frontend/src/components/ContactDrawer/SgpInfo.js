import React, { useEffect, useState } from "react";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	root: {
		marginTop: 8,
		padding: 8,
	},
	loadingWrapper: {
		display: "flex",
		justifyContent: "center",
		padding: 16,
	},
	row: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: "4px 0",
	},
	label: {
		fontSize: 12,
		color: theme.palette.text.secondary,
	},
	value: {
		fontSize: 13,
		fontWeight: 500,
		textAlign: "right",
		marginLeft: 8,
	},
	contratoCard: {
		marginTop: 8,
		padding: 8,
		backgroundColor: theme.palette.background.default,
	},
	contratoTitle: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	},
	endereco: {
		fontSize: 12,
		color: theme.palette.text.secondary,
		marginTop: 4,
	},
}));

const statusColor = status => {
	const normalized = (status || "").trim().toLowerCase();
	if (normalized === "ativo") return "#2E7D32";
	if (!normalized) return "#9E9E9E";
	return "#C62828";
};

const SgpInfo = ({ contactId }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);

	useEffect(() => {
		if (!contactId) return undefined;

		let active = true;
		setLoading(true);
		setData(null);

		(async () => {
			try {
				const { data: response } = await api.get(
					`/contacts/${contactId}/sgp-cliente`
				);
				if (active) setData(response);
			} catch (err) {
				if (active) setData({ erro: true });
			} finally {
				if (active) setLoading(false);
			}
		})();

		return () => {
			active = false;
		};
	}, [contactId]);

	return (
		<Paper square variant="outlined" className={classes.root}>
			<Typography variant="subtitle1" style={{ marginBottom: 4 }}>
				{i18n.t("contactDrawer.sgp.title")}
			</Typography>

			{loading && (
				<div className={classes.loadingWrapper}>
					<CircularProgress size={20} />
				</div>
			)}

			{!loading && data?.erro && (
				<Typography variant="body2" color="error">
					{i18n.t("contactDrawer.sgp.erro")}
				</Typography>
			)}

			{!loading && data && !data.erro && data.vinculado === false && (
				<Typography variant="body2" color="textSecondary">
					{i18n.t("contactDrawer.sgp.naoVinculado")}
				</Typography>
			)}

			{!loading && data?.vinculado && data.encontrado === false && (
				<Typography variant="body2" color="textSecondary">
					{i18n.t("contactDrawer.sgp.naoEncontrado")}
				</Typography>
			)}

			{!loading && data?.cliente && (
				<>
					<div className={classes.row}>
						<span className={classes.label}>
							{i18n.t("contactDrawer.sgp.nome")}
						</span>
						<span className={classes.value}>{data.cliente.nome}</span>
					</div>
					<div className={classes.row}>
						<span className={classes.label}>
							{i18n.t("contactDrawer.sgp.cpfCnpj")}
						</span>
						<span className={classes.value}>{data.cliente.cpfCnpj}</span>
					</div>

					<Typography
						variant="subtitle2"
						style={{ marginTop: 12, marginBottom: 4 }}
					>
						{i18n.t("contactDrawer.sgp.planos")}
					</Typography>

					{data.cliente.contratos.length === 0 && (
						<Typography variant="body2" color="textSecondary">
							{i18n.t("contactDrawer.sgp.semContratoAtivo")}
						</Typography>
					)}

					{data.cliente.contratos.map(contrato => (
						<Paper
							key={contrato.contratoId}
							square
							variant="outlined"
							className={classes.contratoCard}
						>
							<div className={classes.contratoTitle}>
								<Typography variant="body2" style={{ fontWeight: 500 }}>
									{contrato.plano}
								</Typography>
								<Chip
									size="small"
									label={contrato.status}
									style={{
										backgroundColor: statusColor(contrato.status),
										color: "#fff",
									}}
								/>
							</div>
							{contrato.endereco && (
								<Typography className={classes.endereco}>
									{contrato.endereco}
								</Typography>
							)}
						</Paper>
					))}
				</>
			)}
		</Paper>
	);
};

export default SgpInfo;
