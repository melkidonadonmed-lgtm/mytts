import { Router } from 'express';
import { chunkStorage } from '../../services/chunkStorage';
import { getConversationStorage } from '../../services/conversationStorage';
import { getFlashcardStorage } from '../../services/flashcardStorage';
import type { TargetLang } from '../../types/chunks';
import type {
  FlashcardItem,
  SavedConversation,
} from '../../types/polyglot';
import {
  clearSessionCookie,
  getVerifiedSessionFromRequest,
  resolveRequestUserId,
  setSessionCookie,
  verifyGoogleIdToken,
} from '../authSession';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../validators';

const conversationStorage = getConversationStorage();
const flashcardStorage = getFlashcardStorage();

export function createStorageRouter(): Router {
  const router = Router();

  router.get('/api/chunks', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const lang = req.query.lang as TargetLang | undefined;
      const userChunks = await chunkStorage.listUserChunks(userId, lang);
      return res.json({ success: true, chunks: userChunks });
    } catch (error: unknown) {
      console.error('Error in GET /api/chunks:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao buscar chunks do usuário.',
      });
    }
  });

  router.delete('/api/chunks/:id', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const deleted = await chunkStorage.deleteUserChunk(userId, req.params.id);
      return res.json({ success: true, deleted });
    } catch (error: unknown) {
      console.error('Error in DELETE /api/chunks/:id:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao excluir chunk.',
      });
    }
  });

  router.get('/api/auth/config', (_req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
      projectId: process.env.GCP_PROJECT_ID || 'agent-md-506215',
      region: 'southamerica-east1',
    });
  });

  router.get('/api/auth/me', (req, res) => {
    const session = getVerifiedSessionFromRequest(req);
    if (session) {
      return res.json({
        success: true,
        authenticated: true,
        user: session,
      });
    }
    return res.json({
      success: true,
      authenticated: false,
      user: null,
    });
  });

  router.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ success: true });
  });

  router.post('/api/auth/google', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        credential?: unknown;
      }>(req.body, ROUTE_ALLOWED_KEYS.authGoogle);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { credential } = check.data;
      if (typeof credential !== 'string' || credential.trim().length === 0) {
        return res.status(400).json({ error: 'Credencial Google obrigatória.' });
      }

      const verified = await verifyGoogleIdToken(credential.trim());
      if (!verified.ok) {
        return res.status(verified.status).json({ error: verified.error });
      }

      setSessionCookie(res, verified.user);
      return res.json({ success: true, user: verified.user });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao autenticar conta Google.',
      });
    }
  });

  router.get('/api/conversations', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const conversations = await conversationStorage.listByUser(userId);
      return res.json({
        success: true,
        storageMode: conversationStorage.mode,
        conversations,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao listar histórico de conversas.',
      });
    }
  });

  router.post('/api/conversations', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const check = validateStrictPayload<Partial<SavedConversation>>(
        req.body,
        ROUTE_ALLOWED_KEYS.conversationUpsert
      );
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const userId = identity.userId;
      const body = check.data;
      if (!body.id || !Array.isArray(body.messages)) {
        return res
          .status(400)
          .json({ error: 'Dados da conversa inválidos (id e messages são obrigatórios).' });
      }

      const convToSave: SavedConversation = {
        id: String(body.id).slice(0, 80),
        userId,
        userName: String(body.userName || 'Familiar').slice(0, 80),
        userEmail: body.userEmail ? String(body.userEmail).slice(0, 120) : undefined,
        title: String(body.title || 'Conversa Poliglota').slice(0, 140),
        customTitle: Boolean(body.customTitle),
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: Boolean(body.pinned),
        originMode: body.originMode || 'polyglot',
        messages: body.messages.slice(-40),
      };

      const saved = await conversationStorage.upsert(userId, convToSave);
      return res.json({ success: true, conversation: saved });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao salvar conversa no histórico.',
      });
    }
  });

  router.delete('/api/conversations/:id', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const convId = String(req.params.id || '').slice(0, 80);
      const deleted = await conversationStorage.remove(userId, convId);
      return res.json({ success: true, deleted });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao remover conversa do histórico.',
      });
    }
  });

  router.delete('/api/conversations', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const removedCount = await conversationStorage.clearUnpinned(userId);
      return res.json({ success: true, removedCount });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao limpar conversas não fixadas.',
      });
    }
  });

  router.get('/api/flashcards', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const cards = await flashcardStorage.listByUser(userId);
      return res.json({
        success: true,
        storageMode: flashcardStorage.mode,
        cards,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao listar flashcards do usuário.',
      });
    }
  });

  router.post('/api/flashcards', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const check = validateStrictPayload<{ cards?: FlashcardItem[]; card?: FlashcardItem }>(
        req.body,
        ROUTE_ALLOWED_KEYS.flashcardsUpsert
      );
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const userId = identity.userId;
      const body = check.data;
      const incoming: FlashcardItem[] = Array.isArray(body.cards)
        ? body.cards.slice(0, 500)
        : body.card
          ? [body.card]
          : [];

      if (incoming.length === 0) {
        return res.status(400).json({ error: 'Informe card ou cards para salvar no baralho.' });
      }

      const saved = await flashcardStorage.upsertMany(userId, incoming);
      return res.json({
        success: true,
        storageMode: flashcardStorage.mode,
        cards: saved,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao salvar flashcards.',
      });
    }
  });

  router.delete('/api/flashcards/:id', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const cardId = String(req.params.id || '').slice(0, 80);
      const deleted = await flashcardStorage.remove(userId, cardId);
      return res.json({ success: true, deleted });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao excluir flashcard.',
      });
    }
  });

  router.delete('/api/flashcards', async (req, res) => {
    try {
      const identity = resolveRequestUserId(req);
      if (!identity.ok) {
        return res.status(identity.status).json({ error: identity.error });
      }
      const userId = identity.userId;
      const clearedCount = await flashcardStorage.clearByUser(userId);
      return res.json({ success: true, clearedCount });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao limpar baralho de flashcards.',
      });
    }
  });

  return router;
}
