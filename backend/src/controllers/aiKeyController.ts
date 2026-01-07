import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const listKeys = async (req: AuthRequest, res: Response) => {
    try {
        const keys = await prisma.aiApiKey.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(keys);
    } catch (error) {
        console.error('Error listing keys:', error);
        res.status(500).json({ error: 'Erro ao listar chaves' });
    }
};

export const createKey = async (req: AuthRequest, res: Response) => {
    try {
        const { provider, key } = req.body;
        if (!provider || !key) {
            return res.status(400).json({ error: 'Provider e Key são obrigatórios' });
        }

        const newKey = await prisma.aiApiKey.create({
            data: {
                provider,
                key,
                isActive: true
            }
        });
        res.status(201).json(newKey);
    } catch (error) {
        console.error('Error creating key:', error);
        res.status(500).json({ error: 'Erro ao criar chave' });
    }
};

export const updateKey = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { key, isActive } = req.body;

        const updatedKey = await prisma.aiApiKey.update({
            where: { id },
            data: {
                key, // Allow updating the key value
                isActive
            }
        });
        res.json(updatedKey);
    } catch (error) {
        console.error('Error updating key:', error);
        res.status(500).json({ error: 'Erro ao atualizar chave' });
    }
};

export const deleteKey = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.aiApiKey.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting key:', error);
        res.status(500).json({ error: 'Erro ao deletar chave' });
    }
};
