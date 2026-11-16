// Fluxo Lab — catálogo aditivo de 50 conquistas profissionais.
// Os valores de métricas são agregados pelo domínio da aplicação; este módulo não acessa D1.
export const ACHIEVEMENT_CATALOG_VERSION = "1.0.0";

export const RARITIES = Object.freeze({
  comum: { label: "Comum", color: "#A0A5AD", order: 1 },
  bronze: { label: "Bronze", color: "#CD854C", order: 2 },
  prata: { label: "Prata", color: "#C5D0DC", order: 3 },
  ouro: { label: "Ouro", color: "#E9B943", order: 4 },
  platina: { label: "Platina", color: "#78BCEB", order: 5 },
  diamante: { label: "Diamante", color: "#25D8E8", order: 6 },
  lendario: { label: "Lendário", color: "#B68AFF", order: 7 },
  especial: { label: "Especial", color: "#F08BCE", order: 8 },
  secreto: { label: "Secreto", color: "#8B78E8", order: 9 }
});

const item = (id, name, category, rarity, metric, target, verification = "automatico", unit = "registros") => ({
  id, name, category, rarity, metric, target, verification, unit
});

export const NEW_ACHIEVEMENTS = Object.freeze([
  // CAD/CAM — 8
  item("cad_arquivo_completo", "Arquivo Completo", "cad_cam", "bronze", "cad.complete_files", 10),
  item("cad_planejamento_digital", "Planejamento Digital", "cad_cam", "bronze", "cad.planned_projects", 10),
  item("cad_malha_validada", "Malha Validada", "cad_cam", "prata", "cad.validated_meshes", 20, "misto"),
  item("cad_margem_conferida", "Margem Conferida", "cad_cam", "prata", "cad.margin_checks", 20, "misto"),
  item("cad_oclusal_revisada", "Oclusão Revisada", "cad_cam", "ouro", "cad.occlusion_reviews", 20, "misto"),
  item("cad_biblioteca_correta", "Biblioteca Correta", "cad_cam", "prata", "cad.library_uses", 15),
  item("cad_fluxo_digital_completo", "Fluxo Digital Completo", "cad_cam", "platina", "cad.handoffs_to_slicing", 30),
  item("cad_resgate_digital", "Resgate Digital", "cad_cam", "ouro", "cad.recovered_projects", 10),

  // Trabalhos manuais — 7
  item("manual_mao_na_massa", "Mão na Massa", "manual", "comum", "manual.completed", 10),
  item("manual_montagem_anatomica", "Montagem Anatômica", "manual", "prata", "manual.approved_assemblies", 15, "misto"),
  item("manual_escultura_detalhe", "Escultura de Detalhe", "manual", "prata", "manual.approved_sculptures", 10, "misto"),
  item("manual_ajuste_oclusal", "Ajuste Oclusal Manual", "manual", "ouro", "manual.approved_occlusal_adjustments", 20, "misto"),
  item("manual_reparo_precisao", "Reparo de Precisão", "manual", "ouro", "manual.completed_repairs", 5, "misto"),
  item("manual_tecnica_multimaterial", "Técnica Multimaterial", "manual", "platina", "manual.distinct_techniques", 3, "misto", "técnicas"),
  item("manual_artesao_excelencia", "Artesão de Excelência", "manual", "diamante", "manual.approved_final_inspections", 100, "misto"),

  // Fatiamento — 7
  item("slice_perfil_configurado", "Perfil Configurado", "fatiamento", "comum", "slicing.validated_profiles", 1, "misto"),
  item("slice_suportes_planejados", "Suportes Bem Planejados", "fatiamento", "bronze", "slicing.supports_checked", 20, "misto"),
  item("slice_orientacao_inteligente", "Orientação Inteligente", "fatiamento", "prata", "slicing.validated_orientations", 20, "misto"),
  item("slice_bandeja_organizada", "Bandeja Organizada", "fatiamento", "bronze", "slicing.compatible_batches", 10, "misto"),
  item("slice_aproveitamento_plataforma", "Aproveitamento de Plataforma", "fatiamento", "ouro", "slicing.platforms_at_70_percent", 10, "misto", "bandejas"),
  item("slice_pre_voo_digital", "Pré-voo Digital", "fatiamento", "ouro", "slicing.preflight_checks", 30, "misto"),
  item("slice_rastreavel", "Fatiamento Rastreável", "fatiamento", "platina", "slicing.traceable_exports", 50),

  // Impressão 3D — 8
  item("print_partida_segura", "Partida Segura", "impressao_3d", "comum", "printing.preflight_checks", 10),
  item("print_cuba_inspecionada", "Cuba Inspecionada", "impressao_3d", "bronze", "printing.vat_inspections", 10, "misto"),
  item("print_plataforma_verificada", "Plataforma Verificada", "impressao_3d", "prata", "printing.platform_checks", 15, "misto"),
  item("print_resina_rastreada", "Resina Rastreada", "impressao_3d", "ouro", "printing.resin_traceability_records", 30),
  item("print_bandeja_integral", "Bandeja Integral", "impressao_3d", "platina", "printing.fully_approved_batches", 10, "misto"),
  item("print_pos_processamento", "Pós-processamento Padrão", "impressao_3d", "ouro", "printing.wash_cure_records", 20),
  item("print_manutencao_preventiva", "Manutenção Preventiva 3D", "impressao_3d", "platina", "printing.preventive_maintenance_cycles", 3, "misto", "ciclos"),
  item("print_guardiao_impressora", "Guardião da Impressora", "impressao_3d", "diamante", "printing.inspected_prints", 100, "misto"),

  // Acabamento — 7
  item("finish_remocao_cuidadosa", "Remoção Cuidadosa", "acabamento", "comum", "finishing.damage_free_removals", 20, "misto"),
  item("finish_anatomia_preservada", "Anatomia Preservada", "acabamento", "prata", "finishing.approved_anatomy", 20, "misto"),
  item("finish_uniao_discreta", "Linha de União Discreta", "acabamento", "ouro", "finishing.approved_joints", 15, "misto"),
  item("finish_polimento_uniforme", "Polimento Uniforme", "acabamento", "ouro", "finishing.uniform_polish_approvals", 25, "misto"),
  item("finish_adaptacao_conferida", "Adaptação Conferida", "acabamento", "prata", "finishing.fit_checks", 20, "misto"),
  item("finish_inspecao_360", "Inspeção Final 360°", "acabamento", "platina", "finishing.complete_final_inspections", 30, "misto"),
  item("finish_pronto_entrega", "Pronto para Entrega", "acabamento", "bronze", "finishing.ready_for_delivery", 20),

  // Organização e limpeza — 7
  item("room_bancada_preparada", "Bancada Preparada", "organizacao_limpeza", "comum", "workplace.opening_checklists", 5, "misto"),
  item("room_fechamento_impecavel", "Fechamento Impecável", "organizacao_limpeza", "bronze", "workplace.closing_checklists", 5, "misto"),
  item("room_ferramental_organizado", "Ferramental Organizado", "organizacao_limpeza", "prata", "workplace.tool_audits_passed", 10, "misto"),
  item("room_estoque_identificado", "Estoque Identificado", "organizacao_limpeza", "prata", "workplace.identified_materials", 30),
  item("room_descarte_responsavel", "Descarte Responsável", "organizacao_limpeza", "ouro", "workplace.disposal_records", 10, "misto"),
  item("room_sala_5s", "Sala 5S", "organizacao_limpeza", "platina", "workplace.weekly_5s_passes", 4, "misto", "semanas"),
  item("room_guardiao_ambiente", "Guardião do Ambiente", "organizacao_limpeza", "lendario", "workplace.months_without_open_findings", 6, "misto", "meses"),

  // Agenda — 6
  item("agenda_planejamento_semanal", "Planejamento Semanal", "agenda", "comum", "agenda.consecutive_planned_weeks", 4),
  item("agenda_compromisso_confirmado", "Compromisso Confirmado", "agenda", "bronze", "agenda.confirmed_commitments", 15),
  item("agenda_pontualidade", "Pontualidade de Agenda", "agenda", "prata", "agenda.tasks_completed_on_time", 20),
  item("agenda_sem_conflitos", "Agenda sem Conflitos", "agenda", "ouro", "agenda.days_without_conflicts", 30),
  item("agenda_pendencias_resolvidas", "Pendências Resolvidas", "agenda", "platina", "agenda.tasks_completed_or_rescheduled_before_due", 30),
  item("agenda_retorno_programado", "Retorno Programado", "agenda", "diamante", "agenda.completed_jobs_with_followup", 20)
]);

export function getAchievementProgress(achievement, metrics = {}) {
  const raw = Number(metrics[achievement.metric] ?? 0);
  const current = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const target = achievement.target;
  return Object.freeze({
    current: Math.min(current, target),
    target,
    percent: Math.min(100, Math.floor((current / target) * 100)),
    unlocked: current >= target
  });
}

export function evaluateAchievements(metrics = {}) {
  return NEW_ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    ...getAchievementProgress(achievement, metrics)
  }));
}
