import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const listMessageTemplates = async (_req: Request, res: Response) => {
    try {
        const templates = await prisma.messageTemplate.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(templates);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getMessageTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = await prisma.messageTemplate.findUnique({
            where: { id },
        });
        if (!template) return res.status(404).json({ error: 'Modelo de mensagem não encontrado' });
        res.json(template);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createMessageTemplate = async (req: Request, res: Response) => {
    try {
        const { name, category, code, dayOffset, statusKeyword, searchMode } = req.body;

        if (!name || !category || !code) {
            return res.status(400).json({ error: 'name, category e code são obrigatórios' });
        }

        // Validate category
        if (category !== 'utilidade' && category !== 'marketing') {
            return res.status(400).json({ error: 'categoria deve ser "utilidade" ou "marketing"' });
        }

        const template = await prisma.messageTemplate.create({
            data: {
                name,
                category,
                code,
                dayOffset: dayOffset !== undefined ? parseInt(dayOffset, 10) : 0,
                statusKeyword: statusKeyword || '',
                searchMode: searchMode || 'agendamento',
            },
        });

        res.status(201).json(template);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Já existe um modelo com este código de saída' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const updateMessageTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, category, code, dayOffset, statusKeyword, searchMode } = req.body;

        // Validate category if provided
        if (category !== undefined && category !== 'utilidade' && category !== 'marketing') {
            return res.status(400).json({ error: 'categoria deve ser "utilidade" ou "marketing"' });
        }

        const template = await prisma.messageTemplate.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(category !== undefined && { category }),
                ...(code !== undefined && { code }),
                ...(dayOffset !== undefined && { dayOffset: parseInt(dayOffset, 10) }),
                ...(statusKeyword !== undefined && { statusKeyword }),
                ...(searchMode !== undefined && { searchMode }),
            },
        });

        res.json(template);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Modelo de mensagem não encontrado' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Já existe um modelo com este código de saída' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const deleteMessageTemplate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.messageTemplate.delete({
            where: { id },
        });
        res.json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Modelo de mensagem não encontrado' });
        }
        res.status(500).json({ error: error.message });
    }
};
