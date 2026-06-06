import { HISTORY_CONFIG } from './utils.js';

const CHAT_CONFIG = {
    STORAGE_KEY: 'chat_history',
    MAX_SESSIONS: 10,
    MAX_MESSAGES_PER_SESSION: 100
};

export const ChatHistoryManager = {
    getHistory() {
        try {
            const data = localStorage.getItem(CHAT_CONFIG.STORAGE_KEY);
            return data ? JSON.parse(data) : { sessions: [], currentSessionId: null };
        } catch (e) {
            console.error('读取对话历史失败:', e);
            return { sessions: [], currentSessionId: null };
        }
    },

    saveHistory(history) {
        try {
            localStorage.setItem(CHAT_CONFIG.STORAGE_KEY, JSON.stringify(history));
            return true;
        } catch (e) {
            console.error('保存对话历史失败:', e);
            return false;
        }
    },

    generateTitle(message) {
        if (!message) return '新对话';
        const title = message.substring(0, 20);
        return title.length < message.length ? title + '...' : title;
    },

    createSession(firstMessage = null) {
        const history = this.getHistory();
        
        const session = {
            id: Date.now().toString(),
            title: firstMessage ? this.generateTitle(firstMessage) : '新对话',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: []
        };

        history.sessions.unshift(session);
        history.currentSessionId = session.id;

        if (history.sessions.length > CHAT_CONFIG.MAX_SESSIONS) {
            history.sessions = history.sessions.slice(0, CHAT_CONFIG.MAX_SESSIONS);
        }

        this.saveHistory(history);
        return session;
    },

    getSession(id) {
        const history = this.getHistory();
        return history.sessions.find(s => s.id === id);
    },

    getCurrentSession() {
        const history = this.getHistory();
        if (!history.currentSessionId) return null;
        return this.getSession(history.currentSessionId);
    },

    setCurrentSession(id) {
        const history = this.getHistory();
        if (history.sessions.find(s => s.id === id)) {
            history.currentSessionId = id;
            this.saveHistory(history);
            return true;
        }
        return false;
    },

    updateSessionTitle(id, title) {
        const history = this.getHistory();
        const session = history.sessions.find(s => s.id === id);
        if (session) {
            session.title = title;
            session.updatedAt = Date.now();
            this.saveHistory(history);
            return true;
        }
        return false;
    },

    addMessage(sessionId, message) {
        const history = this.getHistory();
        const session = history.sessions.find(s => s.id === sessionId);
        
        if (!session) return false;

        const msg = {
            id: Date.now().toString(),
            role: message.role,
            content: message.content,
            timestamp: Date.now()
        };

        session.messages.push(msg);
        session.updatedAt = Date.now();

        if (session.messages.length > CHAT_CONFIG.MAX_MESSAGES_PER_SESSION) {
            session.messages = session.messages.slice(-CHAT_CONFIG.MAX_MESSAGES_PER_SESSION);
        }

        if (message.role === 'user' && session.messages.length === 1) {
            session.title = this.generateTitle(message.content);
        }

        this.saveHistory(history);
        return true;
    },

    deleteSession(id) {
        const history = this.getHistory();
        const index = history.sessions.findIndex(s => s.id === id);
        
        if (index !== -1) {
            history.sessions.splice(index, 1);
            
            if (history.currentSessionId === id) {
                history.currentSessionId = history.sessions.length > 0 
                    ? history.sessions[0].id 
                    : null;
            }
            
            this.saveHistory(history);
            return true;
        }
        return false;
    },

    clearHistory() {
        localStorage.removeItem(CHAT_CONFIG.STORAGE_KEY);
    },

    getAllSessions() {
        const history = this.getHistory();
        return history.sessions;
    }
};

export const HistoryManager = {
    getHistory() {
        try {
            const data = localStorage.getItem(HISTORY_CONFIG.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取历史记录失败:', e);
            return [];
        }
    },

    saveHistory(history) {
        try {
            localStorage.setItem(HISTORY_CONFIG.STORAGE_KEY, JSON.stringify(history));
            return true;
        } catch (e) {
            console.error('保存历史记录失败:', e);
            return false;
        }
    },

    getStorageSize() {
        try {
            const data = localStorage.getItem(HISTORY_CONFIG.STORAGE_KEY);
            return data ? new Blob([data]).size : 0;
        } catch (e) {
            return 0;
        }
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    },

    extractTitle(text) {
        if (!text) return '未命名合同';
        const firstLine = text.split('\n')[0].trim();
        const title = firstLine.substring(0, 30);
        return title || '未命名合同';
    },

    smartTruncate(text, maxLength) {
        if (text.length <= maxLength) return { text, isTruncated: false };
        
        const truncated = text.substring(0, maxLength);
        const lastSentenceEnd = Math.max(
            truncated.lastIndexOf('。'),
            truncated.lastIndexOf('？'),
            truncated.lastIndexOf('！'),
            truncated.lastIndexOf('.')
        );
        
        const cutPoint = lastSentenceEnd > maxLength * 0.7 
            ? lastSentenceEnd + 1 
            : maxLength;
        
        return {
            text: text.substring(0, cutPoint) + '\n...[已截断]',
            isTruncated: true
        };
    },

    addHistory(contractText, reviewResult) {
        const history = this.getHistory();
        
        const { text: storedContract, isTruncated } = this.smartTruncate(
            contractText, 
            HISTORY_CONFIG.MAX_CONTRACT_LENGTH
        );

        const item = {
            id: Date.now().toString(),
            time: new Date().toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            timestamp: Date.now(),
            title: this.extractTitle(contractText),
            contractText: storedContract,
            isTruncated: isTruncated,
            result: reviewResult,
            score: reviewResult.overall_score || 70,
            riskCount: reviewResult.risks ? reviewResult.risks.length : 0
        };

        history.unshift(item);

        if (history.length > HISTORY_CONFIG.MAX_ITEMS) {
            history.pop();
        }

        while (this.getStorageSize() > HISTORY_CONFIG.MAX_STORAGE_SIZE && history.length > 1) {
            history.pop();
        }

        this.saveHistory(history);
        return item.id;
    },

    deleteHistory(id) {
        const history = this.getHistory();
        const index = history.findIndex(item => item.id === id);
        if (index !== -1) {
            history.splice(index, 1);
            this.saveHistory(history);
        }
    },

    clearHistory() {
        localStorage.removeItem(HISTORY_CONFIG.STORAGE_KEY);
    },

    getHistoryById(id) {
        const history = this.getHistory();
        return history.find(item => item.id === id);
    }
};
