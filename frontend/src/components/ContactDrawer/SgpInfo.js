import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Chip from "@material-ui/core/Chip";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";
import Link from "@material-ui/core/Link";
import ReceiptIcon from "@material-ui/icons/Receipt";
import LockOpenIcon from "@material-ui/icons/LockOpen";
import AndroidIcon from "@material-ui/icons/Android";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
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
	actions: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginTop: 16,
	},
	boletoCard: {
		padding: 8,
		marginBottom: 8,
	},
	boletoRow: {
		display: "flex",
		justifyContent: "space-between",
		fontSize: 13,
	},
	monoValue: {
		fontFamily: "monospace",
		fontSize: 12,
		wordBreak: "break-all",
		backgroundColor: theme.palette.background.default,
		padding: 4,
		borderRadius: 4,
		marginTop: 4,
	},
}));

const statusColor = status => {
	const normalized = (status || "").trim().toLowerCase();
	if (normalized === "ativo") return "#2E7D32";
	if (!normalized) return "#9E9E9E";
	return "#C62828";
};

const formatDateBR = iso => {
	if (!iso) return "";
	const [ano, mes, dia] = iso.split("-");
	return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
};

const copyToClipboard = async (text, label) => {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copiado!`);
	} catch {
		toastError({ response: { data: { error: "Não foi possível copiar." } } });
	}
};

const BoletosDialog = ({ open, onClose, contactId }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);

	useEffect(() => {
		if (!open) return;

		setLoading(true);
		setData(null);

		(async () => {
			try {
				const { data: response } = await api.get(
					`/contacts/${contactId}/sgp-boletos`
				);
				setData(response);
			} catch (err) {
				setData({ erro: true });
			} finally {
				setLoading(false);
			}
		})();
	}, [open, contactId]);

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
			<DialogTitle>{i18n.t("contactDrawer.sgp.boletosTitulo")}</DialogTitle>
			<DialogContent>
				{loading && (
					<div className={classes.loadingWrapper}>
						<CircularProgress size={24} />
					</div>
				)}
				{!loading && data?.erro && (
					<Typography color="error">
						{i18n.t("contactDrawer.sgp.erro")}
					</Typography>
				)}
				{!loading && data?.vinculado === false && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.naoVinculado")}
					</Typography>
				)}
				{!loading && data?.boletos?.length === 0 && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.semBoletos")}
					</Typography>
				)}
				{!loading &&
					data?.boletos?.map(boleto => (
						<Paper
							key={boleto.linkBoleto || boleto.vencimento}
							variant="outlined"
							className={classes.boletoCard}
						>
							<div className={classes.boletoRow}>
								<strong>R$ {boleto.valor}</strong>
								<span>{formatDateBR(boleto.vencimento)}</span>
							</div>
							{boleto.linkBoleto && (
								<Link
									href={boleto.linkBoleto}
									target="_blank"
									rel="noopener noreferrer"
									style={{ fontSize: 12, display: "block", marginTop: 4 }}
								>
									{i18n.t("contactDrawer.sgp.abrirBoleto")}
								</Link>
							)}
							{boleto.linhaDigitavel && (
								<div
									className={classes.monoValue}
									onClick={() =>
										copyToClipboard(
											boleto.linhaDigitavel,
											i18n.t("contactDrawer.sgp.linhaDigitavel")
										)
									}
									style={{ cursor: "pointer" }}
								>
									{boleto.linhaDigitavel}
								</div>
							)}
							{boleto.pixCopiaCola && (
								<div
									className={classes.monoValue}
									onClick={() =>
										copyToClipboard(boleto.pixCopiaCola, "PIX")
									}
									style={{ cursor: "pointer" }}
								>
									PIX: {boleto.pixCopiaCola}
								</div>
							)}
						</Paper>
					))}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.fechar")}</Button>
			</DialogActions>
		</Dialog>
	);
};

const DesbloquearDialog = ({ open, onClose, contactId }) => {
	const [loading, setLoading] = useState(false);
	const [resultado, setResultado] = useState(null);

	useEffect(() => {
		if (open) setResultado(null);
	}, [open]);

	const confirmar = async () => {
		setLoading(true);
		try {
			const { data } = await api.post(`/contacts/${contactId}/sgp-desbloquear`);
			setResultado(data);
		} catch (err) {
			toastError(err);
			setResultado({ erro: true });
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
			<DialogTitle>{i18n.t("contactDrawer.sgp.desbloquearTitulo")}</DialogTitle>
			<DialogContent>
				{!resultado && (
					<DialogContentText>
						{i18n.t("contactDrawer.sgp.desbloquearConfirmacao")}
					</DialogContentText>
				)}
				{resultado?.vinculado === false && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.naoVinculado")}
					</Typography>
				)}
				{resultado?.encontrado === false && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.naoEncontrado")}
					</Typography>
				)}
				{resultado?.erro && (
					<Typography color="error">
						{i18n.t("contactDrawer.sgp.erro")}
					</Typography>
				)}
				{resultado?.resultado?.sucesso === true && (
					<Typography style={{ color: "#2E7D32" }}>
						{i18n.t("contactDrawer.sgp.desbloqueadoSucesso", {
							data: formatDateBR(resultado.resultado.dataPromessa),
							protocolo: resultado.resultado.protocolo,
						})}
					</Typography>
				)}
				{resultado?.resultado?.sucesso === false && (
					<Typography color="error">{resultado.resultado.mensagem}</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.fechar")}</Button>
				{!resultado && (
					<Button
						onClick={confirmar}
						color="primary"
						variant="contained"
						disabled={loading}
					>
						{loading ? (
							<CircularProgress size={18} />
						) : (
							i18n.t("contactDrawer.sgp.confirmar")
						)}
					</Button>
				)}
			</DialogActions>
		</Dialog>
	);
};

const RetornarIaDialog = ({ open, onClose, ticketId }) => {
	const history = useHistory();
	const [loading, setLoading] = useState(false);

	const confirmar = async () => {
		setLoading(true);
		try {
			await api.put(`/tickets/${ticketId}/retornar-ia`);
			toast.success(i18n.t("contactDrawer.sgp.retornarIaSucesso"));
			onClose();
			history.push("/tickets");
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
			<DialogTitle>{i18n.t("contactDrawer.sgp.retornarIaTitulo")}</DialogTitle>
			<DialogContent>
				<DialogContentText>
					{i18n.t("contactDrawer.sgp.retornarIaConfirmacao")}
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.fechar")}</Button>
				<Button
					onClick={confirmar}
					color="primary"
					variant="contained"
					disabled={loading}
				>
					{loading ? (
						<CircularProgress size={18} />
					) : (
						i18n.t("contactDrawer.sgp.confirmar")
					)}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

const SgpInfo = ({ contactId, ticket }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);
	const [boletosOpen, setBoletosOpen] = useState(false);
	const [desbloquearOpen, setDesbloquearOpen] = useState(false);
	const [retornarIaOpen, setRetornarIaOpen] = useState(false);

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

			{!loading && data && !data.erro && (
				<div className={classes.actions}>
					<Button
						size="small"
						variant="outlined"
						startIcon={<ReceiptIcon />}
						onClick={() => setBoletosOpen(true)}
					>
						{i18n.t("contactDrawer.sgp.botaoBoletos")}
					</Button>
					<Button
						size="small"
						variant="outlined"
						startIcon={<LockOpenIcon />}
						onClick={() => setDesbloquearOpen(true)}
					>
						{i18n.t("contactDrawer.sgp.botaoDesbloquear")}
					</Button>
					{ticket?.id && (
						<Button
							size="small"
							variant="outlined"
							startIcon={<AndroidIcon />}
							onClick={() => setRetornarIaOpen(true)}
						>
							{i18n.t("contactDrawer.sgp.botaoRetornarIa")}
						</Button>
					)}
				</div>
			)}

			<BoletosDialog
				open={boletosOpen}
				onClose={() => setBoletosOpen(false)}
				contactId={contactId}
			/>
			<DesbloquearDialog
				open={desbloquearOpen}
				onClose={() => setDesbloquearOpen(false)}
				contactId={contactId}
			/>
			{ticket?.id && (
				<RetornarIaDialog
					open={retornarIaOpen}
					onClose={() => setRetornarIaOpen(false)}
					ticketId={ticket.id}
				/>
			)}
		</Paper>
	);
};

export default SgpInfo;
