#!/usr/bin/env python3
"""Valida a migração do Almoxarifado em SQLite isolado, sem conexão com produção."""

import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "worker" / "migrations" / "0002_v5100_almoxarifado.sql"


class AlmoxarifadoMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.execute("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT NOT NULL)")
        self.db.execute("INSERT INTO usuarios (id,nome) VALUES (1,'Usuário de teste')")
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def item(self, code, name, tipo="CONSUMIVEL", controla_lote=0, unidade="un"):
        cursor = self.db.execute(
            """INSERT INTO almoxarifado_itens
               (codigo,nome,tipo,unidade,local_padrao,quantidade_minima,controla_lote,criado_por)
               VALUES (?,?,?,?,?,?,?,1)""",
            (code, name, tipo, unidade, "Armário A", 2, controla_lote),
        )
        return cursor.lastrowid

    def lote(self, item_id, code, status="DISPONIVEL", validade="2099-12-31", local="Armário A"):
        cursor = self.db.execute(
            """INSERT INTO almoxarifado_lotes
               (item_id,codigo_lote,validade,localizacao,status,criado_por)
               VALUES (?,?,?,?,?,1)""",
            (item_id, code, validade, local, status),
        )
        return cursor.lastrowid

    def movimento(self, item_id, lote_id, tipo, quantidade, **kwargs):
        fields = ["item_id", "lote_id", "tipo", "quantidade", "usuario_id"]
        values = [item_id, lote_id, tipo, quantidade, 1]
        for key, value in kwargs.items():
            fields.append(key)
            values.append(value)
        placeholders = ",".join("?" for _ in fields)
        return self.db.execute(
            f"INSERT INTO almoxarifado_movimentos ({','.join(fields)}) VALUES ({placeholders})",
            values,
        )

    def saldo(self, lote_id):
        return self.db.execute(
            "SELECT saldo FROM almoxarifado_saldos_lotes WHERE lote_id=?", (lote_id,)
        ).fetchone()[0]

    def test_migration_creates_the_expected_tables_and_views(self):
        names = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','view')"
        )}
        self.assertTrue({
            "almoxarifado_itens", "almoxarifado_lotes", "almoxarifado_movimentos",
            "almoxarifado_requisicoes", "almoxarifado_requisicao_itens",
            "almoxarifado_saldos_lotes", "almoxarifado_saldos_itens",
            "almoxarifado_status_requisicoes",
        }.issubset(names))

    def test_reagents_standards_and_kits_must_control_lot_and_expiry(self):
        for tipo in ("REAGENTE", "PADRAO", "KIT"):
            with self.subTest(tipo=tipo), self.assertRaises(sqlite3.IntegrityError):
                self.item(tipo, tipo, tipo=tipo, controla_lote=0)
            self.item(tipo + "-OK", tipo, tipo=tipo, controla_lote=1)

    def test_balance_is_derived_and_never_goes_negative(self):
        item_id = self.item("PON-01", "Ponteira")
        lote_id = self.lote(item_id, "INT-001")
        self.movimento(item_id, lote_id, "ENTRADA", 10)
        self.movimento(item_id, lote_id, "SAIDA", 3)
        self.assertEqual(self.saldo(lote_id), 7)
        with self.assertRaises(sqlite3.IntegrityError):
            self.movimento(item_id, lote_id, "SAIDA", 8)
        self.assertEqual(self.saldo(lote_id), 7)

    def test_quarantine_and_expired_stock_are_not_available(self):
        item_id = self.item("REA-01", "Reagente", tipo="REAGENTE", controla_lote=1, unidade="mL")
        quarantine = self.lote(item_id, "Q-01", status="QUARENTENA")
        expired = self.lote(item_id, "V-01", validade="2020-01-01")
        self.movimento(item_id, quarantine, "ENTRADA", 5)
        self.movimento(item_id, expired, "ENTRADA", 4)
        saldo_disponivel = self.db.execute(
            "SELECT saldo_disponivel FROM almoxarifado_saldos_itens WHERE item_id=?", (item_id,)
        ).fetchone()[0]
        self.assertEqual(saldo_disponivel, 0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.movimento(item_id, quarantine, "SAIDA", 1)
        with self.assertRaises(sqlite3.IntegrityError):
            self.movimento(item_id, expired, "SAIDA", 1)
        # Descarte por perda é permitido em quarentena, com motivo; vencimento exige lote vencido.
        self.movimento(item_id, quarantine, "PERDA", 1, motivo="Material reprovado")
        self.movimento(item_id, expired, "VENCIMENTO", 4, motivo="Prazo de validade encerrado")
        self.assertEqual(self.saldo(quarantine), 4)
        self.assertEqual(self.saldo(expired), 0)

    def test_transfer_moves_whole_lot_without_changing_stock_balance(self):
        item_id = self.item("PON-02", "Ponteira")
        lote_id = self.lote(item_id, "INT-002")
        self.movimento(item_id, lote_id, "ENTRADA", 6)
        self.movimento(
            item_id, lote_id, "TRANSFERENCIA", 6,
            origem_tipo="TRANSFERENCIA", local_origem="Armário A",
            local_destino="Bancada 2", motivo="Mudança de local",
        )
        self.db.execute("UPDATE almoxarifado_lotes SET localizacao='Bancada 2' WHERE id=?", (lote_id,))
        self.assertEqual(self.saldo(lote_id), 6)
        self.assertEqual(
            self.db.execute("SELECT localizacao FROM almoxarifado_lotes WHERE id=?", (lote_id,)).fetchone()[0],
            "Bancada 2",
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.movimento(
                item_id, lote_id, "TRANSFERENCIA", 2,
                origem_tipo="TRANSFERENCIA", local_origem="Bancada 2",
                local_destino="Geladeira", motivo="Tentativa de transferência parcial",
            )

    def test_requisition_fulfilment_cannot_exceed_request(self):
        item_id = self.item("LUV-01", "Luva")
        lote_id = self.lote(item_id, "INT-003")
        self.movimento(item_id, lote_id, "ENTRADA", 8)
        req = self.db.execute(
            "INSERT INTO almoxarifado_requisicoes (solicitante_id,setor) VALUES (1,'ACABAMENTO')"
        ).lastrowid
        line = self.db.execute(
            "INSERT INTO almoxarifado_requisicao_itens (requisicao_id,item_id,quantidade_solicitada) VALUES (?,?,5)",
            (req, item_id),
        ).lastrowid
        self.movimento(item_id, lote_id, "SAIDA", 2, origem_tipo="REQUISICAO",
                       origem_id=str(req), requisicao_item_id=line)
        self.movimento(item_id, lote_id, "SAIDA", 3, origem_tipo="REQUISICAO",
                       origem_id=str(req), requisicao_item_id=line)
        self.assertEqual(
            self.db.execute(
                "SELECT status FROM almoxarifado_status_requisicoes WHERE requisicao_id=?", (req,)
            ).fetchone()[0],
            "ATENDIDA",
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.movimento(item_id, lote_id, "SAIDA", 1, origem_tipo="REQUISICAO",
                           origem_id=str(req), requisicao_item_id=line)

    def test_movement_history_cannot_be_updated_or_deleted(self):
        item_id = self.item("FITA-01", "Fita")
        lote_id = self.lote(item_id, "INT-004")
        self.movimento(item_id, lote_id, "ENTRADA", 3)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE almoxarifado_movimentos SET quantidade=99 WHERE lote_id=?", (lote_id,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM almoxarifado_movimentos WHERE lote_id=?", (lote_id,))


if __name__ == "__main__":
    unittest.main(verbosity=2)
