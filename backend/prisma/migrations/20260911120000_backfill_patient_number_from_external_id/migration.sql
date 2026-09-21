-- O "Numero do Paciente" e o mesmo valor nas duas telas de cadastro, mas o fluxo de
-- Novo Planejamento gravava apenas em externalId. A sincronizacao de consultas
-- com o EasyDental usa somente patientNumber, entao copiamos o valor para os
-- pacientes que ainda nao o tem preenchido.
UPDATE "Patient"
SET "patientNumber" = "externalId"
WHERE ("patientNumber" IS NULL OR "patientNumber" = '')
  AND "externalId" IS NOT NULL
  AND "externalId" <> '';
