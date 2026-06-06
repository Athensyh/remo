import { CONFIG, riskTypes, riskSuggestions, getRiskText, formatFileSize, showError, showToast, copyToClipboard } from '../common/utils.js';
import { HistoryManager } from '../common/storage.js';
import { callStreamReviewApi, callReviewApi, getErrorMessage, getAgents, classifyContract, callAgentReviewApi, callStreamAgentReviewApi } from '../common/api.js';
import { ChatAssistant } from './chat.js';

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let currentReviewData = null;
let currentRisks = [];
let originalContractText = '';
let selectedRiskIndex = null;
let currentFileName = '';
let streamingText = '';
let streamingElement = null;
let chatAssistant = null;
let agents = [];
let selectedAgentId = null;
let recommendedAgentId = null;
let classifyTimeout = null;

const contractInput = document.getElementById('contractInput');
const reviewBtn = document.getElementById('reviewBtn');
const clearBtn = document.getElementById('clearBtn');
const errorMessage = document.getElementById('errorMessage');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const resultContent = document.getElementById('resultContent');
const originalText = document.getElementById('originalText');
const scoreValue = document.getElementById('scoreValue');
const scoreFill = document.getElementById('scoreFill');
const summaryText = document.getElementById('summaryText');
const keyTermsList = document.getElementById('keyTermsList');
const highCount = document.getElementById('highCount');
const mediumCount = document.getElementById('mediumCount');
const lowCount = document.getElementById('lowCount');
const exportTxtBtn = document.getElementById('exportTxtBtn');
const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileRemove = document.getElementById('fileRemove');
const historyToggle = document.getElementById('historyToggle');
const historySidebar = document.getElementById('historySidebar');
const historyClose = document.getElementById('historyClose');
const historyList = document.getElementById('historyList');
const historyStorage = document.getElementById('historyStorage');
const historyClearBtn = document.getElementById('historyClearBtn');
const historyOverlay = document.getElementById('historyOverlay');
const chatToggle = document.getElementById('chatToggle');

function createStreamingDisplay() {
    const container = document.createElement('div');
    container.className = 'streaming-container';
    container.innerHTML = `
        <div class="streaming-header">
            <span class="streaming-icon">📝</span>
            <span>AI 正在分析合同...</span>
        </div>
        <div class="streaming-content" id="streamingContent"></div>
    `;
    return container;
}

function updateStreamingText(text) {
    const el = document.getElementById('streamingContent');
    if (el) {
        el.textContent = text;
        el.scrollTop = el.scrollHeight;
    }
}

function showStreamingDisplay() {
    const resultSection = document.querySelector('.result-section');
    const placeholder = document.getElementById('resultPlaceholder');
    const resultContent = document.getElementById('resultContent');
    
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    if (resultContent) {
        resultContent.style.display = 'none';
    }
    
    let container = document.querySelector('.streaming-container');
    if (!container) {
        container = createStreamingDisplay();
        if (resultSection && resultContent) {
            resultSection.insertBefore(container, resultContent);
        } else if (resultSection) {
            resultSection.appendChild(container);
        }
    }
    
    streamingText = '';
    streamingElement = document.getElementById('streamingContent');
}

function hideStreamingDisplay() {
    const container = document.querySelector('.streaming-container');
    if (container) {
        container.remove();
    }
    streamingText = '';
    streamingElement = null;
    
    const resultContent = document.getElementById('resultContent');
    if (resultContent) {
        resultContent.style.display = '';
    }
}

async function loadAgents() {
    const agentList = document.getElementById('agentList');
    
    try {
        agents = await getAgents();
        
        if (agents.length === 0) {
            agentList.innerHTML = '<div class="agent-loading">暂无可用智能体</div>';
            return;
        }
        
        agentList.innerHTML = agents.map(agent => `
            <div class="agent-item ${agent.id === selectedAgentId ? 'selected' : ''}" data-id="${agent.id}">
                <span class="agent-icon">${agent.icon || '⚖️'}</span>
                <span class="agent-name">${agent.name}</span>
            </div>
        `).join('');
        
        if (!selectedAgentId && agents.length > 0) {
            selectedAgentId = agents[0].id;
            const firstAgent = agentList.querySelector('.agent-item');
            if (firstAgent) firstAgent.classList.add('selected');
        }
        
        agentList.querySelectorAll('.agent-item').forEach(item => {
            item.addEventListener('click', () => selectAgent(parseInt(item.dataset.id)));
        });
        
    } catch (e) {
        agentList.innerHTML = '<div class="agent-loading">加载失败</div>';
        console.error('加载智能体失败:', e);
    }
}

function selectAgent(agentId) {
    selectedAgentId = agentId;
    
    document.querySelectorAll('.agent-item').forEach(item => {
        item.classList.toggle('selected', parseInt(item.dataset.id) === agentId);
        item.classList.remove('recommended');
        const badge = item.querySelector('.recommend-badge');
        if (badge) badge.remove();
    });
    
    const aiRecommend = document.getElementById('aiRecommend');
    aiRecommend.style.display = 'none';
    recommendedAgentId = null;
}

function showRecommendation(agent) {
    if (!agent) return;
    
    recommendedAgentId = agent.id;
    
    document.querySelectorAll('.agent-item').forEach(item => {
        const isRecommended = parseInt(item.dataset.id) === agent.id;
        item.classList.toggle('recommended', isRecommended);
        
        let badge = item.querySelector('.recommend-badge');
        if (isRecommended && !badge) {
            badge = document.createElement('span');
            badge.className = 'recommend-badge';
            badge.textContent = '推荐';
            item.appendChild(badge);
        } else if (!isRecommended && badge) {
            badge.remove();
        }
    });
    
    const aiRecommend = document.getElementById('aiRecommend');
    const recommendAgent = document.getElementById('recommendAgent');
    recommendAgent.textContent = agent.name;
    aiRecommend.style.display = 'inline';
    
    aiRecommend.onclick = () => {
        if (recommendedAgentId) {
            selectAgent(recommendedAgentId);
        }
    };
}

async function triggerClassify(text) {
    if (!text || text.length < 50) return;
    
    if (classifyTimeout) {
        clearTimeout(classifyTimeout);
    }
    
    classifyTimeout = setTimeout(async () => {
        try {
            const result = await classifyContract(text);
            if (result.recommendedAgent) {
                showRecommendation(result.recommendedAgent);
            }
        } catch (e) {
            console.error('合同分类失败:', e);
        }
    }, 1000);
}

function renderHistoryList() {
    const history = HistoryManager.getHistory();
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
        updateHistoryStorage();
        return;
    }

    historyList.innerHTML = history.map(item => {
        const scoreClass = item.score >= 70 ? 'high' : (item.score >= 40 ? 'medium' : 'low');
        return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <span class="history-item-time">${item.time}</span>
                    <button class="history-item-delete" data-id="${item.id}" title="删除">🗑</button>
                </div>
                <div class="history-item-stats">
                    <span class="history-item-score ${scoreClass}">${item.score}分</span>
                    <span class="history-item-risks">${item.riskCount}个风险</span>
                </div>
                <div class="history-item-title">${item.title}</div>
                ${item.isTruncated ? '<div class="history-item-truncated">[已截断]</div>' : ''}
            </div>
        `;
    }).join('');

    updateHistoryStorage();
}

function updateHistoryStorage() {
    const size = HistoryManager.getStorageSize();
    historyStorage.textContent = '已用 ' + HistoryManager.formatSize(size);
}

function loadHistoryItem(id) {
    const item = HistoryManager.getHistoryById(id);
    if (!item) return;

    currentReviewData = item.result;
    currentRisks = item.result.risks || [];
    originalContractText = item.contractText;

    renderScore(item.score);
    renderSummary(item.result.summary);
    renderKeyTerms(item.result.key_terms);
    updateStats(currentRisks);
    renderRiskList(currentRisks);
    renderOriginalText(item.contractText, currentRisks);

    resultPlaceholder.style.display = 'none';
    resultContent.classList.add('active');
    selectedRiskIndex = null;

    setButtonCompleted();
    hideRawResponseButton();

    closeHistorySidebar();
}

function deleteHistoryItem(id, event) {
    event.stopPropagation();
    HistoryManager.deleteHistory(id);
    renderHistoryList();
}

function clearAllHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        HistoryManager.clearHistory();
        renderHistoryList();
    }
}

function toggleHistorySidebar() {
    const isOpen = historySidebar.classList.toggle('show');
    historyOverlay.classList.toggle('show', isOpen);
    historyToggle.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeHistorySidebar() {
    historySidebar.classList.remove('show');
    historyOverlay.classList.remove('show');
    historyToggle.classList.remove('active');
    document.body.style.overflow = '';
}

function openHistorySidebar() {
    historySidebar.classList.add('show');
    historyOverlay.classList.add('show');
    historyToggle.classList.add('active');
    document.body.style.overflow = 'hidden';
}

historyToggle.addEventListener('click', toggleHistorySidebar);
historyClose.addEventListener('click', closeHistorySidebar);
historyOverlay.addEventListener('click', closeHistorySidebar);
historyClearBtn.addEventListener('click', clearAllHistory);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && historySidebar.classList.contains('show')) {
        closeHistorySidebar();
    }
});

let touchStartX = 0;
let touchEndX = 0;

historySidebar.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

historySidebar.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) {
        closeHistorySidebar();
    }
}, { passive: true });

historyList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.history-item-delete');
    if (deleteBtn) {
        deleteHistoryItem(deleteBtn.dataset.id, e);
        return;
    }

    const item = e.target.closest('.history-item');
    if (item) {
        loadHistoryItem(item.dataset.id);
    }
});

renderHistoryList();
loadAgents();

contractInput.addEventListener('input', (e) => {
    const text = e.target.value.trim();
    if (text.length >= 50) {
        triggerClassify(text);
    }
});

function showFileInfo(name, size) {
    fileName.textContent = name;
    fileSize.textContent = formatFileSize(size);
    fileInfo.classList.add('show');
    currentFileName = name;
}

function hideFileInfo() {
    fileInfo.classList.remove('show');
    currentFileName = '';
}

async function parseTxtFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('TXT文件读取失败'));
        reader.readAsText(file, 'UTF-8');
    });
}

async function parsePdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        text += pageText + '\n';
    }
    return text;
}

async function parseDocxFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value;
}

async function handleFile(file) {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showError(errorMessage, '文件大小超过10MB限制');
        return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    let text = '';

    try {
        if (ext === 'txt') {
            text = await parseTxtFile(file);
        } else if (ext === 'pdf') {
            text = await parsePdfFile(file);
        } else if (ext === 'docx') {
            text = await parseDocxFile(file);
        } else {
            showError(errorMessage, '不支持的文件格式');
            return;
        }

        if (!text || text.trim().length === 0) {
            showError(errorMessage, '文件内容为空或无法解析');
            return;
        }

        contractInput.value = text.trim();
        showFileInfo(file.name, file.size);

    } catch (error) {
        console.error('文件解析错误:', error);
        showError(errorMessage, '文件解析失败：' + error.message);
    }
}

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

fileRemove.addEventListener('click', () => {
    fileInput.value = '';
    contractInput.value = '';
    hideFileInfo();
});

function updateStats(risks) {
    const high = risks.filter(r => r.level === 'high').length;
    const medium = risks.filter(r => r.level === 'medium').length;
    const low = risks.filter(r => r.level === 'low').length;

    highCount.textContent = high;
    mediumCount.textContent = medium;
    lowCount.textContent = low;
}

function renderScore(score) {
    const safeScore = typeof score === 'number' ? score : 70;
    scoreValue.textContent = safeScore;
    scoreFill.style.strokeDasharray = `${safeScore}, 100`;
    scoreFill.classList.remove('high-risk', 'medium-risk', 'low-risk');
    if (safeScore < 40) {
        scoreFill.classList.add('high-risk');
    } else if (safeScore < 70) {
        scoreFill.classList.add('medium-risk');
    } else {
        scoreFill.classList.add('low-risk');
    }
}

function renderSummary(summary) {
    summaryText.textContent = summary || '暂无评价';
}

function renderKeyTerms(keyTerms) {
    if (!keyTerms || keyTerms.length === 0) {
        keyTermsList.innerHTML = '<span style="color: var(--text-muted);">暂无关键条款</span>';
        return;
    }

    keyTermsList.innerHTML = keyTerms.map(term => 
        `<span class="key-term-item">${term}</span>`
    ).join('');
}

function renderRiskList(risks) {
    if (!risks || risks.length === 0) {
        riskCardsList.innerHTML = '<div class="no-risks">✓ 未发现明显风险</div>';
        return;
    }

    window.allRisks = risks;
    window.filteredRisks = risks;
    
    renderRiskCards(risks);
    initFilterEvents();
}

function renderRiskCards(risks) {
    const riskCardsList = document.getElementById('riskCardsList');
    
    if (!risks || risks.length === 0) {
        riskCardsList.innerHTML = '<div class="no-risks">✓ 未发现明显风险</div>';
        return;
    }

    let html = '';
    
    risks.forEach((risk, i) => {
        const originalIndex = window.allRisks.indexOf(risk);
        html += renderRiskCard(risk, originalIndex);
    });

    riskCardsList.innerHTML = html;
    
    initRiskCardEvents();
}

function renderRiskCard(risk, index) {
    const clauseNumber = risk.clause_number || '未知';
    const levelIcon = risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟡' : '🟢';
    
    return `
        <div class="risk-card ${risk.level}" data-index="${index}">
            <div class="risk-card-header">
                <div class="risk-card-badge">
                    <span class="risk-badge ${risk.level}">${getRiskText(risk.level)}</span>
                    <span class="risk-card-number">${levelIcon} ${clauseNumber}</span>
                </div>
            </div>
            <div class="risk-card-title">${risk.type || '其他风险'}</div>
            <div class="risk-card-clause">${risk.clause || '（未提供具体条款）'}</div>
            <div class="risk-card-detail">
                <div class="detail-row">
                    <div class="detail-row-label">风险原因</div>
                    <div class="detail-row-value">${risk.reason || '暂无'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-row-label">修改建议</div>
                    <div class="detail-row-value">${risk.suggestion || '暂无'}</div>
                </div>
            </div>
            <div class="risk-card-actions">
                <button class="risk-card-btn" onclick="toggleRiskCard(${index})">展开详情</button>
                <button class="risk-card-btn" onclick="locateClause(${index})">定位原文</button>
                <button class="risk-card-btn" onclick="copySingleSuggestion(${index})">复制</button>
                <button class="risk-card-btn" onclick="consultAI(${index})">咨询AI</button>
            </div>
        </div>
    `;
}

function initRiskCardEvents() {
    document.querySelectorAll('.risk-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('risk-card-btn')) return;
            
            const index = parseInt(card.dataset.index);
            selectRisk(index);
        });
    });
}

function initFilterEvents() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const filter = tab.dataset.filter;
            filterRisks(filter);
        });
    });
    
    const searchInput = document.getElementById('riskSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            searchRisks(query);
        });
    }
}

window.filterRisks = function(level) {
    if (!window.allRisks) return;
    
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === level);
    });
    
    if (level === 'all') {
        window.filteredRisks = window.allRisks;
    } else {
        window.filteredRisks = window.allRisks.filter(r => r.level === level);
    }
    
    renderRiskCards(window.filteredRisks);
};

window.searchRisks = function(query) {
    if (!window.allRisks) return;
    
    if (!query) {
        renderRiskCards(window.filteredRisks);
        return;
    }
    
    const filtered = window.allRisks.filter(risk => {
        return (risk.clause && risk.clause.toLowerCase().includes(query)) ||
               (risk.reason && risk.reason.toLowerCase().includes(query)) ||
               (risk.type && risk.type.toLowerCase().includes(query)) ||
               (risk.clause_number && risk.clause_number.toLowerCase().includes(query));
    });
    
    renderRiskCards(filtered);
};

window.toggleRiskCard = function(index) {
    const card = document.querySelector(`.risk-card[data-index="${index}"]`);
    if (card) {
        card.classList.toggle('expanded');
        const btn = card.querySelector('.risk-card-btn');
        if (btn) {
            btn.textContent = card.classList.contains('expanded') ? '收起详情' : '展开详情';
        }
    }
};

window.locateClause = function(index) {
    selectRisk(index);
    showSingleClause(index);
    
    const originalTextSection = document.getElementById('originalTextSection');
    if (originalTextSection && originalTextSection.classList.contains('collapsed')) {
        toggleOriginalText();
    }
};

function exactMatch(clauseContent, originalText) {
    if (!clauseContent || !originalText) return null;
    
    const index = originalText.indexOf(clauseContent);
    if (index !== -1) {
        return {
            text: clauseContent,
            startIndex: index,
            endIndex: index + clauseContent.length,
            confidence: 100,
            type: 'exact'
        };
    }
    return null;
}

function fuzzyMatch(clauseContent, originalText) {
    if (!clauseContent || !originalText) return null;
    
    const normalize = (text) => {
        return text
            .replace(/[，。！？、；：""''（）【】《》\s\n\r\t]/g, '')
            .toLowerCase();
    };
    
    const normalizedClause = normalize(clauseContent);
    const normalizedOriginal = normalize(originalText);
    
    const index = normalizedOriginal.indexOf(normalizedClause);
    if (index !== -1) {
        let originalIndex = 0;
        let normalizedCount = 0;
        
        for (let i = 0; i < originalText.length; i++) {
            const char = originalText[i];
            if (!/[，。！？、；：""''（）【】《》\s\n\r\t]/.test(char)) {
                if (normalizedCount === index) {
                    originalIndex = i;
                    break;
                }
                normalizedCount++;
            }
        }
        
        let endIndex = originalIndex;
        let matchedLength = 0;
        for (let i = originalIndex; i < originalText.length && matchedLength < normalizedClause.length; i++) {
            if (!/[，。！？、；：""''（）【】《》\s\n\r\t]/.test(originalText[i])) {
                matchedLength++;
            }
            endIndex = i + 1;
        }
        
        return {
            text: originalText.substring(originalIndex, endIndex),
            startIndex: originalIndex,
            endIndex: endIndex,
            confidence: 90,
            type: 'fuzzy'
        };
    }
    return null;
}

function keywordMatch(clauseContent, originalText) {
    if (!clauseContent || !originalText) return null;
    
    const keywords = extractKeywords(clauseContent);
    if (keywords.length < 2) return null;
    
    const sentences = splitIntoSentences(originalText);
    const matches = [];
    
    for (const sentence of sentences) {
        let matchCount = 0;
        const matchedKeywords = [];
        
        for (const keyword of keywords) {
            if (sentence.text.includes(keyword)) {
                matchCount++;
                matchedKeywords.push(keyword);
            }
        }
        
        if (matchCount >= Math.min(3, keywords.length * 0.5)) {
            const confidence = Math.round((matchCount / keywords.length) * 80);
            matches.push({
                text: sentence.text,
                startIndex: sentence.startIndex,
                endIndex: sentence.endIndex,
                confidence: Math.max(50, confidence),
                type: 'keyword',
                matchedKeywords: matchedKeywords
            });
        }
    }
    
    if (matches.length > 0) {
        matches.sort((a, b) => b.confidence - a.confidence);
        return matches[0];
    }
    
    return null;
}

function extractKeywords(text) {
    if (!text) return [];
    
    const stopWords = ['的', '了', '和', '与', '或', '等', '及', '在', '是', '有', '为', '以', '及', '其', '之', '上', '下', '中', '内', '外', '前', '后', '应', '须', '可', '将', '按', '由', '对', '向', '从', '到', '于', '被', '把', '让', '给', '同', '跟', '比', '这', '那', '该', '此', '某', '每', '各', '任', '何', '所', '者', '也', '都', '就', '才', '还', '又', '再', '已', '曾', '正', '将', '要', '会', '能', '应', '该', '得', '需', '须', '必', '当', '并', '且', '而', '但', '却', '只', '仅', '凡', '若', '如', '倘', '假', '设', '纵', '虽', '即使', '无论', '不管', '不论', '除非', '只有', '只要', '如果', '假如', '倘若', '既然', '因为', '由于', '所以', '因此', '于是', '因而', '以致', '从而', '进而', '继而', '然后', '接着', '随后', '最后', '首先', '其次', '再次', '另外', '此外', '而且', '并且', '不仅', '不但', '既然', '既...又', '一边', '一方面', '另一方面'];
    
    const cleaned = text.replace(/[，。！？、；：""''（）【】《》\s\n\r\t]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !stopWords.includes(w));
    
    const uniqueWords = [...new Set(words)];
    
    return uniqueWords.slice(0, 10);
}

function splitIntoSentences(text) {
    const sentences = [];
    const delimiters = /[。\n]+/;
    let lastIndex = 0;
    let match;
    
    const regex = new RegExp(delimiters.source, 'g');
    
    while ((match = regex.exec(text)) !== null) {
        const sentence = text.substring(lastIndex, match.index).trim();
        if (sentence.length >= 10) {
            sentences.push({
                text: sentence,
                startIndex: lastIndex,
                endIndex: match.index
            });
        }
        lastIndex = match.index + match[0].length;
    }
    
    const lastSentence = text.substring(lastIndex).trim();
    if (lastSentence.length >= 10) {
        sentences.push({
            text: lastSentence,
            startIndex: lastIndex,
            endIndex: text.length
        });
    }
    
    return sentences;
}

function findAllMatches(clauseContent, originalText, maxMatches = 5) {
    const matches = [];
    
    const exact = exactMatch(clauseContent, originalText);
    if (exact) {
        matches.push(exact);
        return matches;
    }
    
    const fuzzy = fuzzyMatch(clauseContent, originalText);
    if (fuzzy) {
        matches.push(fuzzy);
        return matches;
    }
    
    const sentences = splitIntoSentences(originalText);
    const keywords = extractKeywords(clauseContent);
    
    if (keywords.length < 2) {
        return matches;
    }
    
    const sentenceMatches = [];
    for (const sentence of sentences) {
        let matchCount = 0;
        const matchedKeywords = [];
        
        for (const keyword of keywords) {
            if (sentence.text.includes(keyword)) {
                matchCount++;
                matchedKeywords.push(keyword);
            }
        }
        
        if (matchCount >= Math.min(2, keywords.length * 0.3)) {
            const confidence = Math.round((matchCount / keywords.length) * 100);
            sentenceMatches.push({
                text: sentence.text,
                startIndex: sentence.startIndex,
                endIndex: sentence.endIndex,
                confidence: Math.max(30, Math.min(85, confidence)),
                type: 'keyword',
                matchedKeywords: matchedKeywords,
                matchCount: matchCount
            });
        }
    }
    
    sentenceMatches.sort((a, b) => b.confidence - a.confidence);
    
    const topMatches = sentenceMatches.slice(0, maxMatches);
    matches.push(...topMatches);
    
    return matches;
}

function getContext(text, startIndex, endIndex, contextLength = 100) {
    const contextStart = Math.max(0, startIndex - contextLength);
    const contextEnd = Math.min(text.length, endIndex + contextLength);
    
    return {
        before: text.substring(contextStart, startIndex),
        match: text.substring(startIndex, endIndex),
        after: text.substring(endIndex, contextEnd),
        contextStart: contextStart,
        contextEnd: contextEnd
    };
}

window.showSingleClause = function(riskIndex) {
    if (!currentRisks || !currentRisks[riskIndex]) return;
    
    const risk = currentRisks[riskIndex];
    const clauseContent = risk.clause || '';
    const clauseNumber = risk.clause_number || '未知';
    
    if (!window.contractText) {
        originalText.innerHTML = '<div class="no-match-hint"><p>暂无原文</p></div>';
        return;
    }
    
    const matches = findAllMatches(clauseContent, window.contractText);
    
    if (matches.length === 0) {
        renderNoMatchView(risk, clauseNumber, clauseContent);
        return;
    }
    
    if (matches.length === 1) {
        renderSingleMatchView(risk, matches[0], riskIndex);
        return;
    }
    
    renderMultipleMatchesView(risk, matches, riskIndex);
};

function renderNoMatchView(risk, clauseNumber, clauseContent) {
    const prevRiskIndex = findPrevRiskIndex(currentRisks.indexOf(risk));
    const nextRiskIndex = findNextRiskIndex(currentRisks.indexOf(risk));
    
    let html = `
        <div class="single-clause-view">
            <div class="clause-nav-header">
                <div class="clause-nav-title">
                    <span class="clause-nav-icon">📄</span>
                    <span>未定位到原文</span>
                </div>
                <div class="clause-nav-actions">
                    <button class="clause-nav-btn" onclick="showAllClauses()" title="查看全部原文">
                        <span>📋</span> 全部
                    </button>
                </div>
            </div>
            
            <div class="clause-context-container">
                <div class="no-match-notice">
                    <div class="no-match-icon">🔍</div>
                    <div class="no-match-text">未在原文中找到匹配内容</div>
                </div>
                
                <div class="clause-main ${risk.level}">
                    <div class="clause-main-header">
                        <span class="risk-badge ${risk.level}">${getRiskText(risk.level)}</span>
                        <span class="clause-main-number">${clauseNumber}</span>
                    </div>
                    <div class="clause-main-content">${escapeHtml(clauseContent) || '暂无条款内容'}</div>
                    <div class="clause-source-hint">（来自AI识别）</div>
                </div>
                
                <div class="manual-search-section">
                    <div class="manual-search-label">手动搜索：</div>
                    <div class="manual-search-input-group">
                        <input type="text" class="manual-search-input" id="manualSearchInput" placeholder="输入关键词搜索原文...">
                        <button class="manual-search-btn" onclick="performManualSearch()">搜索</button>
                    </div>
                </div>
            </div>
            
            <div class="clause-nav-footer">
                <button class="clause-nav-btn ${prevRiskIndex === null ? 'disabled' : ''}" 
                        onclick="navigateToRisk(${prevRiskIndex})" 
                        ${prevRiskIndex === null ? 'disabled' : ''}>
                    <span>←</span> 上一条风险
                </button>
                <div class="clause-nav-info">
                    风险 ${currentRisks.indexOf(risk) + 1} / ${currentRisks.length}
                </div>
                <button class="clause-nav-btn ${nextRiskIndex === null ? 'disabled' : ''}" 
                        onclick="navigateToRisk(${nextRiskIndex})" 
                        ${nextRiskIndex === null ? 'disabled' : ''}>
                    下一条风险 <span>→</span>
                </button>
            </div>
        </div>
    `;
    
    originalText.innerHTML = html;
}

function renderSingleMatchView(risk, match, riskIndex) {
    const context = getContext(window.contractText, match.startIndex, match.endIndex, 150);
    const prevRiskIndex = findPrevRiskIndex(riskIndex);
    const nextRiskIndex = findNextRiskIndex(riskIndex);
    
    const confidenceClass = match.confidence >= 90 ? 'high' : match.confidence >= 70 ? 'medium' : 'low';
    
    let html = `
        <div class="single-clause-view">
            <div class="clause-nav-header">
                <div class="clause-nav-title">
                    <span class="clause-nav-icon">📄</span>
                    <span>已定位到原文</span>
                </div>
                <div class="clause-nav-actions">
                    <span class="match-confidence ${confidenceClass}">匹配度 ${match.confidence}%</span>
                    <button class="clause-nav-btn" onclick="showAllClauses()" title="查看全部原文">
                        <span>📋</span> 全部
                    </button>
                </div>
            </div>
            
            <div class="clause-context-container">
                <div class="clause-match-context">
                    <div class="context-before">${escapeHtml(context.before)}</div>
                    <div class="clause-main ${risk.level}">
                        <div class="clause-main-header">
                            <span class="risk-badge ${risk.level}">${getRiskText(risk.level)}</span>
                            <span class="clause-main-number">${risk.clause_number || '未知'}</span>
                        </div>
                        <div class="clause-main-content">${escapeHtml(context.match)}</div>
                    </div>
                    <div class="context-after">${escapeHtml(context.after)}</div>
                </div>
            </div>
            
            <div class="clause-nav-footer">
                <button class="clause-nav-btn ${prevRiskIndex === null ? 'disabled' : ''}" 
                        onclick="navigateToRisk(${prevRiskIndex})" 
                        ${prevRiskIndex === null ? 'disabled' : ''}>
                    <span>←</span> 上一条风险
                </button>
                <div class="clause-nav-info">
                    风险 ${riskIndex + 1} / ${currentRisks.length}
                </div>
                <button class="clause-nav-btn ${nextRiskIndex === null ? 'disabled' : ''}" 
                        onclick="navigateToRisk(${nextRiskIndex})" 
                        ${nextRiskIndex === null ? 'disabled' : ''}>
                    下一条风险 <span>→</span>
                </button>
            </div>
        </div>
    `;
    
    originalText.innerHTML = html;
}

function renderMultipleMatchesView(risk, matches, riskIndex) {
    const prevRiskIndex = findPrevRiskIndex(riskIndex);
    const nextRiskIndex = findNextRiskIndex(riskIndex);
    
    let matchesHtml = '';
    matches.forEach((match, idx) => {
        const confidenceClass = match.confidence >= 80 ? 'high' : match.confidence >= 60 ? 'medium' : 'low';
        const preview = match.text.length > 80 ? match.text.substring(0, 80) + '...' : match.text;
        
        matchesHtml += `
            <div class="match-option" onclick="selectMatch(${riskIndex}, ${idx})">
                <div class="match-option-header">
                    <span class="match-option-index">匹配 ${idx + 1}</span>
                    <span class="match-confidence ${confidenceClass}">${match.confidence}%</span>
                </div>
                <div class="match-option-preview">${escapeHtml(preview)}</div>
                ${match.matchedKeywords ? `<div class="match-keywords">关键词：${match.matchedKeywords.slice(0, 3).join('、')}</div>` : ''}
            </div>
        `;
    });
    
    let html = `
        <div class="single-clause-view">
            <div class="clause-nav-header">
                <div class="clause-nav-title">
                    <span class="clause-nav-icon">📄</span>
                    <span>找到 ${matches.length} 处相似内容</span>
                </div>
                <div class="clause-nav-actions">
                    <button class="clause-nav-btn" onclick="showAllClauses()" title="查看全部原文">
                        <span>📋</span> 全部
                    </button>
                </div>
            </div>
            
            <div class="clause-context-container">
                <div class="match-notice">
                    <span class="match-notice-icon">💡</span>
                    <span>请点击选择正确的位置</span>
                </div>
                
                <div class="match-options-list">
                    ${matchesHtml}
                </div>
            </div>
            
            <div class="clause-nav-footer">
                <button class="clause-nav-btn ${prevRiskIndex === null ? 'disabled' : ''}" 
                        onclick="navigateToRisk(${prevRiskIndex})" 
                        ${prevRiskIndex === null ? 'disabled' : ''}>
                    <span>←</span> 上一条风险
                </button>
                <div class="clause-nav-info">
                    风险 ${riskIndex + 1} / ${currentRisks.length}
                </div>
                <button class="clause-nav-btn ${nextRiskIndex === null ? 'disabled' : ''}" 
                        onclick="navigateToRisk(${nextRiskIndex})" 
                        ${nextRiskIndex === null ? 'disabled' : ''}>
                    下一条风险 <span>→</span>
                </button>
            </div>
        </div>
    `;
    
    originalText.innerHTML = html;
    
    window.currentMatches = matches;
}

window.selectMatch = function(riskIndex, matchIndex) {
    if (!window.currentMatches || !window.currentMatches[matchIndex]) return;
    
    const risk = currentRisks[riskIndex];
    const match = window.currentMatches[matchIndex];
    
    renderSingleMatchView(risk, match, riskIndex);
};

window.performManualSearch = function() {
    const input = document.getElementById('manualSearchInput');
    if (!input || !input.value.trim()) {
        showToast('请输入搜索关键词', true);
        return;
    }
    
    const keyword = input.value.trim();
    const matches = findAllMatches(keyword, window.contractText, 3);
    
    if (matches.length === 0) {
        showToast('未找到匹配内容', true);
        return;
    }
    
    const riskIndex = currentRisks.findIndex(r => r === currentRisks[selectedRiskIndex]);
    if (matches.length === 1) {
        const risk = currentRisks[riskIndex];
        renderSingleMatchView(risk, matches[0], riskIndex);
    } else {
        const risk = currentRisks[riskIndex];
        renderMultipleMatchesView(risk, matches, riskIndex);
    }
};

window.showAllClauses = function() {
    if (!window.contractText) return;
    
    let html = '<div class="original-text-hint"><p>📄 合同原文</p><p class="hint-sub">点击左侧风险列表查看对应条款</p></div>';
    
    if (window.contractClauses && window.contractClauses.length > 0) {
        html += '<div class="clauses-container">';
        
        window.contractClauses.forEach((clause, index) => {
            const escapedContent = escapeHtml(clause.content);
            
            html += `<div class="clause-block" data-clause-number="${clause.number}" data-clause-index="${index}">
                <div class="clause-header">${clause.number}</div>
                <div class="clause-content">${escapedContent}</div>
            </div>`;
        });
        
        html += '</div>';
    } else {
        const escapedText = escapeHtml(window.contractText);
        html += `<div class="original-text-content">${escapedText}</div>`;
    }
    
    originalText.innerHTML = html;
};

window.navigateToRisk = function(index) {
    if (index === null || index === undefined) return;
    
    const cards = document.querySelectorAll('.risk-card');
    cards.forEach(card => card.classList.remove('active'));
    
    const targetCard = document.querySelector(`.risk-card[data-index="${index}"]`);
    if (targetCard) {
        targetCard.classList.add('active');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    selectRisk(index);
    showSingleClause(index);
};

function findPrevRiskIndex(currentIndex) {
    if (!currentRisks || currentIndex <= 0) return null;
    return currentIndex - 1;
}

function findNextRiskIndex(currentIndex) {
    if (!currentRisks || currentIndex >= currentRisks.length - 1) return null;
    return currentIndex + 1;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

window.consultAI = function(index) {
    if (!chatAssistant) {
        chatAssistant = new ChatAssistant();
    }
    
    const risk = currentRisks[index];
    if (risk) {
        chatAssistant.open();
        setTimeout(() => {
            chatAssistant.sendMessage(`请帮我分析这个风险条款：\n\n条款编号：${risk.clause_number || '未知'}\n涉及条款：${risk.clause}\n风险原因：${risk.reason}\n\n请问如何修改更好？`);
        }, 300);
    }
};

window.toggleOriginalText = function() {
    const section = document.getElementById('originalTextSection');
    if (section) {
        section.classList.toggle('collapsed');
    }
};

window.copyAllRisks = function() {
    if (!currentRisks || currentRisks.length === 0) {
        showToast('暂无风险数据', true);
        return;
    }
    
    let text = `【合同审查报告】\n`;
    text += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    text += `风险数量：${currentRisks.length}项\n`;
    text += `${'='.repeat(50)}\n\n`;
    
    currentRisks.forEach((risk, index) => {
        text += `【风险 ${index + 1}】\n`;
        text += `${'─'.repeat(50)}\n`;
        text += `条款编号：${risk.clause_number || '未知'}\n`;
        text += `风险类型：${risk.type || '其他风险'}\n`;
        text += `风险等级：${getRiskText(risk.level)}\n`;
        text += `涉及条款：${risk.clause || '暂无'}\n\n`;
        text += `风险原因：\n${risk.reason || '暂无'}\n\n`;
        text += `修改建议：\n${risk.suggestion || '暂无'}\n\n`;
        
        if (risk.legalBasis) {
            text += `法律依据：\n${risk.legalBasis}\n\n`;
        }
    });
    
    text += `${'='.repeat(50)}\n`;
    text += `⚠️ 免责声明：本审查报告由AI生成，仅供参考，不构成法律意见。建议咨询专业律师处理具体法律事务。\n`;
    
    copyToClipboard(text);
};

function parseClauses(text) {
    const clauses = [];
    const lines = text.split('\n');
    let currentClause = null;
    let currentContent = [];
    
    const clausePatterns = [
        /^第[一二三四五六七八九十百零\d]+条/,
        /^第[一二三四五六七八九十百零\d]+章/,
        /^[一二三四五六七八九十]+、/,
        /^\d+\./,
        /^（[一二三四五六七八九十\d]+）/,
        /^\([一二三四五六七八九十\d]+\)/,
        /^[一二三四五六七八九十]+\./
    ];
    
    function isClauseStart(line) {
        const trimmed = line.trim();
        for (const pattern of clausePatterns) {
            if (pattern.test(trimmed)) {
                return trimmed.match(pattern)[0];
            }
        }
        return null;
    }
    
    function normalizeClauseNumber(number) {
        const chineseNums = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10','零':'0'};
        let normalized = number;
        for (const [cn, num] of Object.entries(chineseNums)) {
            normalized = normalized.replace(new RegExp(cn, 'g'), num);
        }
        return normalized.replace(/[第条款章节、\.（）\(\)]/g, '');
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const clauseStart = isClauseStart(line);
        
        if (clauseStart) {
            if (currentClause) {
                currentClause.content = currentContent.join('\n').trim();
                clauses.push(currentClause);
            }
            currentClause = {
                number: clauseStart.trim(),
                normalizedNumber: normalizeClauseNumber(clauseStart.trim()),
                startIndex: i,
                content: ''
            };
            currentContent = [line];
        } else if (currentClause) {
            currentContent.push(line);
        }
    }
    
    if (currentClause) {
        currentClause.content = currentContent.join('\n').trim();
        clauses.push(currentClause);
    }
    
    return clauses;
}

function findClauseByNumber(clauseNumber, clauses) {
    if (!clauseNumber || clauseNumber === '未知') {
        return null;
    }
    
    const chineseNums = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10','零':'0'};
    let normalized = clauseNumber;
    for (const [cn, num] of Object.entries(chineseNums)) {
        normalized = normalized.replace(new RegExp(cn, 'g'), num);
    }
    normalized = normalized.replace(/[第条款章节、\.（）\(\)]/g, '');
    
    for (const clause of clauses) {
        if (clause.normalizedNumber === normalized || 
            clause.normalizedNumber.includes(normalized) ||
            normalized.includes(clause.normalizedNumber)) {
            return clause;
        }
    }
    
    for (const clause of clauses) {
        if (clause.number.includes(clauseNumber) || clauseNumber.includes(clause.number)) {
            return clause;
        }
    }
    
    return null;
}

function renderOriginalText(text, risks) {
    if (!text) {
        originalText.innerHTML = '<div class="no-match-hint"><p>暂无原文</p></div>';
        return;
    }

    window.contractClauses = parseClauses(text);
    window.contractText = text;
    
    console.log('Parsed clauses:', window.contractClauses);
    
    let html = '<div class="original-text-hint"><p>📄 合同原文</p><p class="hint-sub">点击左侧风险列表查看对应条款</p></div>';
    
    if (window.contractClauses.length > 0) {
        html += '<div class="clauses-container">';
        
        window.contractClauses.forEach((clause, index) => {
            const escapedContent = clause.content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
            
            html += `<div class="clause-block" data-clause-number="${clause.number}" data-clause-index="${index}">
                <div class="clause-header">${clause.number}</div>
                <div class="clause-content">${escapedContent}</div>
            </div>`;
        });
        
        html += '</div>';
    } else {
        const escapedText = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
        
        html += `<div class="original-text-content">${escapedText}</div>`;
    }
    
    originalText.innerHTML = html;
}

function selectRisk(index) {
    if (index < 0 || index >= currentRisks.length) {
        console.warn('Invalid risk index:', index);
        return;
    }

    selectedRiskIndex = index;
    const risk = currentRisks[index];

    document.querySelectorAll('.risk-card').forEach(card => {
        card.classList.toggle('active', parseInt(card.dataset.index) === index);
    });

    document.querySelectorAll('.clause-block').forEach(block => {
        block.classList.remove('highlighted', 'high', 'medium', 'low');
    });

    const clauseNumber = risk.clause_number || '未知';
    console.log('Looking for clause:', clauseNumber);
    
    if (window.contractClauses && window.contractClauses.length > 0) {
        const clause = findClauseByNumber(clauseNumber, window.contractClauses);
        
        if (clause) {
            console.log('Found clause:', clause);
            
            const clauseBlock = originalText.querySelector(`[data-clause-index="${window.contractClauses.indexOf(clause)}"]`);
            
            if (clauseBlock) {
                clauseBlock.classList.add('highlighted', risk.level);
                
                const containerRect = originalText.getBoundingClientRect();
                const blockRect = clauseBlock.getBoundingClientRect();
                const scrollTop = originalText.scrollTop;
                const targetScroll = scrollTop + blockRect.top - containerRect.top - 20;
                
                originalText.scrollTo({
                    top: Math.max(0, targetScroll),
                    behavior: 'smooth'
                });
            }
        } else {
            console.log('Clause not found:', clauseNumber);
            originalText.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
    
    updateChatContext();
}

window.copySingleSuggestion = function(index) {
    if (!currentRisks || !currentRisks[index]) {
        showToast('无法获取风险信息', true);
        return;
    }
    
    const risk = currentRisks[index];
    let text = `【风险详情】\n`;
    text += `${'─'.repeat(50)}\n`;
    text += `条款编号：${risk.clause_number || '未知'}\n`;
    text += `风险类型：${risk.type || '其他风险'}\n`;
    text += `风险等级：${getRiskText(risk.level)}\n`;
    text += `涉及条款：${risk.clause || '暂无'}\n\n`;
    text += `风险原因：\n${risk.reason || '暂无'}\n\n`;
    text += `修改建议：\n${risk.suggestion || '暂无'}\n\n`;
    
    if (risk.legalBasis) {
        text += `法律依据：\n${risk.legalBasis}\n\n`;
    }
    
    if (risk.riskWarning) {
        text += `风险提示：\n${risk.riskWarning}\n\n`;
    }
    
    text += `${'─'.repeat(50)}\n`;
    text += `⚠️ 免责声明：本审查报告由AI生成，仅供参考，不构成法律意见。建议咨询专业律师处理具体法律事务。\n`;
    
    copyToClipboard(text);
};

window.copyBatchSuggestions = function(level) {
    if (!currentRisks || currentRisks.length === 0) {
        showToast('暂无风险数据', true);
        return;
    }
    
    const filteredRisks = currentRisks.filter(r => r.level === level);
    
    if (filteredRisks.length === 0) {
        showToast(`暂无${getRiskText(level)}风险`, true);
        return;
    }
    
    const levelText = getRiskText(level);
    let text = `【${levelText}风险审查报告】\n`;
    text += `风险等级：${levelText}\n`;
    text += `风险数量：${filteredRisks.length}项\n`;
    text += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    text += `${'='.repeat(50)}\n\n`;
    
    filteredRisks.forEach((risk, index) => {
        text += `【风险 ${index + 1}】\n`;
        text += `${'─'.repeat(50)}\n`;
        text += `条款编号：${risk.clause_number || '未知'}\n`;
        text += `风险类型：${risk.type || '其他风险'}\n`;
        text += `风险等级：${getRiskText(risk.level)}\n`;
        text += `涉及条款：${risk.clause || '暂无'}\n\n`;
        text += `风险原因：\n${risk.reason || '暂无'}\n\n`;
        text += `修改建议：\n${risk.suggestion || '暂无'}\n\n`;
        
        if (risk.legalBasis) {
            text += `法律依据：\n${risk.legalBasis}\n\n`;
        }
        
        if (risk.riskWarning) {
            text += `风险提示：\n${risk.riskWarning}\n\n`;
        }
        
        text += '\n';
    });
    
    text += `${'='.repeat(50)}\n`;
    text += `⚠️ 免责声明\n`;
    text += `${'─'.repeat(50)}\n`;
    text += `本审查报告由AI生成，仅供参考，不构成法律意见。\n`;
    text += `建议咨询专业律师处理具体法律事务。\n`;
    text += `报告生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    
    copyToClipboard(text);
};

function setButtonLoading() {
    reviewBtn.classList.add('loading');
    reviewBtn.disabled = true;
}

function setButtonCompleted() {
    reviewBtn.classList.remove('loading');
    reviewBtn.classList.add('completed');
    reviewBtn.disabled = false;
    reviewBtn.querySelector('.btn-text').textContent = '审查完成';
}

function resetButton() {
    reviewBtn.classList.remove('loading', 'completed');
    reviewBtn.disabled = false;
    reviewBtn.querySelector('.btn-text').textContent = '开始审查';
}

function hideRawResponseButton() {
}

async function startReview() {
    const text = contractInput.value.trim();
    
    if (!text) {
        showError(errorMessage, '请输入合同内容后再进行审查');
        return;
    }

    originalContractText = text;
    setButtonLoading();
    resultPlaceholder.style.display = 'none';
    resultContent.classList.remove('active');
    
    showStreamingDisplay();

    try {
        await callStreamAgentReviewApi(
            text,
            selectedAgentId,
            false,
            (message, type) => {
                if (type === 'content') {
                    updateStreamingText(message);
                } else {
                    console.log('Progress:', type, message);
                }
            },
            (data) => {
                hideStreamingDisplay();
                
                currentReviewData = data;
                currentRisks = data.risks || [];
                
                renderScore(data.overall_score || 70);
                renderSummary(data.summary);
                renderKeyTerms(data.key_terms);
                updateStats(currentRisks);
                renderRiskList(currentRisks);
                renderOriginalText(text, currentRisks);
                
                resultContent.classList.add('active');
                setButtonCompleted();
                
                updateChatContext();
                
                HistoryManager.addHistory(text, data);
                renderHistoryList();
                
                if (data.agent_name) {
                    showToast(`使用 ${data.agent_name} 审查完成`, 'success');
                }
            },
            (error) => {
                hideStreamingDisplay();
                console.error('审查错误:', error);
                showError(errorMessage, getErrorMessage(error));
                resetButton();
            }
        );
    } catch (error) {
        hideStreamingDisplay();
        console.error('审查错误:', error);
        showError(errorMessage, getErrorMessage(error));
        resetButton();
    }
}

function clearAll() {
    contractInput.value = '';
    fileInput.value = '';
    hideFileInfo();
    resultPlaceholder.style.display = 'flex';
    resultContent.classList.remove('active');
    resetButton();
    currentReviewData = null;
    currentRisks = [];
    originalContractText = '';
    selectedRiskIndex = null;
}

function generateReportContent() {
    if (!currentReviewData || currentRisks.length === 0) {
        return '';
    }

    const highRisks = currentRisks.filter(r => r.level === 'high');
    const mediumRisks = currentRisks.filter(r => r.level === 'medium');
    const lowRisks = currentRisks.filter(r => r.level === 'low');

    let content = `AI合同审查报告\n`;
    content += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    content += `${'='.repeat(50)}\n\n`;
    
    content += `【风险评分】${currentReviewData.overall_score || 70}\n\n`;
    content += `【整体评价】\n${currentReviewData.summary || '暂无评价'}\n\n`;
    content += `【风险统计】\n`;
    content += `高风险：${highRisks.length}项\n`;
    content += `中风险：${mediumRisks.length}项\n`;
    content += `低风险：${lowRisks.length}项\n\n`;

    if (currentReviewData.key_terms && currentReviewData.key_terms.length > 0) {
        content += `【关键条款】\n`;
        currentReviewData.key_terms.forEach((term, i) => {
            content += `${i + 1}. ${term}\n`;
        });
        content += '\n';
    }

    if (highRisks.length > 0) {
        content += '====================================\n';
        content += '【高风险详情】\n';
        content += '====================================\n\n';
        highRisks.forEach((risk, i) => {
            content += `${i + 1}. ${risk.type}\n`;
            content += `   条款：${risk.clause}\n`;
            content += `   原因：${risk.reason}\n`;
            content += `   建议：${risk.suggestion}\n\n`;
        });
    }

    if (mediumRisks.length > 0) {
        content += '====================================\n';
        content += '【中风险详情】\n';
        content += '====================================\n\n';
        mediumRisks.forEach((risk, i) => {
            content += `${i + 1}. ${risk.type}\n`;
            content += `   条款：${risk.clause}\n`;
            content += `   原因：${risk.reason}\n`;
            content += `   建议：${risk.suggestion}\n\n`;
        });
    }

    if (lowRisks.length > 0) {
        content += '====================================\n';
        content += '【低风险详情】\n';
        content += '====================================\n\n';
        lowRisks.forEach((risk, i) => {
            content += `${i + 1}. ${risk.type}\n`;
            content += `   条款：${risk.clause}\n`;
            content += `   原因：${risk.reason}\n`;
            content += `   建议：${risk.suggestion}\n\n`;
        });
    }

    content += '====================================\n';
    content += '声明：本报告由AI自动生成，仅供参考，\n';
    content += '不构成法律意见。建议咨询专业律师。\n';
    content += '====================================\n';

    return content;
}

function exportTxt() {
    if (currentRisks.length === 0) {
        showToast('暂无审查结果可导出', true);
        return;
    }

    const content = generateReportContent();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `合同审查报告_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportHtml() {
    if (!currentReviewData || currentRisks.length === 0) {
        showToast('暂无审查结果可导出', true);
        return;
    }

    const highRisks = currentRisks.filter(r => r.level === 'high');
    const mediumRisks = currentRisks.filter(r => r.level === 'medium');
    const lowRisks = currentRisks.filter(r => r.level === 'low');

    const getRiskColor = (level) => {
        switch(level) {
            case 'high': return '#e53935';
            case 'medium': return '#fb8c00';
            case 'low': return '#43a047';
            default: return '#757575';
        }
    };

    const getRiskLabel = (level) => {
        switch(level) {
            case 'high': return '高风险';
            case 'medium': return '中风险';
            case 'low': return '低风险';
            default: return '未知';
        }
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI合同审查报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #1a5fb4 0%, #0d3a7a 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 24px;
            text-align: center;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .time { opacity: 0.8; font-size: 14px; }
        .score-section {
            display: flex;
            gap: 24px;
            margin-bottom: 24px;
        }
        .score-card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            flex: 0 0 200px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .score-value {
            font-size: 48px;
            font-weight: 700;
            color: ${currentReviewData.overall_score >= 70 ? '#43a047' : (currentReviewData.overall_score >= 40 ? '#fb8c00' : '#e53935')};
        }
        .score-label { color: #666; margin-top: 8px; }
        .summary-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            flex: 1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .summary-title { font-weight: 600; margin-bottom: 12px; color: #1a5fb4; }
        .summary-text { color: #555; line-height: 1.8; }
        .section {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #1a5fb4;
            border-bottom: 2px solid #e3f2fd;
            padding-bottom: 10px;
        }
        .key-terms { display: flex; flex-wrap: wrap; gap: 10px; }
        .key-term {
            background: #e3f2fd;
            color: #1a5fb4;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 24px;
        }
        .stat-item {
            flex: 1;
            text-align: center;
            padding: 20px;
            border-radius: 12px;
            color: white;
        }
        .stat-item.high { background: linear-gradient(135deg, #e53935 0%, #c62828 100%); }
        .stat-item.medium { background: linear-gradient(135deg, #fb8c00 0%, #ef6c00 100%); }
        .stat-item.low { background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%); }
        .stat-value { font-size: 32px; font-weight: 700; }
        .stat-label { font-size: 14px; opacity: 0.9; margin-top: 4px; }
        .risk-item {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 16px;
            overflow: hidden;
        }
        .risk-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: #fafafa;
        }
        .risk-badge {
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            color: white;
        }
        .risk-type { font-weight: 600; color: #333; }
        .risk-body { padding: 16px; }
        .risk-field { margin-bottom: 12px; }
        .risk-field-label { font-weight: 600; color: #666; font-size: 13px; margin-bottom: 4px; }
        .risk-field-value { color: #333; }
        .footer {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 40px;
            padding: 20px;
        }
        @media print {
            body { background: white; }
            .section, .score-card, .summary-card { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AI合同审查报告</h1>
            <div class="time">生成时间：${new Date().toLocaleString('zh-CN')}</div>
        </div>

        <div class="score-section">
            <div class="score-card">
                <div class="score-value">${currentReviewData.overall_score}</div>
                <div class="score-label">风险评分</div>
            </div>
            <div class="summary-card">
                <div class="summary-title">整体评价</div>
                <div class="summary-text">${currentReviewData.summary || '暂无评价'}</div>
            </div>
        </div>

        <div class="stats">
            <div class="stat-item high">
                <div class="stat-value">${highRisks.length}</div>
                <div class="stat-label">高风险</div>
            </div>
            <div class="stat-item medium">
                <div class="stat-value">${mediumRisks.length}</div>
                <div class="stat-label">中风险</div>
            </div>
            <div class="stat-item low">
                <div class="stat-value">${lowRisks.length}</div>
                <div class="stat-label">低风险</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">关键条款</div>
            <div class="key-terms">
                ${(currentReviewData.key_terms || []).map(term => `<span class="key-term">${term}</span>`).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">风险详情</div>
            ${currentRisks.map(risk => `
                <div class="risk-item">
                    <div class="risk-header">
                        <span class="risk-badge" style="background: ${getRiskColor(risk.level)}">${getRiskLabel(risk.level)}</span>
                        <span class="risk-type">${risk.type || '其他风险'}</span>
                    </div>
                    <div class="risk-body">
                        <div class="risk-field">
                            <div class="risk-field-label">涉及条款</div>
                            <div class="risk-field-value">${risk.clause || '暂无'}</div>
                        </div>
                        <div class="risk-field">
                            <div class="risk-field-label">风险原因</div>
                            <div class="risk-field-value">${risk.reason || '暂无'}</div>
                        </div>
                        <div class="risk-field">
                            <div class="risk-field-label">修改建议</div>
                            <div class="risk-field-value">${risk.suggestion || '暂无'}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            本报告由 AI合同审查助手 生成，仅供参考
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `合同审查报告_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportPdf() {
    if (!currentReviewData || currentRisks.length === 0) {
        showToast('暂无审查结果可导出', true);
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont('helvetica');

    doc.setFontSize(18);
    doc.text('AI Contract Review Report', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString('zh-CN')}`, 105, 30, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(26, 95, 180);
    doc.text(`Score: ${currentReviewData.overall_score}/100`, 105, 42, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(11);
    doc.text('Summary', 20, 55);
    doc.setFontSize(9);
    const summaryLines = doc.splitTextToSize(currentReviewData.summary, 170);
    doc.text(summaryLines, 20, 62);
    let yPos = 62 + summaryLines.length * 5 + 5;

    doc.setFontSize(11);
    doc.text('Key Terms', 20, yPos);
    doc.setFontSize(9);
    currentReviewData.key_terms.forEach((term, i) => {
        doc.text(`- ${term}`, 25, yPos + 7 + i * 5);
    });
    yPos += 7 + currentReviewData.key_terms.length * 5 + 5;

    doc.setFontSize(12);
    doc.text('Risk Statistics', 20, yPos);
    yPos += 7;

    doc.setFontSize(10);
    const highRisks = currentRisks.filter(r => r.level === 'high');
    const mediumRisks = currentRisks.filter(r => r.level === 'medium');
    const lowRisks = currentRisks.filter(r => r.level === 'low');

    doc.setTextColor(229, 57, 53);
    doc.text(`High Risk: ${highRisks.length}`, 20, yPos);
    doc.setTextColor(251, 140, 0);
    doc.text(`Medium Risk: ${mediumRisks.length}`, 70, yPos);
    doc.setTextColor(67, 160, 71);
    doc.text(`Low Risk: ${lowRisks.length}`, 130, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    const pageHeight = 280;

    const addRiskSection = (risks, title, color) => {
        if (risks.length === 0) return;

        if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(title, 20, yPos);
        yPos += 10;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);

        risks.forEach((risk, i) => {
            if (yPos > pageHeight - 40) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.text(`${i + 1}. ${risk.type}`, 20, yPos);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            const clauseLines = doc.splitTextToSize(`Clause: ${risk.clause}`, 170);
            doc.text(clauseLines, 25, yPos);
            yPos += clauseLines.length * 5;

            const reasonLines = doc.splitTextToSize(`Reason: ${risk.reason}`, 170);
            doc.text(reasonLines, 25, yPos);
            yPos += reasonLines.length * 5;

            const sugLines = doc.splitTextToSize(`Suggestion: ${risk.suggestion}`, 170);
            doc.text(sugLines, 25, yPos);
            yPos += sugLines.length * 5 + 5;
        });
    };

    addRiskSection(highRisks, 'High Risk Details', [229, 57, 53]);
    addRiskSection(mediumRisks, 'Medium Risk Details', [251, 140, 0]);
    addRiskSection(lowRisks, 'Low Risk Details', [67, 160, 71]);

    if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Disclaimer: This report is auto-generated by AI for reference only.', 105, yPos + 10, { align: 'center' });
    doc.text('It does not constitute legal advice. Please consult a professional lawyer.', 105, yPos + 16, { align: 'center' });

    doc.save(`Contract_Review_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

reviewBtn.addEventListener('click', startReview);
clearBtn.addEventListener('click', clearAll);
exportTxtBtn.addEventListener('click', exportTxt);
exportHtmlBtn.addEventListener('click', exportHtml);
exportPdfBtn.addEventListener('click', exportPdf);

contractInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        startReview();
    }
});

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
`;
document.head.appendChild(style);

chatAssistant = new ChatAssistant();

chatToggle.addEventListener('click', () => {
    chatAssistant.toggle();
    chatToggle.classList.toggle('active', chatAssistant.isOpen);
});

function updateChatContext() {
    if (chatAssistant) {
        chatAssistant.setContext({
            contractText: originalContractText,
            risks: currentRisks,
            selectedRisk: selectedRiskIndex,
            overallScore: currentReviewData?.overall_score
        });
    }
}

document.head.appendChild(style);
