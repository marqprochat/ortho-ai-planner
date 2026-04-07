import cron from 'node-cron';
import prisma from '../lib/prisma';

// Helper to calculate start & end of a target date to match records
const getStartAndEndOfDayOffset = (daysOffset: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    
    // Set to start of day
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    // Set to end of day
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

export const initCronJobs = () => {
    // Run daily at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily notification automations...');
        try {
            const configs = await prisma.notificationAutomationConfig.findMany({
                where: { isActive: true }
            });

            for (const config of configs) {
                // Determine clinics to filter by. If config.clinicIds is empty, it means all clinics for this tenant.
                // We'll process per-tenant.
                const { tenantId, type, daysConfig, clinicIds } = config;
                
                let clinicFilter = clinicIds && clinicIds.length > 0 ? { in: clinicIds } : undefined;

                if (type === 'PAST_DUE_APPOINTMENT') {
                    // Appointment date passed by X days (daysConfig usually 0) and not rescheduled
                    // Means nextAppointment is between (now - daysConfig - 1 day) and (now - daysConfig)
                    // Wait, we just want to notify when it is exactly X days past due to avoid repeated notifications.
                    const { start, end } = getStartAndEndOfDayOffset(-daysConfig);
                    
                    const treatments = await prisma.treatment.findMany({
                        where: {
                            status: 'EM_ANDAMENTO',
                            nextAppointment: {
                                gte: start,
                                lte: end
                            },
                            patient: {
                                tenantId,
                                clinicId: clinicFilter
                            }
                        },
                        include: { patient: true }
                    });

                    for (const treatment of treatments) {
                        const clinicId = treatment.patient?.clinicId;
                        if (!clinicId) continue;
                        await prisma.notification.create({
                            data: {
                                title: 'Consulta Atrasada',
                                message: `O paciente ${treatment.patient?.name} passou da data de consulta e não houve remarcação.`,
                                type: 'AUTOMATION_PAST_DUE',
                                tenantId,
                                clinicIds: [clinicId]
                            }
                        });
                    }
                } 
                else if (type === 'UPCOMING_APPOINTMENT') {
                    // Appointment is exactly X days in the future
                    const { start, end } = getStartAndEndOfDayOffset(daysConfig);
                    const treatments = await prisma.treatment.findMany({
                        where: {
                            status: 'EM_ANDAMENTO',
                            nextAppointment: {
                                gte: start,
                                lte: end
                            },
                            patient: {
                                tenantId,
                                clinicId: clinicFilter
                            }
                        },
                        include: { patient: true }
                    });

                    for (const treatment of treatments) {
                        const clinicId = treatment.patient?.clinicId;
                        if (!clinicId) continue;
                        await prisma.notification.create({
                            data: {
                                title: 'Aviso de Consulta',
                                message: `O paciente ${treatment.patient?.name} tem consulta agendada para amanhã.`,
                                type: 'AUTOMATION_UPCOMING',
                                tenantId,
                                clinicIds: [clinicId]
                            }
                        });
                    }
                }
                else if (type === 'TREATMENT_END_APPROACHING') {
                    // Treatment deadline is exactly X days in the future
                    const { start, end } = getStartAndEndOfDayOffset(daysConfig);
                    const treatments = await prisma.treatment.findMany({
                        where: {
                            status: 'EM_ANDAMENTO',
                            deadline: {
                                gte: start,
                                lte: end
                            },
                            patient: {
                                tenantId,
                                clinicId: clinicFilter
                            }
                        },
                        include: { patient: true }
                    });

                    for (const treatment of treatments) {
                        const clinicId = treatment.patient?.clinicId;
                        if (!clinicId) continue;
                        await prisma.notification.create({
                            data: {
                                title: 'Término de Tratamento Próximo',
                                message: `O tratamento do paciente ${treatment.patient?.name} termina em ${daysConfig} dias.`,
                                type: 'AUTOMATION_TREATMENT_END',
                                tenantId,
                                clinicIds: [clinicId]
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error running daily notifications cron job:', error);
        }
    });
};
