import cron from 'node-cron';
import { syncTreatmentAppointments } from '../services/appointmentSync';

// Sincroniza diariamente as datas de ultima/proxima consulta dos tratamentos
// em andamento com a agenda do EasyDental (RPCGetUltimaConsulta).
export const initAppointmentSyncCron = () => {
    // Todo dia as 05:00
    cron.schedule('0 5 * * *', async () => {
        console.log('Running daily treatment appointment sync...');
        try {
            const result = await syncTreatmentAppointments();
            console.log(
                `Appointment sync done: ${result.updated} atualizados, ${result.matched} com match, ` +
                `${result.unmatched} sem match, ${result.fetched} registros da API.`
            );
        } catch (error: any) {
            console.error('Error running appointment sync cron job:', error.message);
        }
    });
};
