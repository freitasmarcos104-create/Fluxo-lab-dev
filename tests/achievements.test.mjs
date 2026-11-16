import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_CATALOG_VERSION,
  NEW_ACHIEVEMENTS,
  RARITIES,
  evaluateAchievements,
  getAchievementProgress
} from "../worker/modules/achievements.js";

test("catálogo contém exatamente 50 emblemas novos com IDs únicos", () => {
  assert.equal(NEW_ACHIEVEMENTS.length, 50);
  assert.equal(new Set(NEW_ACHIEVEMENTS.map(x => x.id)).size, 50);
  assert.equal(ACHIEVEMENT_CATALOG_VERSION, "1.0.0");
});

test("catálogo cobre as sete categorias planejadas", () => {
  const categories = new Set(NEW_ACHIEVEMENTS.map(x => x.category));
  assert.deepEqual([...categories].sort(), [
    "acabamento", "agenda", "cad_cam", "fatiamento",
    "impressao_3d", "manual", "organizacao_limpeza"
  ]);
});

test("raridades visuais principais possuem ordem e cor definidas", () => {
  const names = ["comum", "bronze", "prata", "ouro", "platina", "diamante", "lendario"];
  for (const name of names) {
    assert.ok(RARITIES[name].label);
    assert.ok(RARITIES[name].color.startsWith("#"));
    assert.ok(RARITIES[name].order > 0);
  }
});

test("progresso limita percentual a 100 e libera ao atingir a meta", () => {
  const badge = NEW_ACHIEVEMENTS.find(x => x.id === "slice_pre_voo_digital");
  assert.deepEqual(getAchievementProgress(badge, { "slicing.preflight_checks": 15 }), {
    current: 15, target: 30, percent: 50, unlocked: false
  });
  assert.equal(getAchievementProgress(badge, { "slicing.preflight_checks": 40 }).percent, 100);
  assert.equal(getAchievementProgress(badge, { "slicing.preflight_checks": 40 }).unlocked, true);
});

test("métricas ausentes ou inválidas não liberam conquistas", () => {
  const badge = NEW_ACHIEVEMENTS[0];
  assert.equal(getAchievementProgress(badge, {}).current, 0);
  assert.equal(getAchievementProgress(badge, { [badge.metric]: "inválido" }).unlocked, false);
  assert.equal(getAchievementProgress(badge, { [badge.metric]: -3 }).current, 0);
});

test("avaliação retorna os 50 emblemas com progresso individual", () => {
  const result = evaluateAchievements({ "cad.complete_files": 10 });
  assert.equal(result.length, 50);
  assert.equal(result.find(x => x.id === "cad_arquivo_completo").unlocked, true);
  assert.equal(result.find(x => x.id === "cad_planejamento_digital").unlocked, false);
});
