// Reutiliza exatamente o aviso registrado nos pacientes da remessa.
// Esta camada e somente leitura: nao muda responsaveis, etapas nem status.
import { lerImpedimentoV516, renderAvisoRemessaV516 } from "./impedimentos-remessa.js";

export function temAvisoPacienteFilaV517(paciente) {
  return Boolean(lerImpedimentoV516(paciente?.aviso_remessa, paciente?.remessa_id));
}

export function contarAvisosFilaV517(pacientes = []) {
  return (Array.isArray(pacientes) ? pacientes : []).filter(temAvisoPacienteFilaV517).length;
}

export function renderAvisoPacienteFilaV517(paciente) {
  return renderAvisoRemessaV516(paciente?.aviso_remessa, paciente?.remessa_id);
}

export function renderResumoAvisosFilaV517(pacientes = []) {
  const quantidade = contarAvisosFilaV517(pacientes);
  return quantidade
    ? `<span class="badge alerta" style="background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.4)">⚠ ${quantidade} com impedimento</span>`
    : "";
}
