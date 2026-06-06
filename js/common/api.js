import { CONFIG } from './utils.js';

let streamingText = '';
let stallChecker = null;
let bufferTimeoutId = null;
const STALL_TIMEOUT = 15000;
const MAX_BUFFER_SIZE = 1024 * 1024;

function clearAllTimers() {
    if (stallChecker) {
        clearInterval(stallChecker);
        stallChecker = null;
    }
    if (bufferTimeoutId) {
        clearTimeout(bufferTimeoutId);
        bufferTimeoutId = null;
    }
}

function resetBufferTimeout() {
    if (bufferTimeoutId) {
        clearTimeout(bufferTimeoutId);
    }
    bufferTimeoutId = setTimeout(() => {
        console.warn('Buffer清理超时');
    }, 30000);
}

export async function callStreamReviewApi(text, forceFull, onProgress, onComplete, onError) {
    streamingText = '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    let lastReceiveTime = Date.now();

    clearAllTimers();
    stallChecker = setInterval(() => {
        if (Date.now() - lastReceiveTime > STALL_TIMEOUT) {
            clearAllTimers();
            controller.abort();
            if (onError) {
                const stallError = new Error('数据传输停滞，请检查网络后重试');
                stallError.code = 'STALL';
                onError(stallError);
            }
        }
    }, 2000);

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/review/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, forceFull }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
            }
            const error = new Error(errorData.message || `请求失败: ${response.status}`);
            error.code = errorData.error;
            throw error;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        resetBufferTimeout();

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                if (buffer.trim()) {
                    try {
                        if (buffer.startsWith('data: ')) {
                            const data = buffer.slice(6);
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'complete' && onComplete) {
                                onComplete(parsed.data);
                            }
                        }
                    } catch (e) {
                    }
                }
                break;
            }

            lastReceiveTime = Date.now();
            resetBufferTimeout();

            buffer += decoder.decode(value, { stream: true });
            
            if (buffer.length > MAX_BUFFER_SIZE) {
                console.error('Buffer 溢出，强制清理');
                buffer = '';
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        switch (parsed.type) {
                            case 'status':
                                if (onProgress) onProgress(parsed.message, 'status');
                                break;
                            case 'content':
                                streamingText += parsed.content;
                                if (onProgress) onProgress(streamingText, 'content');
                                break;
                            case 'done':
                                break;
                            case 'complete':
                                if (onComplete) onComplete(parsed.data);
                                break;
                            case 'not_contract':
                                if (onError) {
                                    const err = new Error(parsed.message);
                                    err.isNotContract = true;
                                    onError(err);
                                }
                                break;
                            case 'error':
                                if (onError) onError(new Error(parsed.message));
                                break;
                        }
                    } catch (e) {
                    }
                }
            }
        }

    } catch (error) {
        clearAllTimers();
        
        if (error.name === 'AbortError') {
            const timeoutError = new Error('请求超时，请检查网络后重试');
            timeoutError.code = 'TIMEOUT';
            if (onError) onError(timeoutError);
        } else {
            if (onError) onError(error);
        }
    } finally {
        clearAllTimers();
    }
}

export async function callReviewApi(text, forceFull = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, forceFull }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.message || `请求失败: ${response.status}`);
            error.code = errorData.error;
            error.status = response.status;
            throw error;
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            const timeoutError = new Error('请求超时，请检查网络后重试');
            timeoutError.code = 'TIMEOUT';
            throw timeoutError;
        }
        
        throw error;
    }
}

export async function callStreamAgentReviewApi(text, agentId, forceFull, onProgress, onComplete, onError) {
    streamingText = '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    let lastReceiveTime = Date.now();

    clearAllTimers();
    stallChecker = setInterval(() => {
        if (Date.now() - lastReceiveTime > STALL_TIMEOUT) {
            clearAllTimers();
            controller.abort();
            if (onError) {
                const stallError = new Error('数据传输停滞，请检查网络后重试');
                stallError.code = 'STALL';
                onError(stallError);
            }
        }
    }, 2000);

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/review/agent/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, agentId, forceFull }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
            }
            const error = new Error(errorData.message || `请求失败: ${response.status}`);
            error.code = errorData.error;
            throw error;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        resetBufferTimeout();

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                if (buffer.trim()) {
                    try {
                        if (buffer.startsWith('data: ')) {
                            const data = buffer.slice(6);
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'complete' && onComplete) {
                                onComplete(parsed.data);
                            }
                        }
                    } catch (e) {
                    }
                }
                break;
            }

            lastReceiveTime = Date.now();
            resetBufferTimeout();

            buffer += decoder.decode(value, { stream: true });
            
            if (buffer.length > MAX_BUFFER_SIZE) {
                console.error('Buffer 溢出，强制清理');
                buffer = '';
            }

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        switch (parsed.type) {
                            case 'status':
                                if (onProgress) onProgress(parsed.message, 'status');
                                break;
                            case 'content':
                                streamingText = parsed.content;
                                if (onProgress) onProgress(streamingText, 'content');
                                break;
                            case 'done':
                                break;
                            case 'complete':
                                if (onComplete) onComplete(parsed.data);
                                break;
                            case 'not_contract':
                                if (onError) {
                                    const err = new Error(parsed.message);
                                    err.isNotContract = true;
                                    onError(err);
                                }
                                break;
                            case 'error':
                                if (onError) onError(new Error(parsed.message));
                                break;
                        }
                    } catch (e) {
                    }
                }
            }
        }

    } catch (error) {
        clearAllTimers();
        
        if (error.name === 'AbortError') {
            const timeoutError = new Error('请求超时，请检查网络后重试');
            timeoutError.code = 'TIMEOUT';
            if (onError) onError(timeoutError);
        } else {
            if (onError) onError(error);
        }
    } finally {
        clearAllTimers();
    }
}

export function getErrorMessage(error) {
    if (error.isNotContract) {
        return error.message || '抱歉，无法审查非合同相关的内容';
    }
    switch (error.code) {
        case 'INVALID_API_KEY':
            return 'API密钥无效，请联系管理员';
        case 'RATE_LIMIT':
            return '请求过于频繁，请稍后再试';
        case 'TOKEN_LIMIT':
            return '合同内容过长，请精简后重试';
        case 'TIMEOUT':
            return '请求超时，请检查网络后重试';
        case 'API_KEY_NOT_CONFIGURED':
            return '服务端API密钥未配置，请联系管理员';
        default:
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                return '网络连接失败，请确保代理服务已启动';
            }
            return error.message || '审查服务暂时不可用，请稍后重试';
    }
}

export async function getAgents() {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/agents`);
    if (!response.ok) {
        throw new Error('获取智能体列表失败');
    }
    return await response.json();
}

export async function getAgent(id) {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/agents/${id}`);
    if (!response.ok) {
        throw new Error('获取智能体信息失败');
    }
    return await response.json();
}

export async function classifyContract(text) {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/classify-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    if (!response.ok) {
        throw new Error('合同分类失败');
    }
    return await response.json();
}

export async function callAgentReviewApi(text, agentId, forceFull = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/review/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, agentId, forceFull }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.message || `请求失败: ${response.status}`);
            error.code = errorData.error;
            error.status = response.status;
            throw error;
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            const timeoutError = new Error('请求超时，请检查网络后重试');
            timeoutError.code = 'TIMEOUT';
            throw timeoutError;
        }
        
        throw error;
    }
}
