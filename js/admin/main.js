const API_BASE = 'http://localhost:3001/api/admin';

let currentAgent = null;
let currentKb = null;
let knowledgeBases = [];

const loginContainer = document.getElementById('loginContainer');
const adminContainer = document.getElementById('adminContainer');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const menuItems = document.querySelectorAll('.menu-item');
const agentsSection = document.getElementById('agentsSection');
const knowledgeSection = document.getElementById('knowledgeSection');
const promptsSection = document.getElementById('promptsSection');

const agentsList = document.getElementById('agentsList');
const knowledgeList = document.getElementById('knowledgeList');
const promptAgentSelect = document.getElementById('promptAgentSelect');
const promptEditorContainer = document.getElementById('promptEditorContainer');
const promptEditor = document.getElementById('promptEditor');
const testTextInput = document.getElementById('testTextInput');
const testResult = document.getElementById('testResult');

const modalOverlay = document.getElementById('modalOverlay');
const agentModal = document.getElementById('agentModal');
const kbModal = document.getElementById('kbModal');
const documentModal = document.getElementById('documentModal');
const historyModal = document.getElementById('historyModal');
const searchTestModal = document.getElementById('searchTestModal');

const toast = document.getElementById('toast');

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/check-auth`, { credentials: 'include' });
        const data = await res.json();
        if (data.isLoggedIn) {
            showAdmin();
        }
    } catch (e) {
        console.error('检查登录状态失败:', e);
    }
}

function showAdmin() {
    loginContainer.style.display = 'none';
    adminContainer.style.display = 'block';
    loadAgents();
    loadKnowledgeBases();
}

function showLogin() {
    loginContainer.style.display = 'flex';
    adminContainer.style.display = 'none';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: passwordInput.value })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showAdmin();
            showToast('登录成功', 'success');
        } else {
            loginError.textContent = data.message || '登录失败';
        }
    } catch (e) {
        loginError.textContent = '网络错误，请重试';
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        showLogin();
        showToast('已退出登录');
    } catch (e) {
        console.error('退出登录失败:', e);
    }
});

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const section = item.dataset.section;
        agentsSection.style.display = section === 'agents' ? 'block' : 'none';
        knowledgeSection.style.display = section === 'knowledge' ? 'block' : 'none';
        promptsSection.style.display = section === 'prompts' ? 'block' : 'none';
    });
});

async function loadAgents() {
    try {
        const res = await fetch(`${API_BASE}/agents`, { credentials: 'include' });
        const agents = await res.json();
        renderAgents(agents);
        updatePromptSelect(agents);
    } catch (e) {
        showToast('加载智能体失败', 'error');
    }
}

function renderAgents(agents) {
    agentsList.innerHTML = agents.map(agent => `
        <div class="agent-card" data-id="${agent.id}">
            <div class="agent-icon">${agent.icon || '⚖️'}</div>
            <div class="agent-info">
                <div class="agent-name">${agent.name}</div>
                <div class="agent-desc">${agent.description || '暂无描述'}</div>
                <div class="agent-meta">
                    <span>📋 ${getContractTypeName(agent.contract_type)}</span>
                    <span class="agent-status ${agent.is_active ? 'active' : 'inactive'}">
                        ${agent.is_active ? '✅ 已启用' : '❌ 已禁用'}
                    </span>
                </div>
            </div>
            <div class="agent-actions">
                <button class="btn-secondary btn-sm edit-agent" data-id="${agent.id}">编辑</button>
                <button class="btn-danger btn-sm delete-agent" data-id="${agent.id}">删除</button>
            </div>
        </div>
    `).join('');
    
    agentsList.querySelectorAll('.edit-agent').forEach(btn => {
        btn.addEventListener('click', () => editAgent(btn.dataset.id));
    });
    
    agentsList.querySelectorAll('.delete-agent').forEach(btn => {
        btn.addEventListener('click', () => deleteAgent(btn.dataset.id));
    });
}

function getContractTypeName(type) {
    const types = {
        'general': '通用',
        'property': '物权类',
        'financial': '金融类',
        'construction': '建设工程类',
        'service': '服务类',
        'ip': '知识产权与技术类',
        'labor': '人身与劳动类',
        'equity': '公司股权类'
    };
    return types[type] || type;
}

function updatePromptSelect(agents) {
    promptAgentSelect.innerHTML = '<option value="">选择智能体...</option>' +
        agents.filter(a => a.is_active).map(a => 
            `<option value="${a.id}">${a.icon || '⚖️'} ${a.name}</option>`
        ).join('');
}

promptAgentSelect.addEventListener('change', async (e) => {
    const agentId = e.target.value;
    if (!agentId) {
        promptEditorContainer.style.display = 'none';
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/agents/${agentId}`, { credentials: 'include' });
        currentAgent = await res.json();
        promptEditor.value = currentAgent.system_prompt || '';
        promptEditorContainer.style.display = 'block';
    } catch (e) {
        showToast('加载提示词失败', 'error');
    }
});

document.getElementById('savePromptBtn').addEventListener('click', async () => {
    if (!currentAgent) return;
    
    try {
        await fetch(`${API_BASE}/agents/${currentAgent.id}/prompt-versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                prompt_content: currentAgent.system_prompt,
                version_note: '自动保存'
            })
        });
        
        const res = await fetch(`${API_BASE}/agents/${currentAgent.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                ...currentAgent,
                system_prompt: promptEditor.value,
                knowledge_base_ids: JSON.parse(currentAgent.knowledge_base_ids || '[]'),
                review_focus: JSON.parse(currentAgent.review_focus || '[]')
            })
        });
        
        if (res.ok) {
            showToast('提示词已保存', 'success');
            currentAgent.system_prompt = promptEditor.value;
        }
    } catch (e) {
        showToast('保存失败', 'error');
    }
});

document.getElementById('testPromptBtn').addEventListener('click', async () => {
    if (!promptEditor.value || !testTextInput.value) {
        showToast('请填写提示词和测试文本', 'error');
        return;
    }
    
    testResult.textContent = '正在测试...';
    
    try {
        const res = await fetch(`${API_BASE}/test-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                prompt: promptEditor.value,
                testText: testTextInput.value
            })
        });
        
        const data = await res.json();
        testResult.textContent = data.result || JSON.stringify(data, null, 2);
    } catch (e) {
        testResult.textContent = '测试失败: ' + e.message;
    }
});

document.getElementById('historyPromptBtn').addEventListener('click', async () => {
    if (!currentAgent) return;
    
    try {
        const res = await fetch(`${API_BASE}/agents/${currentAgent.id}/prompt-versions`, {
            credentials: 'include'
        });
        const versions = await res.json();
        
        document.getElementById('promptHistoryList').innerHTML = versions.length ? 
            versions.map(v => `
                <div class="history-item" data-id="${v.id}">
                    <div class="history-time">${new Date(v.created_at).toLocaleString()}</div>
                    <div class="history-note">${v.version_note || '无备注'}</div>
                </div>
            `).join('') : '<p style="text-align:center;color:#64748b;">暂无历史版本</p>';
        
        showModal(historyModal);
        
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', async () => {
                if (confirm('确定恢复此版本吗？')) {
                    try {
                        await fetch(`${API_BASE}/agents/${currentAgent.id}/restore-prompt/${item.dataset.id}`, {
                            method: 'POST',
                            credentials: 'include'
                        });
                        showToast('已恢复历史版本', 'success');
                        hideModal(historyModal);
                        promptAgentSelect.dispatchEvent(new Event('change'));
                    } catch (e) {
                        showToast('恢复失败', 'error');
                    }
                }
            });
        });
    } catch (e) {
        showToast('加载历史版本失败', 'error');
    }
});

document.getElementById('addAgentBtn').addEventListener('click', () => {
    currentAgent = null;
    document.getElementById('agentModalTitle').textContent = '新建智能体';
    document.getElementById('agentId').value = '';
    document.getElementById('agentName').value = '';
    document.getElementById('agentIcon').value = '';
    document.getElementById('agentDescription').value = '';
    document.getElementById('agentContractType').value = 'general';
    document.getElementById('agentSortOrder').value = '0';
    document.getElementById('agentReviewFocus').value = '';
    document.getElementById('agentActive').checked = true;
    renderKbCheckboxes([]);
    showModal(agentModal);
});

async function editAgent(id) {
    try {
        const res = await fetch(`${API_BASE}/agents/${id}`, { credentials: 'include' });
        currentAgent = await res.json();
        
        document.getElementById('agentModalTitle').textContent = '编辑智能体';
        document.getElementById('agentId').value = currentAgent.id;
        document.getElementById('agentName').value = currentAgent.name;
        document.getElementById('agentIcon').value = currentAgent.icon || '';
        document.getElementById('agentDescription').value = currentAgent.description || '';
        document.getElementById('agentContractType').value = currentAgent.contract_type || 'general';
        document.getElementById('agentSortOrder').value = currentAgent.sort_order || 0;
        
        const reviewFocus = JSON.parse(currentAgent.review_focus || '[]');
        document.getElementById('agentReviewFocus').value = reviewFocus.join('\n');
        
        document.getElementById('agentActive').checked = !!currentAgent.is_active;
        
        const kbIds = JSON.parse(currentAgent.knowledge_base_ids || '[]');
        renderKbCheckboxes(kbIds);
        
        showModal(agentModal);
    } catch (e) {
        showToast('加载智能体失败', 'error');
    }
}

async function deleteAgent(id) {
    if (!confirm('确定要删除此智能体吗？')) return;
    
    try {
        await fetch(`${API_BASE}/agents/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        showToast('已删除', 'success');
        loadAgents();
    } catch (e) {
        showToast('删除失败', 'error');
    }
}

function renderKbCheckboxes(selectedIds) {
    const container = document.getElementById('knowledgeBaseCheckboxes');
    container.innerHTML = knowledgeBases.map(kb => `
        <label class="checkbox-label">
            <input type="checkbox" value="${kb.id}" ${selectedIds.includes(kb.id) ? 'checked' : ''}>
            ${kb.name}
        </label>
    `).join('');
}

document.getElementById('submitAgentBtn').addEventListener('click', async () => {
    const id = document.getElementById('agentId').value;
    const name = document.getElementById('agentName').value;
    
    if (!name) {
        showToast('请填写智能体名称', 'error');
        return;
    }
    
    const kbCheckboxes = document.querySelectorAll('#knowledgeBaseCheckboxes input:checked');
    const kbIds = Array.from(kbCheckboxes).map(cb => parseInt(cb.value));
    
    const reviewFocusText = document.getElementById('agentReviewFocus').value;
    const reviewFocus = reviewFocusText.split('\n').filter(s => s.trim());
    
    const data = {
        name,
        icon: document.getElementById('agentIcon').value || '⚖️',
        description: document.getElementById('agentDescription').value,
        contract_type: document.getElementById('agentContractType').value,
        sort_order: parseInt(document.getElementById('agentSortOrder').value) || 0,
        knowledge_base_ids: kbIds,
        review_focus: reviewFocus,
        is_active: document.getElementById('agentActive').checked,
        system_prompt: currentAgent?.system_prompt || ''
    };
    
    try {
        const url = id ? `${API_BASE}/agents/${id}` : `${API_BASE}/agents`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            showToast(id ? '已更新' : '已创建', 'success');
            hideModal(agentModal);
            loadAgents();
        }
    } catch (e) {
        showToast('操作失败', 'error');
    }
});

document.getElementById('cancelAgentBtn').addEventListener('click', () => hideModal(agentModal));
document.getElementById('closeAgentModal').addEventListener('click', () => hideModal(agentModal));

async function loadKnowledgeBases() {
    try {
        const res = await fetch(`${API_BASE}/knowledge-bases`, { credentials: 'include' });
        knowledgeBases = await res.json();
        renderKnowledgeBases(knowledgeBases);
    } catch (e) {
        showToast('加载知识库失败', 'error');
    }
}

function renderKnowledgeBases(kbs) {
    knowledgeList.innerHTML = kbs.length ? kbs.map(kb => `
        <div class="kb-card" data-id="${kb.id}">
            <div class="agent-icon">📚</div>
            <div class="kb-info">
                <div class="kb-name">${kb.name}</div>
                <div class="kb-desc">${kb.description || '暂无描述'}</div>
                <div class="kb-meta">
                    <span>📄 ${kb.document_count || 0} 个文档</span>
                    <span>📝 ${kb.chunk_count || 0} 个片段</span>
                    ${kb.contract_type ? `<span>📋 ${getContractTypeName(kb.contract_type)}</span>` : ''}
                </div>
            </div>
            <div class="kb-actions">
                <button class="btn-secondary btn-sm manage-docs" data-id="${kb.id}">文档管理</button>
                <button class="btn-secondary btn-sm test-search" data-id="${kb.id}">检索测试</button>
                <button class="btn-secondary btn-sm edit-kb" data-id="${kb.id}">编辑</button>
                <button class="btn-danger btn-sm delete-kb" data-id="${kb.id}">删除</button>
            </div>
        </div>
    `).join('') : '<p style="text-align:center;color:#64748b;padding:40px;">暂无知识库，点击右上角新建</p>';
    
    knowledgeList.querySelectorAll('.manage-docs').forEach(btn => {
        btn.addEventListener('click', () => openDocumentManager(btn.dataset.id));
    });
    
    knowledgeList.querySelectorAll('.test-search').forEach(btn => {
        btn.addEventListener('click', () => openSearchTest(btn.dataset.id));
    });
    
    knowledgeList.querySelectorAll('.edit-kb').forEach(btn => {
        btn.addEventListener('click', () => editKb(btn.dataset.id));
    });
    
    knowledgeList.querySelectorAll('.delete-kb').forEach(btn => {
        btn.addEventListener('click', () => deleteKb(btn.dataset.id));
    });
}

document.getElementById('addKbBtn').addEventListener('click', () => {
    currentKb = null;
    document.getElementById('kbModalTitle').textContent = '新建知识库';
    document.getElementById('kbId').value = '';
    document.getElementById('kbName').value = '';
    document.getElementById('kbDescription').value = '';
    document.getElementById('kbContractType').value = '';
    showModal(kbModal);
});

async function editKb(id) {
    try {
        const res = await fetch(`${API_BASE}/knowledge-bases/${id}`, { credentials: 'include' });
        currentKb = await res.json();
        
        document.getElementById('kbModalTitle').textContent = '编辑知识库';
        document.getElementById('kbId').value = currentKb.id;
        document.getElementById('kbName').value = currentKb.name;
        document.getElementById('kbDescription').value = currentKb.description || '';
        document.getElementById('kbContractType').value = currentKb.contract_type || '';
        
        showModal(kbModal);
    } catch (e) {
        showToast('加载知识库失败', 'error');
    }
}

async function deleteKb(id) {
    if (!confirm('确定要删除此知识库吗？所有文档将被删除。')) return;
    
    try {
        await fetch(`${API_BASE}/knowledge-bases/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        showToast('已删除', 'success');
        loadKnowledgeBases();
    } catch (e) {
        showToast('删除失败', 'error');
    }
}

document.getElementById('submitKbBtn').addEventListener('click', async () => {
    const id = document.getElementById('kbId').value;
    const name = document.getElementById('kbName').value;
    
    if (!name) {
        showToast('请填写知识库名称', 'error');
        return;
    }
    
    const data = {
        name,
        description: document.getElementById('kbDescription').value,
        contract_type: document.getElementById('kbContractType').value
    };
    
    try {
        const url = id ? `${API_BASE}/knowledge-bases/${id}` : `${API_BASE}/knowledge-bases`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            showToast(id ? '已更新' : '已创建', 'success');
            hideModal(kbModal);
            loadKnowledgeBases();
        }
    } catch (e) {
        showToast('操作失败', 'error');
    }
});

document.getElementById('cancelKbBtn').addEventListener('click', () => hideModal(kbModal));
document.getElementById('closeKbModal').addEventListener('click', () => hideModal(kbModal));

let currentKbId = null;

async function openDocumentManager(kbId) {
    currentKbId = kbId;
    await loadDocuments(kbId);
    showModal(documentModal);
}

async function loadDocuments(kbId) {
    try {
        const res = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents`, {
            credentials: 'include'
        });
        const docs = await res.json();
        
        const container = document.getElementById('documentsList');
        container.innerHTML = docs.length ? docs.map(doc => `
            <div class="document-item" data-id="${doc.id}">
                <span class="doc-icon">📄</span>
                <div class="doc-info">
                    <div class="doc-name">${doc.file_name}</div>
                    <div class="doc-meta">
                        ${formatFileSize(doc.file_size)} · 
                        ${doc.chunk_count || 0} 个片段 · 
                        ${new Date(doc.created_at).toLocaleDateString()}
                    </div>
                    ${renderProgressBar(doc)}
                </div>
                <div class="doc-actions">
                    ${doc.status === 'failed' && doc.error_message ? 
                        `<span class="error-tooltip" title="${doc.error_message}">❌ 错误</span>` : ''}
                    ${doc.status === 'pending' || doc.status === 'failed' ? 
                        `<button class="btn-primary btn-sm process-doc" data-id="${doc.id}">开始处理</button>` : ''}
                    ${doc.status === 'processing' ? 
                        `<span class="processing-indicator">处理中...</span>` : ''}
                    <button class="btn-danger btn-sm delete-doc" data-id="${doc.id}">删除</button>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:#64748b;padding:20px;">暂无文档，请上传</p>';
        
        container.querySelectorAll('.process-doc').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = btn.dataset.id;
                btn.disabled = true;
                btn.textContent = '启动中...';
                
                try {
                    const res = await fetch(`${API_BASE}/documents/${docId}/process`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok) {
                        showToast('文档处理已启动', 'success');
                        setTimeout(() => loadDocuments(currentKbId), 1000);
                    } else {
                        showToast(data.message || '启动处理失败', 'error');
                        btn.disabled = false;
                        btn.textContent = '开始处理';
                    }
                } catch (e) {
                    showToast('启动处理失败', 'error');
                    btn.disabled = false;
                    btn.textContent = '开始处理';
                }
            });
        });
        
        container.querySelectorAll('.delete-doc').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('确定删除此文档吗？')) return;
                try {
                    await fetch(`${API_BASE}/documents/${btn.dataset.id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    showToast('已删除', 'success');
                    loadDocuments(currentKbId);
                    loadKnowledgeBases();
                } catch (e) {
                    showToast('删除失败', 'error');
                }
            });
        });
        
        startDocumentStatusPolling(kbId, docs);
    } catch (e) {
        showToast('加载文档失败', 'error');
    }
}

function renderProgressBar(doc) {
    const steps = [
        { key: 'pending', label: '等待处理', icon: '⏳' },
        { key: 'processing', label: '处理中', icon: '⚙️' },
        { key: 'completed', label: '已完成', icon: '✅' }
    ];
    
    const statusIndex = steps.findIndex(s => s.key === doc.status);
    const isFailed = doc.status === 'failed';
    
    if (isFailed) {
        return `
            <div class="progress-container failed">
                <div class="progress-steps">
                    <div class="progress-step failed">
                        <span class="step-icon">❌</span>
                        <span class="step-label">处理失败</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="progress-container">
            <div class="progress-steps">
                ${steps.map((step, index) => {
                    const isActive = index <= statusIndex;
                    const isCurrent = index === statusIndex;
                    return `
                        <div class="progress-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
                            <span class="step-icon">${step.icon}</span>
                            <span class="step-label">${step.label}</span>
                        </div>
                        ${index < steps.length - 1 ? `
                            <div class="progress-line ${index < statusIndex ? 'completed' : ''}"></div>
                        ` : ''}
                    `;
                }).join('')}
            </div>
            ${doc.status === 'processing' ? `
                <div class="progress-animation">
                    <div class="progress-dots">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </div>
                    <span class="progress-text">正在提取文本和生成向量...</span>
                </div>
            ` : ''}
        </div>
    `;
}

let pollingInterval = null;

function startDocumentStatusPolling(kbId, docs) {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    const hasProcessing = docs.some(doc => doc.status === 'pending' || doc.status === 'processing');
    
    if (hasProcessing) {
        pollingInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents`, {
                    credentials: 'include'
                });
                const latestDocs = await res.json();
                
                const stillProcessing = latestDocs.some(doc => doc.status === 'pending' || doc.status === 'processing');
                
                if (!stillProcessing) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    loadDocuments(kbId);
                    loadKnowledgeBases();
                } else {
                    updateDocumentStatus(latestDocs);
                }
            } catch (e) {
                console.error('轮询文档状态失败:', e);
            }
        }, 3000);
    }
}

function updateDocumentStatus(docs) {
    docs.forEach(doc => {
        const docElement = document.querySelector(`.document-item[data-id="${doc.id}"]`);
        if (docElement) {
            const progressBarContainer = docElement.querySelector('.progress-container');
            if (progressBarContainer) {
                progressBarContainer.outerHTML = renderProgressBar(doc);
            }
        }
    });
}

function formatFileSize(bytes) {
    if (!bytes) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function getStatusText(status) {
    const texts = {
        'pending': '等待处理',
        'processing': '处理中',
        'completed': '已完成',
        'failed': '失败'
    };
    return texts[status] || status;
}

document.getElementById('documentFile').addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length || !currentKbId) return;
    
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch(`${API_BASE}/knowledge-bases/${currentKbId}/documents`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            
            if (res.ok) {
                showToast(`${file.name} 上传成功`, 'success');
            }
        } catch (e) {
            showToast(`${file.name} 上传失败`, 'error');
        }
    }
    
    e.target.value = '';
    setTimeout(() => {
        loadDocuments(currentKbId);
        loadKnowledgeBases();
    }, 1000);
});

document.getElementById('closeDocumentModal').addEventListener('click', () => hideModal(documentModal));

document.getElementById('processAllDocsBtn').addEventListener('click', async () => {
    if (!currentKbId) return;
    
    try {
        const res = await fetch(`${API_BASE}/knowledge-bases/${currentKbId}/documents`, {
            credentials: 'include'
        });
        const docs = await res.json();
        
        const pendingDocs = docs.filter(doc => doc.status === 'pending' || doc.status === 'failed');
        
        if (pendingDocs.length === 0) {
            showToast('没有待处理的文档', 'info');
            return;
        }
        
        if (!confirm(`确定要处理 ${pendingDocs.length} 个待处理文档吗？`)) return;
        
        let successCount = 0;
        let failCount = 0;
        
        for (const doc of pendingDocs) {
            try {
                const processRes = await fetch(`${API_BASE}/documents/${doc.id}/process`, {
                    method: 'POST',
                    credentials: 'include'
                });
                
                if (processRes.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }
        }
        
        showToast(`已启动 ${successCount} 个文档处理${failCount > 0 ? `，${failCount} 个失败` : ''}`, successCount > 0 ? 'success' : 'error');
        
        setTimeout(() => loadDocuments(currentKbId), 1000);
    } catch (e) {
        showToast('批量处理失败', 'error');
    }
});

function openSearchTest(kbId) {
    currentKbId = kbId;
    document.getElementById('searchTestQuery').value = '';
    document.getElementById('searchTestResults').innerHTML = '';
    showModal(searchTestModal);
}

document.getElementById('runSearchTestBtn').addEventListener('click', async () => {
    const query = document.getElementById('searchTestQuery').value;
    if (!query) return;
    
    try {
        const res = await fetch(`${API_BASE}/knowledge-bases/${currentKbId}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ query, topK: 5 })
        });
        
        const results = await res.json();
        
        const container = document.getElementById('searchTestResults');
        container.innerHTML = results.length ? results.map(r => `
            <div class="search-result-item">
                <div class="search-result-score">相关度: ${(r.score * 100).toFixed(1)}%</div>
                <div class="search-result-text">${r.chunk_text}</div>
                <div class="search-result-source">来源: ${r.file_name}</div>
            </div>
        `).join('') : '<p style="text-align:center;color:#64748b;">未找到相关内容</p>';
    } catch (e) {
        showToast('检索失败', 'error');
    }
});

document.getElementById('closeSearchTestModal').addEventListener('click', () => hideModal(searchTestModal));
document.getElementById('closeHistoryModal').addEventListener('click', () => hideModal(historyModal));

function showModal(modal) {
    modalOverlay.classList.add('show');
    modal.classList.add('show');
}

function hideModal(modal) {
    modalOverlay.classList.remove('show');
    modal.classList.remove('show');
}

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('show');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    }
});

checkAuth();
