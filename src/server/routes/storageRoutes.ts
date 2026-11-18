import { Router } from 'express';
import { randomUUID } from 'crypto';
import { chunkStorage } from '../../services/chunkStorage';
import { getConversationStorage } from '../../services/conversationStorage';
import { getFlashcardStorage } from '../../services/flashcardStorage';
import type { ChunkItem, TargetLang } from '../../types/chunks';
import type {
  FlashcardItem,
  GoogleUserSession,
  SavedConversation,
} from '../../types/polyglot';
import { sanitizeUserId } from '../audioContainer';
import { ROUTE_ALLOWED_KEYS, validateStrictPayload } from '../validators';

const conversationStorage = getConversationStorage();
const flashcardStorage = getFlashcardStorage();

export function createStorageRouter(): Router {
  const router = Router();

  router.get('/api/chunks', async (req, res) => {
    try {
      const userId = sanitizeUserId(req.headers['x-user-id']);
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

  router.post('/api/chunks', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        id?: string;
        chunk?: string;
        literalOrNuance?: string;
        meaning?: string;
        context?: string;
        pronunciationHint?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.createChunk);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const userId = sanitizeUserId(req.headers['x-user-id']);
      const { id, chunk, literalOrNuance, meaning, context, pronunciationHint } = check.data;

      if (!chunk || !literalOrNuance || !meaning) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      }

      const newChunk: ChunkItem = {
        id: id || `custom-${Date.now()}-${randomUUID().slice(0, 6)}`,
        chunk,
        literalOrNuance,
        meaning,
        context: context || 'Personalizado',
        pronunciationHint: pronunciationHint || '',
        userId,
        isCustom: true,
        createdAt: Date.now(),
      };

      await chunkStorage.saveUserChunk(userId, newChunk);
      return res.json({ success: true, chunk: newChunk });
    } catch (error: unknown) {
      console.error('Error in POST /api/chunks:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao salvar chunk.',
      });
    }
  });

  router.delete('/api/chunks/:id', async (req, res) => {
    try {
      const userId = sanitizeUserId(req.headers['x-user-id']);
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

  router.post('/api/auth/google', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        credential?: string;
        email?: string;
        name?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.authGoogle);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { credential, email, name } = check.data;

      if (credential && typeof credential === 'string') {
        const parts = credential.split('.');
        if (parts.length !== 3) {
          return res.status(400).json({ error: 'Token Google inválido.' });
        }
        const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadRaw) as {
          iss?: string;
          sub?: string;
          email?: string;
          name?: string;
          picture?: string;
          exp?: number;
        };

        if (
          !payload.sub ||
          (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com')
        ) {
          return res.status(401).json({ error: 'Emissor do token Google inválido.' });
        }

        if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() - 60_000) {
          return res.status(401).json({ error: 'Token Google expirado. Faça login novamente.' });
        }

        const expectedClientId = (
          process.env.GOOGLE_CLIENT_ID ||
          process.env.VITE_GOOGLE_CLIENT_ID ||
          ''
        ).trim();
        if (expectedClientId) {
          try {
            const verifyResp = await fetch(
              `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
            );
            if (!verifyResp.ok) {
              return res.status(401).json({ error: 'Assinatura do token Google recusada.' });
            }
            const verifiedData = (await verifyResp.json()) as { aud?: string };
            if (verifiedData.aud && verifiedData.aud !== expectedClientId) {
              return res.status(401).json({ error: 'Client ID do token Google não corresponde.' });
            }
          } catch (verifyErr: unknown) {
            console.debug(
              '[Auth] Verificação online tokeninfo indisponível:',
              verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
            );
          }
        }

        const canonicalEmail = (payload.email || '').trim().toLowerCase();
        const rawIdentifier = canonicalEmail
          ? canonicalEmail.replace(/[^a-z0-9]/g, '_').slice(0, 56)
          : String(payload.sub).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56);
        const safeUid = sanitizeUserId(`google_${rawIdentifier}`);
        const user: GoogleUserSession = {
          uid: safeUid,
          name: payload.name || payload.email?.split('@')[0] || 'Usuário Google',
          email: canonicalEmail || payload.email || '',
          picture: payload.picture,
          idToken: credential,
          isGoogleAuthenticated: true,
        };
        return res.json({ success: true, user });
      }

      if (email && typeof email === 'string' && email.includes('@')) {
        const cleanEmail = email.trim().toLowerCase();
        const safeEmailSlug = cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 56);
        const safeUid = sanitizeUserId(`google_${safeEmailSlug}`);
        const displayName =
          typeof name === 'string' && name.trim().length > 0
            ? name.trim().slice(0, 60)
            : cleanEmail.split('@')[0];

        const user: GoogleUserSession = {
          uid: safeUid,
          name: displayName,
          email: cleanEmail,
          isGoogleAuthenticated: true,
        };
        return res.json({ success: true, user });
      }

      return res.status(400).json({ error: 'Credencial ou e-mail Google obrigatório.' });
    } catch (error: unknown) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao autenticar conta Google.',
      });
    }
  });

  router.get('/api/conversations', async (req, res) => {
    try {
      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const check = validateStrictPayload<Partial<SavedConversation>>(
        req.body,
        ROUTE_ALLOWED_KEYS.conversationUpsert
      );
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const check = validateStrictPayload<{ cards?: FlashcardItem[]; card?: FlashcardItem }>(
        req.body,
        ROUTE_ALLOWED_KEYS.flashcardsUpsert
      );
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const userId = sanitizeUserId(req.headers['x-user-id']);
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
      const userId = sanitizeUserId(req.headers['x-user-id']);
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
