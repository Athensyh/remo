export const CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MIN_RISKS: 3,
    MAX_RISKS: 8,
    CONTEXT_LENGTH: 15,
    MAX_CONTRACT_LENGTH: 30000,
    API_BASE_URL: window.location.hostname === 'athensyh.github.io' 
        ? 'https://contract-server-pobb.onrender.com' 
        : window.location.origin,
    HISTORY_KEY: 'contract_review_history',
    MAX_HISTORY_ITEMS: 50,
    MAX_CONTRACT_PREVIEW: 5000
};

export const HISTORY_CONFIG = {
    STORAGE_KEY: 'contract_review_history',
    MAX_ITEMS: 50,
    MAX_CONTRACT_LENGTH: 5000,
    MAX_STORAGE_SIZE: 4.5 * 1024 * 1024
};

export const API_STATUS = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error'
};

export const RISK_LABELS = {
    high: '高',
    medium: '中',
    low: '低'
};

export const riskTypes = [
    '条款模糊不清',
    '责任不对等',
    '违约金过高',
    '免责条款风险',
    '付款条件不明确',
    '知识产权归属不明',
    '保密条款缺失',
    '争议解决方式不当',
    '合同期限不合理',
    '变更条款缺失',
    '终止条件不明确',
    '赔偿限额过高',
    '管辖法院不利',
    '不可抗力条款缺失',
    '违约责任不对等'
];

export const riskSuggestions = {
    '条款模糊不清': {
        suggestion: '建议明确具体条款内容，避免使用"合理"、"适当"等模糊表述，应量化或具体化相关标准。',
        legalBasis: '《民法典》第四百七十条：合同的内容由当事人约定，一般包括当事人的名称或者姓名和住所、标的、数量、质量、价款或者报酬、履行期限、地点和方式、违约责任、解决争议的方法等条款。',
        riskWarning: '条款模糊不清可能导致双方对合同内容理解产生分歧，在发生争议时难以确定双方权利义务，增加诉讼风险和成本。法院可能依据合同解释规则作出不利于起草方的解释。'
    },
    '责任不对等': {
        suggestion: '建议重新协商双方责任分配，确保权利义务对等，避免单方面承担过多风险。',
        legalBasis: '《民法典》第六条：民事主体从事民事活动，应当遵循公平原则，合理确定各方的权利和义务。第五百零九条：当事人应当按照约定全面履行自己的义务。',
        riskWarning: '责任不对等可能导致显失公平，受损方在诉讼中可请求法院变更或撤销合同，或主张格式条款无效。同时可能影响商业合作关系，增加合同履行难度。'
    },
    '违约金过高': {
        suggestion: '建议调整违约金比例，一般不超过合同总金额的30%，过高可能不被法院支持。',
        legalBasis: '《民法典》第五百八十五条：约定的违约金低于造成的损失的，人民法院或者仲裁机构可以根据当事人的请求予以增加；约定的违约金过分高于造成的损失的，人民法院或者仲裁机构可以根据当事人的请求予以适当减少。',
        riskWarning: '违约金过高可能被法院认定为过分高于实际损失而予以调减，不仅无法实现预期约束效果，还可能在诉讼中承担举证责任，增加诉讼成本。'
    },
    '免责条款风险': {
        suggestion: '建议审查免责条款的合法性，部分免责条款可能因违反法律强制性规定而无效。',
        legalBasis: '《民法典》第四百九十七条：有下列情形之一的，该格式条款无效：（一）具有本法第一编第六章第三节和本法第五百零六条规定的无效情形；（二）提供格式条款一方不合理地免除或者减轻其责任、加重对方责任、限制对方主要权利；（三）提供格式条款一方排除对方主要权利。',
        riskWarning: '违法的免责条款将被认定无效，无法起到免责效果。如果因免责条款导致对方损失，还可能承担赔偿责任。在消费者合同中，可能面临行政处罚。'
    },
    '付款条件不明确': {
        suggestion: '建议明确付款时间、方式、账户等具体信息，避免因约定不明产生纠纷。',
        legalBasis: '《民法典》第五百一十条：合同生效后，当事人就质量、价款或者报酬、履行地点等内容没有约定或者约定不明确的，可以协议补充；不能达成补充协议的，按照合同相关条款或者交易习惯确定。',
        riskWarning: '付款条件不明确可能导致付款时间争议、付款方式争议，影响资金周转和合同履行进度。在发生争议时，需要通过补充协议或依据交易习惯确定，增加协商成本。'
    },
    '知识产权归属不明': {
        suggestion: '建议明确约定合作过程中产生的知识产权归属，避免后续权属争议。',
        legalBasis: '《民法典》第八百五十九条：委托开发合同完成的发明创造，除法律另有规定或者当事人另有约定外，申请专利的权利属于研究开发人。第八百六十条：合作开发合同完成的发明创造，除当事人另有约定外，申请专利的权利属于合作开发的当事人共有。',
        riskWarning: '知识产权归属不明可能导致后续权属争议，影响技术成果的商业化应用，可能面临侵权诉讼风险，造成经济损失和声誉损害。'
    },
    '保密条款缺失': {
        suggestion: '建议增加保密条款，明确保密范围、期限及违约责任，保护商业秘密。',
        legalBasis: '《反不正当竞争法》第九条：经营者不得实施下列侵犯商业秘密的行为：（一）以盗窃、贿赂、欺诈、胁迫、电子侵入或者其他不正当手段获取权利人的商业秘密；《民法典》第五百零一条：当事人在订立合同过程中知悉的商业秘密或者其他应当保密的信息，无论合同是否成立，不得泄露或者不正当地使用。',
        riskWarning: '保密条款缺失可能导致商业秘密泄露，造成竞争优势丧失、客户流失、市场份额下降等严重后果。在发生泄密时，难以追究对方责任，维权成本高。'
    },
    '争议解决方式不当': {
        suggestion: '建议选择合适的争议解决方式，如仲裁或诉讼，并明确管辖机构。',
        legalBasis: '《民事诉讼法》第三十五条：合同或者其他财产权益纠纷的当事人，可以书面协议选择被告住所地、合同履行地、合同签订地、原告住所地、标的物所在地等与争议有实际联系的地点的人民法院管辖。《仲裁法》第六条：仲裁委员会应当由当事人协议选定。',
        riskWarning: '争议解决方式约定不当可能导致管辖权异议，延长诉讼周期，增加诉讼成本。选择不熟悉的仲裁机构或法院可能面临程序不熟悉、律师费用高等问题。'
    },
    '合同期限不合理': {
        suggestion: '建议根据实际业务需要调整合同期限，过长或过短都可能带来风险。',
        legalBasis: '《民法典》第一百六十条：民事法律行为可以附期限，但是根据其性质不得附期限的除外。附生效期限的民事法律行为，自期限届至时生效。附终止期限的民事法律行为，自期限届满时失效。',
        riskWarning: '合同期限过长可能锁定在不利的市场条件下，无法及时调整合作方式；期限过短可能导致频繁续约，增加管理成本，影响业务稳定性。'
    },
    '变更条款缺失': {
        suggestion: '建议增加合同变更条款，明确变更程序和条件，避免口头变更无效。',
        legalBasis: '《民法典》第五百四十三条：当事人协商一致，可以变更合同。第五百四十四条：当事人对合同变更的内容约定不明确的，推定为未变更。',
        riskWarning: '变更条款缺失可能导致口头变更无效，双方对变更内容产生争议时无法举证，可能被迫按照原合同履行，造成经济损失或商业机会丧失。'
    },
    '终止条件不明确': {
        suggestion: '建议明确合同终止的具体条件和程序，包括提前终止的通知期限。',
        legalBasis: '《民法典》第五百六十二条：当事人协商一致，可以解除合同。当事人可以约定一方解除合同的事由。解除合同的事由发生时，解除权人可以解除合同。第五百六十五条：当事人一方依法主张解除合同的，应当通知对方。',
        riskWarning: '终止条件不明确可能导致合同无法及时终止，继续承担不必要的义务和费用；或因终止程序不当构成违约，需要承担违约责任。'
    },
    '赔偿限额过高': {
        suggestion: '建议设置合理的赔偿限额，避免因意外事件导致巨额赔偿。',
        legalBasis: '《民法典》第五百八十四条：当事人一方不履行合同义务或者履行合同义务不符合约定，造成对方损失的，损失赔偿额应当相当于因违约所造成的损失，包括合同履行后可以获得的利益；但是，不得超过违约一方订立合同时预见到或者应当预见到的因违约可能造成的损失。',
        riskWarning: '赔偿限额过高可能导致承担超出实际损失的赔偿，影响企业资金流和经营稳定性。在诉讼中可能被法院认定过高而予以调整，但仍需承担诉讼费用。'
    },
    '管辖法院不利': {
        suggestion: '建议协商选择对己方有利的管辖法院，降低诉讼成本和风险。',
        legalBasis: '《民事诉讼法》第三十五条：合同或者其他财产权益纠纷的当事人，可以书面协议选择被告住所地、合同履行地、合同签订地、原告住所地、标的物所在地等与争议有实际联系的地点的人民法院管辖，但不得违反本法对级别管辖和专属管辖的规定。',
        riskWarning: '管辖法院不利可能导致异地诉讼，增加差旅费用、律师费用，延长诉讼周期。对当地司法环境不熟悉可能影响诉讼策略制定，增加败诉风险。'
    },
    '不可抗力条款缺失': {
        suggestion: '建议增加不可抗力条款，明确不可抗力的范围和法律后果。',
        legalBasis: '《民法典》第一百八十条：因不可抗力不能履行民事义务的，不承担民事责任。法律另有规定的，依照其规定。不可抗力是不能预见、不能避免且不能克服的客观情况。第五百九十条：当事人一方因不可抗力不能履行合同的，根据不可抗力的影响，部分或者全部免除责任，但是法律另有规定的除外。',
        riskWarning: '不可抗力条款缺失可能导致在发生自然灾害、政府行为等不可抗力事件时，无法及时主张免责，仍需承担违约责任。可能造成不必要的经济损失。'
    },
    '违约责任不对等': {
        suggestion: '建议平衡双方违约责任，避免己方承担过重的违约后果。',
        legalBasis: '《民法典》第六条：民事主体从事民事活动，应当遵循公平原则，合理确定各方的权利和义务。第四百九十七条：提供格式条款一方不合理地免除或者减轻其责任、加重对方责任、限制对方主要权利的，该格式条款无效。',
        riskWarning: '违约责任不对等可能导致在己方违约时承担过重的赔偿责任，而对方违约时获得的赔偿不足。显失公平的条款可能被认定无效，影响合同稳定性。'
    }
};

export function getRiskLabel(level) {
    return RISK_LABELS[level] || '';
}

export function getRiskText(level) {
    return getRiskLabel(level) + '风险';
}

export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
    }, 3000);
}

export function showPersistentError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

export function hideError(element) {
    element.classList.remove('show');
}

export function showToast(message, isError = false) {
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-message ${isError ? 'error' : ''}`;
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            ${isError 
                ? '<path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
                : '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
            }
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板');
            return true;
        }).catch(err => {
            console.error('复制失败:', err);
            return fallbackCopyToClipboard(text);
        });
    } else {
        return fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
            showToast('已复制到剪贴板');
            return true;
        } else {
            showToast('复制失败，请手动复制', true);
            return false;
        }
    } catch (err) {
        document.body.removeChild(textarea);
        showToast('复制失败，请手动复制', true);
        return false;
    }
}
