import React, { useEffect, useState } from "react";
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
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import ReceiptIcon from "@material-ui/icons/Receipt";
import LockOpenIcon from "@material-ui/icons/LockOpen";
import AndroidIcon from "@material-ui/icons/Android";
import NetworkCheckIcon from "@material-ui/icons/NetworkCheck";
import RefreshIcon from "@material-ui/icons/Refresh";
import DescriptionIcon from "@material-ui/icons/Description";
import RouterIcon from "@material-ui/icons/Router";
import LinkOffIcon from "@material-ui/icons/LinkOff";
import BuildIcon from "@material-ui/icons/Build";
import ListAltIcon from "@material-ui/icons/ListAlt";
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
		alignItems: "center",
		gap: 12,
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

const formatDataHoraBR = iso => {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString("pt-BR");
};

const formatDuracao = iso => {
	if (!iso) return "";
	const inicio = new Date(iso).getTime();
	if (Number.isNaN(inicio)) return "";
	const segundos = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
	const dias = Math.floor(segundos / 86400);
	const horas = Math.floor((segundos % 86400) / 3600);
	const minutos = Math.floor((segundos % 3600) / 60);
	const partes = [];
	if (dias) partes.push(`${dias}d`);
	if (horas || dias) partes.push(`${horas}h`);
	partes.push(`${minutos}min`);
	return partes.join(" ");
};

const formatBytes = bytes => {
	if (bytes === null || bytes === undefined) return "";
	if (bytes < 1024) return `${bytes} B`;
	const unidades = ["KB", "MB", "GB", "TB"];
	let valor = bytes;
	let i = -1;
	do {
		valor /= 1024;
		i += 1;
	} while (valor >= 1024 && i < unidades.length - 1);
	return `${valor.toFixed(1)} ${unidades[i]}`;
};

const DIAGNOSTICO_REFRESH_MS = 20000;
const EQUIPAMENTO_PORTA = 8082;

const DiagnosticoDialog = ({ open, onClose, contactId }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);
	const [atualizadoEm, setAtualizadoEm] = useState(null);

	const carregar = async (mostrarLoading = true) => {
		if (mostrarLoading) setLoading(true);
		try {
			const { data: response } = await api.get(
				`/contacts/${contactId}/sgp-conexao`
			);
			setData(response);
			setAtualizadoEm(new Date());
		} catch (err) {
			setData({ erro: true });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!open) return undefined;

		carregar(true);
		const interval = setInterval(() => carregar(false), DIAGNOSTICO_REFRESH_MS);
		return () => clearInterval(interval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, contactId]);

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>
				{i18n.t("contactDrawer.sgp.diagnosticoTitulo")}
				<IconButton
					size="small"
					onClick={() => carregar(true)}
					style={{ marginLeft: 8 }}
					title={i18n.t("contactDrawer.sgp.atualizarAgora")}
				>
					<RefreshIcon fontSize="small" />
				</IconButton>
			</DialogTitle>
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
				{!loading && data?.conexoes?.length === 0 && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.semConexao")}
					</Typography>
				)}
				{!loading &&
					data?.conexoes?.map(conexao => (
						<Paper
							key={conexao.servicoId}
							variant="outlined"
							className={classes.contratoCard}
						>
							<div className={classes.contratoTitle}>
								<Typography variant="body2" style={{ fontWeight: 500 }}>
									{conexao.plano}
								</Typography>
								<Chip
									size="small"
									label={
										conexao.online
											? i18n.t("contactDrawer.sgp.online")
											: i18n.t("contactDrawer.sgp.offline")
									}
									style={{
										backgroundColor: conexao.online ? "#2E7D32" : "#C62828",
										color: "#fff",
									}}
								/>
							</div>

							{conexao.online ? (
								<>
									<div className={classes.row}>
										<span className={classes.label}>
											{i18n.t("contactDrawer.sgp.ip")}
										</span>
										<span className={classes.value}>{conexao.ip || "—"}</span>
									</div>
									<div className={classes.row}>
										<span className={classes.label}>
											{i18n.t("contactDrawer.sgp.conectadoDesde")}
										</span>
										<span className={classes.value}>
											{formatDataHoraBR(conexao.inicioSessao)} (
											{formatDuracao(conexao.inicioSessao)})
										</span>
									</div>
									{conexao.ip && (
										<Button
											size="small"
											variant="outlined"
											startIcon={<RouterIcon />}
											style={{ marginTop: 8 }}
											onClick={() =>
												window.open(
													`http://${conexao.ip}:${EQUIPAMENTO_PORTA}`,
													"_blank",
													"noopener,noreferrer"
												)
											}
										>
											{i18n.t("contactDrawer.sgp.acessarEquipamento")}
										</Button>
									)}
								</>
							) : (
								<div className={classes.row}>
									<span className={classes.label}>
										{i18n.t("contactDrawer.sgp.ultimaQueda")}
									</span>
									<span className={classes.value}>
										{conexao.fimSessao
											? `${formatDataHoraBR(conexao.fimSessao)}${
													conexao.motivoDesconexao
														? ` (${conexao.motivoDesconexao})`
														: ""
											  }`
											: i18n.t("contactDrawer.sgp.semRegistro")}
									</span>
								</div>
							)}

							{(conexao.trafegoEntrada || conexao.trafegoSaida) && (
								<div className={classes.row}>
									<span className={classes.label}>
										{i18n.t("contactDrawer.sgp.trafego")}
									</span>
									<span className={classes.value}>
										↓{formatBytes(conexao.trafegoEntrada)} / ↑
										{formatBytes(conexao.trafegoSaida)}
									</span>
								</div>
							)}
						</Paper>
					))}
				{!loading && atualizadoEm && !data?.erro && data?.vinculado !== false && (
					<Typography
						variant="caption"
						color="textSecondary"
						style={{ display: "block", marginTop: 8 }}
					>
						{i18n.t("contactDrawer.sgp.atualizadoAs")}{" "}
						{atualizadoEm.toLocaleTimeString("pt-BR")}
					</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.fechar")}</Button>
			</DialogActions>
		</Dialog>
	);
};

const BoletosDialog = ({ open, onClose, contactId, ticketId }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);
	const [enviandoIndex, setEnviandoIndex] = useState(null);
	const [enviados, setEnviados] = useState({});

	useEffect(() => {
		if (!open) return;

		setLoading(true);
		setData(null);
		setEnviados({});

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

	const enviar = async (boleto, index) => {
		setEnviandoIndex(index);
		try {
			await api.post(`/tickets/${ticketId}/enviar-boleto`, boleto);
			toast.success(i18n.t("contactDrawer.sgp.boletoEnviado"));
			setEnviados(prev => ({ ...prev, [index]: true }));
		} catch (err) {
			toastError(err);
		} finally {
			setEnviandoIndex(null);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>{i18n.t("contactDrawer.sgp.boletosTitulo")}</DialogTitle>
			<DialogContent>
				{!loading && !data?.erro && data?.vinculado !== false && data?.boletos?.length > 0 && (
					<Typography color="textSecondary" style={{ marginBottom: 12 }}>
						{i18n.t("contactDrawer.sgp.boletosSubtitulo")}
					</Typography>
				)}
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
					data?.boletos?.map((boleto, index) => (
						<Paper
							// eslint-disable-next-line react/no-array-index-key
							key={boleto.linkBoleto || index}
							variant="outlined"
							className={classes.boletoCard}
						>
							<div className={classes.boletoRow}>
								<div>
									<div>
										<strong>
											{i18n.t("contactDrawer.sgp.vencimento")}:{" "}
											{formatDateBR(boleto.vencimento)}
										</strong>{" "}
										<Chip
											size="small"
											label={i18n.t("contactDrawer.sgp.emAberto")}
											style={{ backgroundColor: "#C8E6C9", color: "#1B5E20" }}
										/>
									</div>
									<Typography variant="body2" color="textSecondary">
										{i18n.t("contactDrawer.sgp.valor")}: R$ {boleto.valor}
									</Typography>
								</div>
								<Button
									variant="contained"
									color="primary"
									size="small"
									disabled={enviandoIndex === index || enviados[index]}
									onClick={() => enviar(boleto, index)}
								>
									{enviandoIndex === index ? (
										<CircularProgress size={16} color="inherit" />
									) : enviados[index] ? (
										i18n.t("contactDrawer.sgp.enviado")
									) : (
										i18n.t("contactDrawer.sgp.enviar")
									)}
								</Button>
							</div>
						</Paper>
					))}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.cancelar")}</Button>
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
	const [loading, setLoading] = useState(false);

	const confirmar = async () => {
		setLoading(true);
		try {
			await api.put(`/tickets/${ticketId}/retornar-ia`);
			toast.success(i18n.t("contactDrawer.sgp.retornarIaSucesso"));
			onClose();
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

const ResumoDialog = ({ open, onClose, ticketId }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [resumo, setResumo] = useState("");
	const [erro, setErro] = useState(false);

	useEffect(() => {
		if (!open) return;

		setLoading(true);
		setErro(false);
		setResumo("");

		(async () => {
			try {
				const { data } = await api.get(`/tickets/${ticketId}/resumo`);
				setResumo(data.resumo);
			} catch (err) {
				setErro(true);
			} finally {
				setLoading(false);
			}
		})();
	}, [open, ticketId]);

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>{i18n.t("contactDrawer.sgp.resumoTitulo")}</DialogTitle>
			<DialogContent>
				{loading && (
					<div className={classes.loadingWrapper}>
						<CircularProgress size={24} />
					</div>
				)}
				{!loading && erro && (
					<Typography color="error">
						{i18n.t("contactDrawer.sgp.erro")}
					</Typography>
				)}
				{!loading && !erro && (
					<Typography variant="body2" style={{ whiteSpace: "pre-line" }}>
						{resumo.split(/(\*\*.+?\*\*)/g).map((trecho, index) =>
							trecho.startsWith("**") && trecho.endsWith("**") ? (
								// eslint-disable-next-line react/no-array-index-key
								<strong key={index}>{trecho.slice(2, -2)}</strong>
							) : (
								// eslint-disable-next-line react/no-array-index-key
								<React.Fragment key={index}>{trecho}</React.Fragment>
							)
						)}
					</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.fechar")}</Button>
			</DialogActions>
		</Dialog>
	);
};

const DesvincularDialog = ({ open, onClose, contactId, onSuccess }) => {
	const [loading, setLoading] = useState(false);

	const confirmar = async () => {
		setLoading(true);
		try {
			await api.put(`/contacts/${contactId}/desvincular-cpf`);
			toast.success(i18n.t("contactDrawer.sgp.desvincularSucesso"));
			onClose();
			onSuccess();
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
			<DialogTitle>{i18n.t("contactDrawer.sgp.desvincularTitulo")}</DialogTitle>
			<DialogContent>
				<DialogContentText>
					{i18n.t("contactDrawer.sgp.desvincularConfirmacao")}
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

// Converte o valor do input datetime-local (formato "AAAA-MM-DDTHH:MM") pro
// formato que o SGP espera em data_hora_agendamento ("AAAA-MM-DD HH:MM").
const paraFormatoSgp = valorDatetimeLocal =>
	valorDatetimeLocal ? valorDatetimeLocal.replace("T", " ") : "";

const AbrirOsDialog = ({ open, onClose, contactId, contratos }) => {
	const classes = useStyles();
	const [contratoId, setContratoId] = useState("");
	const [conteudo, setConteudo] = useState("");
	const [agendamento, setAgendamento] = useState("");
	const [tecnicoId, setTecnicoId] = useState("");
	const [tecnicos, setTecnicos] = useState([]);
	const [loading, setLoading] = useState(false);
	const [resultado, setResultado] = useState(null);

	useEffect(() => {
		if (!open) return;
		setResultado(null);
		setConteudo("");
		setAgendamento("");
		setTecnicoId("");
		setContratoId(contratos?.length === 1 ? contratos[0].contratoId : "");

		(async () => {
			try {
				const { data } = await api.get("/sgp-tecnicos");
				setTecnicos(data.tecnicos || []);
			} catch (err) {
				setTecnicos([]);
			}
		})();
	}, [open, contratos]);

	const contratoSelecionado = (contratos || []).find(
		c => c.contratoId === contratoId
	);

	const confirmar = async () => {
		setLoading(true);
		try {
			const { data } = await api.post(`/contacts/${contactId}/sgp-abrir-os`, {
				contratoId,
				conteudo,
				tecnicoResponsavel: tecnicoId || undefined,
				dataHoraAgendamento: paraFormatoSgp(agendamento) || undefined,
			});
			setResultado(data);
		} catch (err) {
			toastError(err);
			setResultado({ erro: true });
		} finally {
			setLoading(false);
		}
	};

	const podeConfirmar = Boolean(contratoId) && conteudo.trim().length > 0;

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
			<DialogTitle>{i18n.t("contactDrawer.sgp.abrirOsTitulo")}</DialogTitle>
			<DialogContent>
				{!resultado && (
					<>
						{(contratos || []).length > 1 && (
							<TextField
								select
								fullWidth
								margin="dense"
								label={i18n.t("contactDrawer.sgp.abrirOsContrato")}
								value={contratoId}
								onChange={e => setContratoId(e.target.value)}
							>
								{contratos.map(c => (
									<MenuItem key={c.contratoId} value={c.contratoId}>
										{c.plano} — {i18n.t("contactDrawer.sgp.contratoId")}{" "}
										{c.contratoId}
										{c.login && ` · ${i18n.t("contactDrawer.sgp.login")} ${c.login}`}
									</MenuItem>
								))}
							</TextField>
						)}
						{contratoSelecionado && (
							<Typography className={classes.endereco}>
								{i18n.t("contactDrawer.sgp.contratoId")}:{" "}
								{contratoSelecionado.contratoId}
								{contratoSelecionado.login &&
									` · ${i18n.t("contactDrawer.sgp.login")}: ${contratoSelecionado.login}`}
							</Typography>
						)}
						<TextField
							fullWidth
							margin="dense"
							multiline
							minRows={3}
							autoFocus
							label={i18n.t("contactDrawer.sgp.abrirOsDescricao")}
							placeholder={i18n.t("contactDrawer.sgp.abrirOsDescricaoPlaceholder")}
							value={conteudo}
							onChange={e => setConteudo(e.target.value)}
						/>
						<TextField
							select
							fullWidth
							margin="dense"
							label={i18n.t("contactDrawer.sgp.abrirOsTecnico")}
							value={tecnicoId}
							onChange={e => setTecnicoId(e.target.value)}
						>
							<MenuItem value="">
								{i18n.t("contactDrawer.sgp.abrirOsSemTecnico")}
							</MenuItem>
							{tecnicos.map(t => (
								<MenuItem key={t.id} value={t.username}>
									{t.nome}
								</MenuItem>
							))}
						</TextField>
						<TextField
							fullWidth
							margin="dense"
							type="datetime-local"
							label={i18n.t("contactDrawer.sgp.abrirOsAgendamento")}
							InputLabelProps={{ shrink: true }}
							value={agendamento}
							onChange={e => setAgendamento(e.target.value)}
						/>
					</>
				)}
				{resultado?.vinculado === false && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.naoVinculado")}
					</Typography>
				)}
				{resultado?.erro && (
					<Typography color="error">{i18n.t("contactDrawer.sgp.erro")}</Typography>
				)}
				{resultado?.os && (
					<Typography style={{ color: "#2E7D32" }}>
						{i18n.t("contactDrawer.sgp.abrirOsSucesso", {
							protocolo: resultado.os.protocolo,
							osId: resultado.os.osId,
						})}
					</Typography>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{i18n.t("contactDrawer.sgp.fechar")}</Button>
				{!resultado && (
					<Button
						onClick={confirmar}
						color="primary"
						variant="contained"
						disabled={loading || !podeConfirmar}
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

// Converte o valor do input datetime-local (formato "AAAA-MM-DDTHH:MM") pro
// formato "AAAA-MM-DD HH:MM:SS" que /api/os/update/id/ exige (com segundos,
// diferente do formato sem segundos usado no agendamento de abrirOs).
const paraFormatoSgpComSegundos = valorDatetimeLocal =>
	valorDatetimeLocal ? `${valorDatetimeLocal.replace("T", " ")}:00` : "";

const agoraParaDatetimeLocal = () => {
	const agora = new Date();
	agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
	return agora.toISOString().slice(0, 16);
};

const ListarOsDialog = ({ open, onClose, contactId }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);
	const [fechandoOsId, setFechandoOsId] = useState(null);
	const [servicoPrestado, setServicoPrestado] = useState("");
	const [dataFinalizacao, setDataFinalizacao] = useState("");
	const [salvando, setSalvando] = useState(false);

	const carregar = async () => {
		setLoading(true);
		setData(null);
		try {
			const { data: response } = await api.get(
				`/contacts/${contactId}/sgp-os-abertas`
			);
			setData(response);
		} catch (err) {
			setData({ erro: true });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!open) return;
		setFechandoOsId(null);
		carregar();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, contactId]);

	const iniciarFechamento = os => {
		setFechandoOsId(os.osId);
		setServicoPrestado("");
		setDataFinalizacao(agoraParaDatetimeLocal());
	};

	const confirmarFechamento = async () => {
		setSalvando(true);
		try {
			await api.post("/sgp-fechar-os", {
				osId: fechandoOsId,
				servicoPrestado,
				dataHoraFinalizacao: paraFormatoSgpComSegundos(dataFinalizacao),
			});
			toast.success(i18n.t("contactDrawer.sgp.fecharOsSucesso"));
			setFechandoOsId(null);
			carregar();
		} catch (err) {
			toastError(err);
		} finally {
			setSalvando(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>{i18n.t("contactDrawer.sgp.listarOsTitulo")}</DialogTitle>
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
				{!loading && data?.vinculado && data.encontrado === false && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.naoEncontrado")}
					</Typography>
				)}
				{!loading && data?.osList?.length === 0 && (
					<Typography color="textSecondary">
						{i18n.t("contactDrawer.sgp.semOsAbertas")}
					</Typography>
				)}
				{!loading &&
					data?.osList?.map(os => (
						<Paper key={os.osId} variant="outlined" className={classes.boletoCard}>
							<Typography variant="body2" style={{ fontWeight: 500 }}>
								OS #{os.osId} — {os.plano}
							</Typography>
							<Typography variant="body2" color="textSecondary">
								{i18n.t("contactDrawer.sgp.protocolo")}: {os.protocolo}
							</Typography>
							<Typography variant="body2" style={{ marginTop: 4 }}>
								{os.conteudo}
							</Typography>
							{os.tecnicoResponsavel && (
								<Typography variant="body2" color="textSecondary">
									{i18n.t("contactDrawer.sgp.abrirOsTecnico")}:{" "}
									{os.tecnicoResponsavel}
								</Typography>
							)}
							{os.dataAgendamento && (
								<Typography variant="body2" color="textSecondary">
									{i18n.t("contactDrawer.sgp.abrirOsAgendamento")}:{" "}
									{formatDataHoraBR(os.dataAgendamento)}
								</Typography>
							)}
							<Typography variant="body2" color="textSecondary">
								{i18n.t("contactDrawer.sgp.dataCadastro")}:{" "}
								{formatDataHoraBR(os.dataCadastro)}
							</Typography>

							{fechandoOsId === os.osId ? (
								<div style={{ marginTop: 8 }}>
									<TextField
										fullWidth
										margin="dense"
										multiline
										minRows={2}
										autoFocus
										label={i18n.t("contactDrawer.sgp.fecharOsServicoPrestado")}
										value={servicoPrestado}
										onChange={e => setServicoPrestado(e.target.value)}
									/>
									<TextField
										fullWidth
										margin="dense"
										type="datetime-local"
										label={i18n.t("contactDrawer.sgp.fecharOsData")}
										InputLabelProps={{ shrink: true }}
										value={dataFinalizacao}
										onChange={e => setDataFinalizacao(e.target.value)}
									/>
									<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
										<Button
											size="small"
											variant="contained"
											color="primary"
											disabled={salvando || !servicoPrestado.trim()}
											onClick={confirmarFechamento}
										>
											{salvando ? (
												<CircularProgress size={16} color="inherit" />
											) : (
												i18n.t("contactDrawer.sgp.confirmar")
											)}
										</Button>
										<Button
											size="small"
											onClick={() => setFechandoOsId(null)}
											disabled={salvando}
										>
											{i18n.t("contactDrawer.sgp.cancelar")}
										</Button>
									</div>
								</div>
							) : (
								<Button
									size="small"
									style={{ marginTop: 8 }}
									variant="outlined"
									onClick={() => iniciarFechamento(os)}
								>
									{i18n.t("contactDrawer.sgp.fecharOsBotao")}
								</Button>
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

const SgpInfo = ({ contactId, ticket }) => {
	const classes = useStyles();
	const [loading, setLoading] = useState(true);
	const [data, setData] = useState(null);
	const [diagnosticoOpen, setDiagnosticoOpen] = useState(false);
	const [boletosOpen, setBoletosOpen] = useState(false);
	const [desbloquearOpen, setDesbloquearOpen] = useState(false);
	const [retornarIaOpen, setRetornarIaOpen] = useState(false);
	const [resumoOpen, setResumoOpen] = useState(false);
	const [desvincularOpen, setDesvincularOpen] = useState(false);
	const [abrirOsOpen, setAbrirOsOpen] = useState(false);
	const [listarOsOpen, setListarOsOpen] = useState(false);

	const carregarCliente = async () => {
		if (!contactId) return;

		setLoading(true);
		setData(null);

		try {
			const { data: response } = await api.get(
				`/contacts/${contactId}/sgp-cliente`
			);
			setData(response);
		} catch (err) {
			setData({ erro: true });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		carregarCliente();
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
							<Typography className={classes.endereco}>
								{i18n.t("contactDrawer.sgp.contratoId")}: {contrato.contratoId}
								{contrato.login &&
									` · ${i18n.t("contactDrawer.sgp.login")}: ${contrato.login}`}
							</Typography>
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
						startIcon={<NetworkCheckIcon />}
						onClick={() => setDiagnosticoOpen(true)}
					>
						{i18n.t("contactDrawer.sgp.botaoDiagnostico")}
					</Button>
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
					{data?.cliente && (
						<Button
							size="small"
							variant="outlined"
							startIcon={<BuildIcon />}
							onClick={() => setAbrirOsOpen(true)}
						>
							{i18n.t("contactDrawer.sgp.botaoAbrirOs")}
						</Button>
					)}
					{data?.cliente && (
						<Button
							size="small"
							variant="outlined"
							startIcon={<ListAltIcon />}
							onClick={() => setListarOsOpen(true)}
						>
							{i18n.t("contactDrawer.sgp.botaoListarOs")}
						</Button>
					)}
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
					{ticket?.id && (
						<Button
							size="small"
							variant="outlined"
							startIcon={<DescriptionIcon />}
							onClick={() => setResumoOpen(true)}
						>
							{i18n.t("contactDrawer.sgp.botaoResumo")}
						</Button>
					)}
					{data?.cliente && (
						<Button
							size="small"
							variant="outlined"
							startIcon={<LinkOffIcon />}
							onClick={() => setDesvincularOpen(true)}
						>
							{i18n.t("contactDrawer.sgp.botaoDesvincular")}
						</Button>
					)}
				</div>
			)}

			<DiagnosticoDialog
				open={diagnosticoOpen}
				onClose={() => setDiagnosticoOpen(false)}
				contactId={contactId}
			/>
			<BoletosDialog
				open={boletosOpen}
				onClose={() => setBoletosOpen(false)}
				contactId={contactId}
				ticketId={ticket?.id}
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
			{ticket?.id && (
				<ResumoDialog
					open={resumoOpen}
					onClose={() => setResumoOpen(false)}
					ticketId={ticket.id}
				/>
			)}
			<DesvincularDialog
				open={desvincularOpen}
				onClose={() => setDesvincularOpen(false)}
				contactId={contactId}
				onSuccess={carregarCliente}
			/>
			<AbrirOsDialog
				open={abrirOsOpen}
				onClose={() => setAbrirOsOpen(false)}
				contactId={contactId}
				contratos={data?.cliente?.contratos}
			/>
			<ListarOsDialog
				open={listarOsOpen}
				onClose={() => setListarOsOpen(false)}
				contactId={contactId}
			/>
		</Paper>
	);
};

export default SgpInfo;
