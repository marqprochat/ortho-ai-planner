import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode } from './patientCode';
import {
    selectFollowUpRecords,
    parseFollowUpParams,
    FOLLOW_UP_SEARCH_MODE,
    addDays,
    recentWindow,
    isCanceledOrCompletedStatus,
    buildEasyDentalSnapshot,
    matchesUnitFilter,
    selectPlannerFollowUpRecords,
    PlannerTreatmentCandidate,
} from './followUp';
import type { AgendamentoRecord, UltimaConsultaRecord } from './easydental';

const rec = (over: Partial<UltimaConsultaRecord> = {}): UltimaConsultaRecord => ({
    PACIENTE: 'Paciente Teste',
    CODIGO: '000653',
    ULTIMA_CONSULTA: '2026-08-01',
    CELULAR: '11999990000',
    CONSULTA_AGENDADA: null,
    UNIDADE: 'Unidade A',
    ...over,
});

const ag = (over: Partial<AgendamentoRecord> = {}): AgendamentoRecord => ({
    TX_CODIGO_PACIENTE: '000653',
    PACIENTE: 'Paciente Teste',
    DATA: '2026-11-20',
    STATUS: 'Agendado',
    CELULAR: '11999990000',
    UNIDADE: 'Unidade A',
    ...over,
});

const treatment = (over: Partial<PlannerTreatmentCandidate> = {}): PlannerTreatmentCandidate => ({
    id: 'trt-1',
    patientId: 'pat-1',
    patientName: 'Paciente Teste',
    patientNumber: '653',
    patientPhone: '11988887777',
    clinicName: 'Unidade A',
    clinicNickname: null,
    lastAppointment: '2026-08-01',
    nextAppointment: null,
    ...over,
});

const codes = (...values: string[]) => new Set(values.map((v) => normalizeCode(v) as string));

test('FOLLOW_UP_SEARCH_MODE tem o valor combinado', () => {
    assert.equal(FOLLOW_UP_SEARCH_MODE, 'tratamento-sem-reagendamento');
});

test('normalizeCode iguala 653, 000653 e códigos com máscara', () => {
    assert.equal(normalizeCode('653'), '000653');
    assert.equal(normalizeCode('000653'), '000653');
    assert.equal(normalizeCode('00.653'), '000653');
    assert.equal(normalizeCode(''), null);
    assert.equal(normalizeCode(null), null);
    assert.equal(normalizeCode('abc'), null);
});

test('isCanceledOrCompletedStatus identifica desmarcados, faltas e atendidos, mas mantém agendamentos ativos', () => {
    assert.equal(isCanceledOrCompletedStatus('DCA'), true);
    assert.equal(isCanceledOrCompletedStatus('Desmarcado pelo Paciente'), true);
    assert.equal(isCanceledOrCompletedStatus('Desmarcado pelo Dentista'), true);
    assert.equal(isCanceledOrCompletedStatus('FAL'), true);
    assert.equal(isCanceledOrCompletedStatus('Faltou'), true);
    assert.equal(isCanceledOrCompletedStatus('MDA'), true);
    assert.equal(isCanceledOrCompletedStatus('Mudar horario (desmarcar)'), true);
    assert.equal(isCanceledOrCompletedStatus('NAT'), true);
    assert.equal(isCanceledOrCompletedStatus('Não atendido'), true);
    assert.equal(isCanceledOrCompletedStatus('ATE'), true);
    assert.equal(isCanceledOrCompletedStatus('Atendido'), true);

    assert.equal(isCanceledOrCompletedStatus('Agendado'), false);
    assert.equal(isCanceledOrCompletedStatus('AGD'), false);
    assert.equal(isCanceledOrCompletedStatus('Confirmado'), false);
    assert.equal(isCanceledOrCompletedStatus('CON'), false);
    assert.equal(isCanceledOrCompletedStatus('Aguardando confirmação paciente'), false);
    assert.equal(isCanceledOrCompletedStatus(''), false);
    assert.equal(isCanceledOrCompletedStatus(null), false);
});

test('buildEasyDentalSnapshot consolida última consulta e próxima consulta futura entre RPCs', () => {
    const today = '2026-11-11';
    const snapshot = buildEasyDentalSnapshot(
        [
            rec({ CODIGO: '000653', ULTIMA_CONSULTA: '2026-09-01', CONSULTA_AGENDADA: null, UNIDADE: 'Unidade A' }),
            rec({ CODIGO: '653', ULTIMA_CONSULTA: '2026-10-15', CONSULTA_AGENDADA: '2026-12-01', UNIDADE: 'Unidade B' }),
            rec({ CODIGO: '000700', ULTIMA_CONSULTA: '2026-10-20', CONSULTA_AGENDADA: null }),
        ],
        [
            ag({ TX_CODIGO_PACIENTE: '700', DATA: '2026-11-25', STATUS: 'Desmarcado pelo Paciente' }),
            ag({ TX_CODIGO_PACIENTE: '800', DATA: '2026-11-30', STATUS: 'Confirmado', UNIDADE: 'Unidade C' }),
            ag({ TX_CODIGO_PACIENTE: '900', DATA: '2026-11-01', STATUS: 'Agendado' }), // passada -> ignorada
        ],
        today
    );

    assert.equal(snapshot.get('000653')?.lastAppointment, '2026-10-15');
    assert.equal(snapshot.get('000653')?.nextAppointment, '2026-12-01');
    assert.equal(snapshot.get('000700')?.nextAppointment, null); // desmarcado não conta
    assert.equal(snapshot.get('000800')?.nextAppointment, '2026-11-30');
    assert.equal(snapshot.get('000900'), undefined);
});

test('matchesUnitFilter compara normalizando acentos, maiúsculas e prefixos Unidade/Clínica', () => {
    assert.equal(matchesUnitFilter([], ['Centro']), true);
    assert.equal(matchesUnitFilter(['Centro'], ['Centro']), true);
    assert.equal(matchesUnitFilter(['São Paulo'], ['sao paulo']), true);
    assert.equal(matchesUnitFilter(['Centro'], ['Unidade Centro']), true);
    assert.equal(matchesUnitFilter(['Unidade Centro'], ['Clínica Centro']), true);
    assert.equal(matchesUnitFilter(['Centro'], ['Centro 2']), false);
    assert.equal(matchesUnitFilter(['Centro'], [null, '']), false);
});

test('selectPlannerFollowUpRecords puxa todos os tratamentos sem filtrar por data e exclui quem tem próxima consulta', () => {
    const today = '2026-11-11';
    const snapshot = buildEasyDentalSnapshot(
        [
            rec({ CODIGO: '000100', ULTIMA_CONSULTA: '2026-11-10', CONSULTA_AGENDADA: null, CELULAR: '11911111111' }),
            rec({ CODIGO: '000200', ULTIMA_CONSULTA: '2026-05-01', CONSULTA_AGENDADA: '2026-11-20' }),
        ],
        [
            ag({ TX_CODIGO_PACIENTE: '300', DATA: '2026-12-05', STATUS: 'Agendado' }), // última consulta antiga, mas tem agendamento futuro
            ag({ TX_CODIGO_PACIENTE: '400', DATA: '2026-11-15', STATUS: 'Desmarcado pelo Paciente' }), // desmarcou -> sem próxima consulta
        ],
        today
    );

    const treatments: PlannerTreatmentCandidate[] = [
        treatment({ id: 't1', patientId: 'p1', patientName: 'Ana Ontem', patientNumber: '100', lastAppointment: '2026-11-10' }),
        treatment({ id: 't2', patientId: 'p2', patientName: 'Bruno Agendado', patientNumber: '200' }),
        treatment({ id: 't3', patientId: 'p3', patientName: 'Carla Futuro Agenda', patientNumber: '300' }),
        treatment({ id: 't4', patientId: 'p4', patientName: 'Diego Desmarcou', patientNumber: '400', patientPhone: '11944444444' }),
        treatment({ id: 't5', patientId: 'p5', patientName: 'Eva Antiga Sem Consulta', patientNumber: '500', lastAppointment: '2024-01-10', patientPhone: '11955555555' }),
        treatment({ id: 't6', patientId: 'p6', patientName: 'Fábio Sem Código', patientNumber: null, patientPhone: '11966666666', lastAppointment: null }),
    ];

    const detailsByCode = new Map([['000500', { NOME: 'Eva Antiga', CELULAR: '11999995555' }]]);
    const result = selectPlannerFollowUpRecords(treatments, snapshot, today, { detailsByCode });

    assert.deepEqual(
        result.map((r) => r.PACIENTE),
        ['Ana Ontem', 'Diego Desmarcou', 'Eva Antiga Sem Consulta', 'Fábio Sem Código']
    );
    const eva = result.find((r) => r.PATIENT_ID === 'p5')!;
    assert.equal(eva.CELULAR, '11999995555'); // priorizou celular do EasyDental via RPCGetPacienteCOD
    assert.equal(eva.ULTIMA_CONSULTA, '2024-01-10'); // manteve última consulta do Planner
    assert.equal(eva.HAS_PATIENT_CODE, true);

    const fabio = result.find((r) => r.PATIENT_ID === 'p6')!;
    assert.equal(fabio.HAS_PATIENT_CODE, false);
    assert.equal(fabio.CODIGO, '');
    assert.equal(fabio.CELULAR, '11966666666');
});

test('selectPlannerFollowUpRecords filtra por unidade usando clínica do Planner ou EasyDental e remove duplicados do mesmo paciente', () => {
    const today = '2026-11-11';
    const snapshot = new Map();
    const treatments: PlannerTreatmentCandidate[] = [
        treatment({ id: 't1', patientId: 'p1', patientName: 'Paciente A', patientNumber: '101', clinicName: 'Unidade A' }),
        treatment({ id: 't2', patientId: 'p1', patientName: 'Paciente A', patientNumber: '101', clinicName: 'Unidade A' }),
        treatment({ id: 't3', patientId: 'p2', patientName: 'Paciente B', patientNumber: '102', clinicName: 'Clínica B', clinicNickname: 'Unidade B' }),
    ];

    const result = selectPlannerFollowUpRecords(treatments, snapshot, today, {
        unidades: ['Unidade A'],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].PACIENTE, 'Paciente A');
});

test('selectPlannerFollowUpRecords exclui paciente sem código se nextAppointment no Planner ainda for futuro', () => {
    const today = '2026-11-11';
    const result = selectPlannerFollowUpRecords(
        [
            treatment({ id: 't1', patientId: 'p1', patientName: 'Com Próx', patientNumber: null, nextAppointment: '2026-11-20' }),
            treatment({ id: 't2', patientId: 'p2', patientName: 'Próx Vencida', patientNumber: null, nextAppointment: '2026-11-01' }),
        ],
        new Map(),
        today
    );
    assert.deepEqual(result.map((r) => r.PACIENTE), ['Próx Vencida']);
});

test('parseFollowUpParams ignora datas e normaliza unidades', () => {
    const withoutDates = parseFollowUpParams({
        unidades: ['  Unidade A ', '', 'Unidade B'],
    });
    assert.deepEqual(withoutDates, {
        ok: true,
        data: { unidades: ['Unidade A', 'Unidade B'] },
    });

    const withDates = parseFollowUpParams({
        dt_inicio: 'qualquer',
        dt_termino: 'coisa',
        unidades: 'Unidade A',
    });
    assert.deepEqual(withDates, {
        ok: true,
        data: { unidades: ['Unidade A'] },
    });

    const empty = parseFollowUpParams(null);
    assert.deepEqual(empty, {
        ok: true,
        data: { unidades: [] },
    });
});

test('parseFollowUpParams com requireCodes aceita codigos e/ou treatment_ids', () => {
    const okCodes = parseFollowUpParams({ codigos: ['000653', ' 700 '] }, { requireCodes: true });
    assert.deepEqual(okCodes.ok && okCodes.data.codigos, ['000653', '700']);

    const okTreatments = parseFollowUpParams({ treatment_ids: ['trt-1', 'trt-2'] }, { requireCodes: true });
    assert.deepEqual(okTreatments.ok && okTreatments.data.treatmentIds, ['trt-1', 'trt-2']);

    assert.equal(parseFollowUpParams({}, { requireCodes: true }).ok, false);
    assert.equal(parseFollowUpParams({ codigos: [123] }, { requireCodes: true }).ok, false);
    assert.equal(parseFollowUpParams({ treatment_ids: 'x' }, { requireCodes: true }).ok, false);
});

test('parseFollowUpParams limita a quantidade de códigos', () => {
    const codigos = Array.from({ length: 5001 }, (_, i) => String(i));
    const result = parseFollowUpParams({ codigos }, { requireCodes: true });
    assert.deepEqual(result, { ok: false, error: 'codigos excede o limite de 5000' });
});

test('selectFollowUpRecords legado continua funcionando', () => {
    const result = selectFollowUpRecords([rec()], codes('653'));
    assert.equal(result.length, 1);
    assert.equal(selectFollowUpRecords([rec({ CONSULTA_AGENDADA: '2026-10-20' })], codes('653')).length, 0);
});

test('addDays e recentWindow', () => {
    assert.equal(addDays('2026-10-05', 1), '2026-10-06');
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.deepEqual(recentWindow('2026-09-05', '2026-10-05'), { dtInicio: '2026-09-06', dtTermino: '2026-10-05' });
    assert.equal(recentWindow('2026-10-05', '2026-10-05'), null);
});
