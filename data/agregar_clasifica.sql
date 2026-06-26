-- ============================================================
-- AGREGA el campo "quién clasifica" a eliminatorias
-- Ejecútalo UNA vez en phpMyAdmin (pestaña SQL).
-- NO borra ni modifica datos existentes, solo agrega columnas vacías.
-- La fase de grupos NO se ve afectada.
-- ============================================================
USE u912746025_MainData;

-- En PARTIDOS: guarda quién clasificó realmente (lo pone el admin)
ALTER TABLE partidos
  ADD COLUMN clasifica VARCHAR(50) NULL AFTER desenlace;

-- En PRONOSTICOS: guarda a quién cree el jugador que clasifica
ALTER TABLE pronosticos
  ADD COLUMN clasifica VARCHAR(50) NULL AFTER desenlace;
