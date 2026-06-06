import { ChatHistoryManager } from '../common/storage.js';
import { showToast } from '../common/utils.js';

const CHAT_API_URL = '/api/chat/stream';

const QUICK_ACTIONS = [
    { id: 'suggestion', label: '📝 修改建议', message: '请给我具体的修改建议' },
    { id: 'legal', label: '⚖️ 法律依据', message: '这个风险的法律依据是什么？' },
    { id: 'explain', label: '💡 解释条款', message: '请解释这个条款的含义' }
];

export class ChatAssistant {
    constructor() {
        this.panel = null;
        this.messagesContainer = null;
        this.inputField = null;
        this.sendButton = null;
        this.sessionsList = null;
        this.currentSessionId = null;
        this.isOpen = false;
        this.isStreaming = false;
        this.context = {};
        
        this.init();
    }

    init() {
        this.createPanel();
        this.loadCurrentSession();
        this.bindEvents();
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'chat-panel';
        panel.innerHTML = `
            <div class="chat-header">
                <span class="chat-title">💬 法律助手</span>
                <div class="chat-header-actions">
                    <button class="chat-new-session-btn" title="新建会话">
                        <span class="btn-icon">➕</span>
                        <span class="btn-text">新建</span>
                    </button>
                    <button class="chat-close-btn" title="关闭">✕</button>
                </div>
            </div>
            
            <div class="chat-sessions-toggle">
                <button class="sessions-toggle-btn" id="sessionsToggleBtn">
                    📋 会话列表 <span class="sessions-count">(0)</span>
                </button>
            </div>
            
            <div class="chat-sessions-list" id="chatSessionsList" style="display: none;">
                <div class="sessions-list-header">
                    <button class="create-session-btn" id="createSessionBtn">
                        <span class="btn-icon">➕</span>
                        <span class="btn-text">新建会话</span>
                    </button>
                </div>
                <div class="sessions-list-content"></div>
            </div>
            
            <div class="chat-messages" id="chatMessages">
                <div class="chat-welcome">
                    <div class="welcome-icon">🤖</div>
                    <div class="welcome-text">您好！我是法律助手，可以：</div>
                    <ul class="welcome-features">
                        <li>解答合同风险问题</li>
                        <li>提供修改建议</li>
                        <li>回答法律咨询</li>
                        <li>解释法律条款</li>
                    </ul>
                    <div class="welcome-hint">
                        💡 您可以直接提问法律问题，无需先审查合同
                    </div>
                    <div class="welcome-shortcuts">
                        <span class="shortcut-item">⌨️ <kbd>Ctrl+N</kbd> 新建会话</span>
                    </div>
                </div>
            </div>
            
            <div class="chat-quick-actions">
                ${QUICK_ACTIONS.map(action => `
                    <button class="quick-action-btn" data-action="${action.id}">
                        ${action.label}
                    </button>
                `).join('')}
            </div>
            
            <div class="chat-input-area">
                <textarea 
                    class="chat-input" 
                    id="chatInput" 
                    placeholder="输入您的问题... (Shift+Enter换行)"
                    rows="1"
                ></textarea>
                <button class="chat-send-btn" id="chatSendBtn" title="发送">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        
        this.panel = panel;
        this.messagesContainer = panel.querySelector('#chatMessages');
        this.inputField = panel.querySelector('#chatInput');
        this.sendButton = panel.querySelector('#chatSendBtn');
        this.sessionsList = panel.querySelector('#chatSessionsList');
        this.sessionsToggleBtn = panel.querySelector('#sessionsToggleBtn');
        this.sessionsCount = panel.querySelector('.sessions-count');
    }

    bindEvents() {
        const closeBtn = this.panel.querySelector('.chat-close-btn');
        const newSessionBtn = this.panel.querySelector('.chat-new-session-btn');
        const createSessionBtn = this.panel.querySelector('#createSessionBtn');
        
        closeBtn.addEventListener('click', () => this.close());
        newSessionBtn.addEventListener('click', () => this.createNewSession());
        createSessionBtn.addEventListener('click', () => this.createNewSession());
        
        this.sessionsToggleBtn.addEventListener('click', () => this.toggleSessionsList());
        
        this.sendButton.addEventListener('click', () => this.handleSend());
        
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
            
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.createNewSession();
            }
        });
        
        this.inputField.addEventListener('input', () => {
            this.autoResizeInput();
        });
        
        const quickActionBtns = this.panel.querySelectorAll('.quick-action-btn');
        quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.action;
                this.handleQuickAction(actionId);
            });
        });
        
        const overlay = document.createElement('div');
        overlay.className = 'chat-overlay';
        overlay.addEventListener('click', () => this.close());
        document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    setContext(context) {
        this.context = context;
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.panel.classList.add('show');
        this.overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.inputField.focus();
    }

    close() {
        this.isOpen = false;
        this.panel.classList.remove('show');
        this.overlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    loadCurrentSession() {
        const session = ChatHistoryManager.getCurrentSession();
        
        if (session) {
            this.currentSessionId = session.id;
            this.renderMessages(session.messages);
        } else {
            this.currentSessionId = null;
            this.renderMessages([]);
        }
        
        this.updateSessionsList();
    }

    createNewSession() {
        const session = ChatHistoryManager.createSession();
        this.currentSessionId = session.id;
        this.renderMessages([]);
        this.updateSessionsList();
        
        this.sessionsList.style.display = 'none';
        this.sessionsToggleBtn.classList.remove('active');
        
        setTimeout(() => {
            this.inputField.focus();
        }, 100);
        
        showToast('已创建新会话');
    }

    switchSession(sessionId) {
        if (ChatHistoryManager.setCurrentSession(sessionId)) {
            this.currentSessionId = sessionId;
            const session = ChatHistoryManager.getSession(sessionId);
            this.renderMessages(session.messages);
            this.updateSessionsList();
        }
    }

    deleteSession(sessionId, event) {
        event.stopPropagation();
        
        if (confirm('确定要删除这个会话吗？')) {
            ChatHistoryManager.deleteSession(sessionId);
            
            if (this.currentSessionId === sessionId) {
                const session = ChatHistoryManager.getCurrentSession();
                if (session) {
                    this.currentSessionId = session.id;
                    this.renderMessages(session.messages);
                } else {
                    this.currentSessionId = null;
                    this.renderMessages([]);
                }
            }
            
            this.updateSessionsList();
            showToast('会话已删除');
        }
    }

    toggleSessionsList() {
        const isHidden = this.sessionsList.style.display === 'none';
        this.sessionsList.style.display = isHidden ? 'block' : 'none';
        this.sessionsToggleBtn.classList.toggle('active', isHidden);
    }

    updateSessionsList() {
        const sessions = ChatHistoryManager.getAllSessions();
        const content = this.sessionsList.querySelector('.sessions-list-content');
        
        this.sessionsCount.textContent = `(${sessions.length})`;
        
        if (sessions.length === 0) {
            content.innerHTML = '<div class="no-sessions">暂无会话记录</div>';
            return;
        }
        
        content.innerHTML = sessions.map(session => `
            <div class="session-item ${session.id === this.currentSessionId ? 'active' : ''}" 
                 data-session-id="${session.id}">
                <div class="session-info">
                    <div class="session-title">${this.escapeHtml(session.title)}</div>
                    <div class="session-meta">
                        <span class="session-time">${this.formatTime(session.updatedAt)}</span>
                        <span class="session-messages">${session.messages.length}条消息</span>
                    </div>
                </div>
                <button class="session-delete-btn" data-session-id="${session.id}" title="删除">🗑</button>
            </div>
        `).join('');
        
        content.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('session-delete-btn')) {
                    this.switchSession(item.dataset.sessionId);
                }
            });
        });
        
        content.querySelectorAll('.session-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteSession(btn.dataset.sessionId, e);
            });
        });
    }

    renderMessages(messages) {
        if (messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="chat-welcome">
                    <div class="welcome-icon">🤖</div>
                    <div class="welcome-text">您好！我是法律助手，可以：</div>
                    <ul class="welcome-features">
                        <li>解答合同风险问题</li>
                        <li>提供修改建议</li>
                        <li>回答法律咨询</li>
                        <li>解释法律条款</li>
                    </ul>
                    <div class="welcome-hint">
                        💡 您可以直接提问法律问题，无需先审查合同
                    </div>
                    <div class="welcome-shortcuts">
                        <span class="shortcut-item">⌨️ <kbd>Ctrl+N</kbd> 新建会话</span>
                    </div>
                </div>
            `;
            return;
        }
        
        this.messagesContainer.innerHTML = messages.map(msg => 
            this.renderMessage(msg)
        ).join('');
        
        this.scrollToBottom();
    }

    renderMessage(message) {
        const isUser = message.role === 'user';
        const className = isUser ? 'message-user' : 'message-assistant';
        const icon = isUser ? '👤' : '🤖';
        
        return `
            <div class="chat-message ${className}">
                <div class="message-icon">${icon}</div>
                <div class="message-content">
                    <div class="message-text">${this.formatMessageContent(message.content)}</div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                </div>
            </div>
        `;
    }

    formatMessageContent(content) {
        let formatted = this.escapeHtml(content);
        
        formatted = formatted.replace(/【([^】]+)】/g, '<strong>【$1】</strong>');
        
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    async handleSend() {
        const message = this.inputField.value.trim();
        
        if (!message || this.isStreaming) return;
        
        if (!this.currentSessionId) {
            const session = ChatHistoryManager.createSession(message);
            this.currentSessionId = session.id;
            this.updateSessionsList();
        }
        
        this.addMessage('user', message);
        this.inputField.value = '';
        this.autoResizeInput();
        
        await this.sendMessage(message);
    }

    async handleQuickAction(actionId) {
        const action = QUICK_ACTIONS.find(a => a.id === actionId);
        if (!action) return;
        
        let message = action.message;
        
        if (this.context.selectedRisk !== null && this.context.selectedRisk !== undefined) {
            const risk = this.context.risks[this.context.selectedRisk];
            if (risk) {
                message += `\n\n条款内容：${risk.clause || risk.clauseText}`;
                if (actionId === 'suggestion' && risk.suggestion) {
                    message += `\n\n当前建议：${risk.suggestion}`;
                }
            }
        }
        
        this.inputField.value = message;
        await this.handleSend();
    }

    consultRisk(riskIndex) {
        if (!this.context.risks || !this.context.risks[riskIndex]) return;
        
        const risk = this.context.risks[riskIndex];
        const message = `请帮我分析这个风险点：\n\n${risk.clause || risk.clauseText}\n\n风险原因：${risk.reason}`;
        
        if (!this.isOpen) {
            this.open();
        }
        
        setTimeout(() => {
            this.inputField.value = message;
            this.inputField.focus();
        }, 300);
    }

    addMessage(role, content) {
        const message = { role, content };
        
        ChatHistoryManager.addMessage(this.currentSessionId, message);
        
        const welcomeEl = this.messagesContainer.querySelector('.chat-welcome');
        if (welcomeEl) {
            welcomeEl.remove();
        }
        
        const messageHtml = this.renderMessage({ ...message, timestamp: Date.now() });
        this.messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
        
        this.scrollToBottom();
        this.updateSessionsList();
    }

    async sendMessage(message) {
        this.isStreaming = true;
        this.sendButton.disabled = true;
        
        const loadingMessage = this.createLoadingMessage();
        this.messagesContainer.insertAdjacentHTML('beforeend', loadingMessage);
        this.scrollToBottom();
        
        try {
            const session = ChatHistoryManager.getSession(this.currentSessionId);
            const history = session && session.messages 
                ? session.messages.slice(-10).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
                : [];
            
            const contextToSend = this.context && Object.keys(this.context).length > 0 
                ? this.context 
                : null;
            
            const response = await fetch(CHAT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    context: contextToSend,
                    history
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API错误响应:', errorText);
                throw new Error(`请求失败: ${response.status}`);
            }
            
            const loadingEl = this.messagesContainer.querySelector('.message-loading');
            if (loadingEl) {
                loadingEl.remove();
            }
            
            await this.streamResponse(response);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            
            const loadingEl = this.messagesContainer.querySelector('.message-loading');
            if (loadingEl) {
                loadingEl.remove();
            }
            
            this.addMessage('assistant', '抱歉，发生了错误，请稍后重试。');
            showToast('发送失败，请重试');
        } finally {
            this.isStreaming = false;
            this.sendButton.disabled = false;
        }
    }

    createLoadingMessage() {
        return `
            <div class="chat-message message-assistant message-loading">
                <div class="message-icon">🤖</div>
                <div class="message-content">
                    <div class="message-text">
                        <div class="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async streamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let fullContent = '';
        let messageEl = null;
        let hasError = false;
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.type === 'error') {
                                hasError = true;
                                fullContent = parsed.message || '抱歉，发生了错误，请稍后重试。';
                                break;
                            }
                            
                            if (parsed.type === 'content') {
                                fullContent += parsed.content;
                                
                                if (!messageEl) {
                                    const messageHtml = `
                                        <div class="chat-message message-assistant message-streaming">
                                            <div class="message-icon">🤖</div>
                                            <div class="message-content">
                                                <div class="message-text">${this.formatMessageContent(fullContent)}</div>
                                            </div>
                                        </div>
                                    `;
                                    this.messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
                                    messageEl = this.messagesContainer.querySelector('.message-streaming');
                                } else {
                                    const textEl = messageEl.querySelector('.message-text');
                                    textEl.innerHTML = this.formatMessageContent(fullContent);
                                }
                                
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            console.error('解析流式数据失败:', e, data);
                        }
                    }
                }
                
                if (hasError) break;
            }
        } catch (error) {
            console.error('读取流式响应失败:', error);
            fullContent = '抱歉，读取响应时发生错误，请稍后重试。';
            hasError = true;
        }
        
        if (messageEl) {
            messageEl.classList.remove('message-streaming');
            
            const timeHtml = `<div class="message-time">${this.formatTime(Date.now())}</div>`;
            messageEl.querySelector('.message-content').insertAdjacentHTML('beforeend', timeHtml);
            
            this.addMessage('assistant', fullContent);
            
            messageEl.remove();
        } else if (!fullContent) {
            this.addMessage('assistant', '抱歉，未收到有效回复，请稍后重试。');
        }
    }

    autoResizeInput() {
        this.inputField.style.height = 'auto';
        this.inputField.style.height = Math.min(this.inputField.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        
        return date.toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
