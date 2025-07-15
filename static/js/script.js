// Global variables
let parsedAccounts = [];
let testResults = [];
let testInterval = null;
let currentConfigSha = null;
let currentGitHubPath = null;
let linkDetectionInterval = null;

// DOM elements
const loadingOverlay = document.getElementById('loading-overlay');
const notificationContainer = document.getElementById('notification-container');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Load saved GitHub credentials from localStorage
    loadGitHubCredentials();
    
    // Set up file input handler
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    
    // Set up real-time link detection
    document.getElementById('vpn-links').addEventListener('input', detectLinks);
    
    // Initial UI state
    updateAccountCount();
    updateButtonStates();
    updateConfigStats();
    
    // Auto-expand first section
    toggleSection('github-content');
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Initialize tooltips
    initializeTooltips();
});

// Utility Functions
function showLoading(text = 'Loading...') {
    document.getElementById('loading-text').textContent = text;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="removeNotification(this)" style="background: none; border: none; color: #a0a0a0; cursor: pointer; font-size: 1.2rem;">×</button>
        </div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 5000);
}

function removeNotification(button) {
    const notification = button.closest('.notification');
    if (notification) {
        notification.remove();
    }
}

function toggleSection(contentId) {
    const content = document.getElementById(contentId);
    const toggleBtn = content.previousElementSibling.querySelector('.toggle-btn');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    } else {
        content.classList.add('collapsed');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    }
}

function updateAccountCount() {
    document.getElementById('account-count').textContent = parsedAccounts.length;
}

function updateButtonStates() {
    const hasAccounts = parsedAccounts.length > 0;
    const hasSuccessful = testResults.some(r => r.status === '●');
    
    document.getElementById('test-btn').disabled = !hasAccounts;
    document.getElementById('generate-btn').disabled = !hasSuccessful;
}

function updateConfigStats() {
    const configOutput = document.getElementById('config-output').value;
    
    if (configOutput) {
        try {
            const config = JSON.parse(configOutput);
            const outbounds = config.outbounds || [];
            const servers = outbounds.filter(o => o.type && o.type !== 'direct' && o.type !== 'block').length;
            const countries = new Set();
            const protocols = new Set();
            
            outbounds.forEach(o => {
                if (o.tag && o.tag.includes('🇮🇩')) countries.add('Indonesia');
                if (o.tag && o.tag.includes('🇸🇬')) countries.add('Singapore');
                if (o.tag && o.tag.includes('🇯🇵')) countries.add('Japan');
                if (o.tag && o.tag.includes('🇺🇸')) countries.add('USA');
                if (o.tag && o.tag.includes('🇰🇷')) countries.add('Korea');
                if (o.type) protocols.add(o.type.toUpperCase());
            });
            
            const size = (new Blob([configOutput]).size / 1024).toFixed(1);
            
            document.getElementById('config-servers').textContent = servers;
            document.getElementById('config-countries').textContent = countries.size;
            document.getElementById('config-protocols').textContent = protocols.size;
            document.getElementById('config-size').textContent = size + ' KB';
        } catch (e) {
            // Invalid JSON, reset stats
            document.getElementById('config-servers').textContent = '0';
            document.getElementById('config-countries').textContent = '0';
            document.getElementById('config-protocols').textContent = '0';
            document.getElementById('config-size').textContent = '0 KB';
        }
    }
}

function detectLinks() {
    const text = document.getElementById('vpn-links').value;
    const vpnPattern = /(?:vless|vmess|trojan|ss|ssr|hysteria|hysteria2|hy2|tuic):\/\/[^\s]+/g;
    const links = text.match(vpnPattern) || [];
    
    document.getElementById('link-count').textContent = links.length;
    
    // Update button states based on detected links
    const parseBtn = document.querySelector('[onclick="parseLinks()"]');
    if (links.length > 0) {
        parseBtn.classList.add('btn-success');
        parseBtn.classList.remove('btn-primary');
    } else {
        parseBtn.classList.add('btn-primary');
        parseBtn.classList.remove('btn-success');
    }
}

function updateTestProgress() {
    const total = testResults.length;
    const completed = testResults.filter(r => r.status === '●' || r.status.startsWith('✖')).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    document.querySelector('.progress-fill').style.width = percentage + '%';
    document.getElementById('progress-text').textContent = `Testing ${completed}/${total} accounts`;
    document.getElementById('progress-percentage').textContent = percentage.toFixed(0) + '%';
    
    // Update statistics
    const successful = testResults.filter(r => r.status === '●').length;
    const failed = testResults.filter(r => r.status.startsWith('✖')).length;
    const avgLatency = testResults.filter(r => r.latency > 0).reduce((sum, r) => sum + r.latency, 0) / successful || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    
    document.getElementById('stats-successful').textContent = successful;
    document.getElementById('stats-failed').textContent = failed;
    document.getElementById('stats-avg-latency').textContent = avgLatency.toFixed(0) + 'ms';
    document.getElementById('stats-success-rate').textContent = successRate.toFixed(1) + '%';
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            switch(event.key) {
                case 'Enter':
                    if (document.activeElement.id === 'vpn-links') {
                        event.preventDefault();
                        parseLinks();
                    }
                    break;
                case 'l':
                    event.preventDefault();
                    document.getElementById('vpn-links').focus();
                    break;
                case 's':
                    event.preventDefault();
                    if (document.getElementById('config-output').value) {
                        downloadConfig();
                    }
                    break;
                case 't':
                    event.preventDefault();
                    if (!document.getElementById('test-btn').disabled) {
                        startTesting();
                    }
                    break;
                case 'g':
                    event.preventDefault();
                    if (!document.getElementById('generate-btn').disabled) {
                        generateConfig();
                    }
                    break;
            }
        }
        
        // Escape key to close modals
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
}

function initializeTooltips() {
    // Tooltip functionality is handled by CSS
    // This function can be extended for more complex tooltip behavior
}

// GitHub Functions
function saveGitHubCredentials() {
    const token = document.getElementById('github-token').value;
    const owner = document.getElementById('github-owner').value;
    const repo = document.getElementById('github-repo').value;
    
    if (token && owner && repo) {
        localStorage.setItem('github_token', token);
        localStorage.setItem('github_owner', owner);
        localStorage.setItem('github_repo', repo);
    }
}

function loadGitHubCredentials() {
    const token = localStorage.getItem('github_token');
    const owner = localStorage.getItem('github_owner');
    const repo = localStorage.getItem('github_repo');
    
    if (token) document.getElementById('github-token').value = token;
    if (owner) document.getElementById('github-owner').value = owner;
    if (repo) document.getElementById('github-repo').value = repo;
}

async function loadGitHubFiles() {
    const token = document.getElementById('github-token').value;
    const owner = document.getElementById('github-owner').value;
    const repo = document.getElementById('github-repo').value;
    
    if (!token || !owner || !repo) {
        showNotification('Please fill in all GitHub credentials', 'error');
        return;
    }
    
    saveGitHubCredentials();
    showLoading('Loading GitHub files...');
    
    try {
        const response = await fetch('/api/github/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, owner, repo }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayGitHubFiles(data.files);
            showNotification(`Found ${data.files.length} JSON files`, 'success');
        } else {
            showNotification(data.error || 'Failed to load files', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function displayGitHubFiles(files) {
    const filesList = document.getElementById('github-files');
    
    if (files.length === 0) {
        filesList.innerHTML = '<p style="color: #a0a0a0; text-align: center;">No JSON files found</p>';
        return;
    }
    
    filesList.innerHTML = files.map(file => `
        <div class="file-item" onclick="loadGitHubFile('${file.path}', '${file.name}')">
            <div>
                <i class="fas fa-file-code"></i>
                <span>${file.name}</span>
            </div>
            <span style="font-size: 0.8rem; color: #666;">${formatFileSize(file.size)}</span>
        </div>
    `).join('');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function loadGitHubFile(filepath, filename) {
    const token = document.getElementById('github-token').value;
    const owner = document.getElementById('github-owner').value;
    const repo = document.getElementById('github-repo').value;
    
    showLoading(`Loading ${filename}...`);
    
    try {
        const response = await fetch(`/api/github/file/${filepath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, owner, repo }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Extract accounts from the config
            const extractResponse = await fetch('/api/extract-from-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config: data.content }),
            });
            
            const extractData = await extractResponse.json();
            
            if (extractResponse.ok) {
                parsedAccounts = extractData.accounts;
                currentConfigSha = data.sha;
                currentGitHubPath = filepath;
                
                updateAccountCount();
                updateButtonStates();
                displayAccountsTable();
                
                showNotification(`Loaded ${extractData.count} accounts from ${filename}`, 'success');
                
                // Auto-expand accounts section
                const accountsContent = document.getElementById('accounts-content');
                if (accountsContent.classList.contains('collapsed')) {
                    toggleSection('accounts-content');
                }
            } else {
                showNotification(extractData.error || 'Failed to extract accounts', 'error');
            }
        } else {
            showNotification(data.error || 'Failed to load file', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function uploadToGitHub() {
    const configOutput = document.getElementById('config-output').value;
    
    if (!configOutput) {
        showNotification('No configuration to upload', 'error');
        return;
    }
    
    const token = document.getElementById('github-token').value;
    const owner = document.getElementById('github-owner').value;
    const repo = document.getElementById('github-repo').value;
    
    if (!token || !owner || !repo) {
        showNotification('Please fill in all GitHub credentials', 'error');
        return;
    }
    
    // Pre-fill filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    document.getElementById('upload-filename').value = `VortexVpn-${timestamp}.json`;
    document.getElementById('commit-message').value = 'Update VPN configuration';
    
    showModal('upload-modal');
}

async function confirmUpload() {
    const token = document.getElementById('github-token').value;
    const owner = document.getElementById('github-owner').value;
    const repo = document.getElementById('github-repo').value;
    const filename = document.getElementById('upload-filename').value;
    const commitMsg = document.getElementById('commit-message').value;
    const configOutput = document.getElementById('config-output').value;
    
    if (!filename || !commitMsg) {
        showNotification('Please fill in filename and commit message', 'error');
        return;
    }
    
    closeModal('upload-modal');
    showLoading('Uploading to GitHub...');
    
    try {
        const response = await fetch('/api/github/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token,
                owner,
                repo,
                filepath: filename,
                content: configOutput,
                commit_msg: commitMsg,
                sha: currentGitHubPath === filename ? currentConfigSha : null
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Successfully uploaded to GitHub!', 'success');
            currentGitHubPath = filename;
        } else {
            showNotification(data.error || 'Failed to upload', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function createGitHubGist() {
    const configOutput = document.getElementById('config-output').value;
    
    if (!configOutput) {
        showNotification('No configuration to create gist', 'error');
        return;
    }
    
    showNotification('GitHub Gist creation not implemented yet', 'info');
}

// VPN Links Functions
async function parseLinks() {
    const linksText = document.getElementById('vpn-links').value.trim();
    
    if (!linksText) {
        showNotification('Please paste VPN links first', 'error');
        return;
    }
    
    showLoading('Parsing VPN links...');
    
    try {
        const response = await fetch('/api/parse-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ links: linksText }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            parsedAccounts = data.accounts;
            testResults = []; // Reset test results
            updateAccountCount();
            updateButtonStates();
            displayAccountsTable();
            
            showNotification(`Successfully parsed ${data.count} accounts`, 'success');
            
            // Auto-expand accounts section
            const accountsContent = document.getElementById('accounts-content');
            if (accountsContent.classList.contains('collapsed')) {
                toggleSection('accounts-content');
            }
        } else {
            showNotification(data.error || 'Failed to parse links', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function clearLinks() {
    document.getElementById('vpn-links').value = '';
    parsedAccounts = [];
    testResults = [];
    updateAccountCount();
    updateButtonStates();
    displayAccountsTable();
    detectLinks();
    showNotification('Links cleared', 'info');
}

function loadFromFile() {
    document.getElementById('file-input').click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        if (file.name.endsWith('.json')) {
            // Try to extract accounts from JSON config
            fetch('/api/extract-from-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config: content }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.accounts) {
                    parsedAccounts = data.accounts;
                    testResults = [];
                    updateAccountCount();
                    updateButtonStates();
                    displayAccountsTable();
                    showNotification(`Loaded ${data.count} accounts from JSON file`, 'success');
                } else {
                    showNotification('No valid accounts found in JSON file', 'error');
                }
            });
        } else {
            // Text file with links
            document.getElementById('vpn-links').value = content;
            detectLinks();
            showNotification('File content loaded. Click Parse Links to process.', 'info');
        }
    };
    
    reader.readAsText(file);
}

function validateLinks() {
    const linksText = document.getElementById('vpn-links').value.trim();
    
    if (!linksText) {
        showNotification('Please paste VPN links first', 'error');
        return;
    }
    
    const vpnPattern = /(?:vless|vmess|trojan|ss|ssr|hysteria|hysteria2|hy2|tuic):\/\/[^\s]+/g;
    const links = linksText.match(vpnPattern) || [];
    
    if (links.length === 0) {
        showNotification('No valid VPN links found', 'warning');
        return;
    }
    
    const protocols = {};
    links.forEach(link => {
        const protocol = link.split('://')[0];
        protocols[protocol] = (protocols[protocol] || 0) + 1;
    });
    
    const protocolSummary = Object.entries(protocols)
        .map(([protocol, count]) => `${protocol.toUpperCase()}: ${count}`)
        .join(', ');
    
    showNotification(`Found ${links.length} valid links (${protocolSummary})`, 'success');
}

function selectAllAccounts() {
    // This function would be implemented if we had account selection checkboxes
    showNotification('Select all accounts functionality not implemented yet', 'info');
}

function deselectAllAccounts() {
    // This function would be implemented if we had account selection checkboxes
    showNotification('Deselect all accounts functionality not implemented yet', 'info');
}

// Testing Functions
async function startTesting() {
    if (parsedAccounts.length === 0) {
        showNotification('No accounts to test', 'error');
        return;
    }
    
    const concurrentTests = parseInt(document.getElementById('concurrent-tests').value);
    
    showLoading('Starting tests...');
    
    try {
        const response = await fetch('/api/test-accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                accounts: parsedAccounts,
                max_concurrent: concurrentTests
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('test-btn').disabled = true;
            document.getElementById('stop-btn').disabled = false;
            document.getElementById('test-progress').classList.remove('hidden');
            
            // Start polling for results
            startPollingResults();
            
            showNotification(`Testing ${data.total} accounts...`, 'info');
        } else {
            showNotification(data.error || 'Failed to start testing', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function startPollingResults() {
    testInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/test-status');
            const data = await response.json();
            
            testResults = data.results;
            displayAccountsTable();
            updateTestProgress();
            
            if (!data.in_progress) {
                stopPollingResults();
                
                const successful = testResults.filter(r => r.status === '●').length;
                const failed = testResults.filter(r => r.status.startsWith('✖')).length;
                
                showNotification(`Testing completed: ${successful} passed, ${failed} failed`, 'success');
                updateButtonStates();
            }
        } catch (error) {
            console.error('Error polling results:', error);
        }
    }, 1000);
}

function stopPollingResults() {
    if (testInterval) {
        clearInterval(testInterval);
        testInterval = null;
    }
    
    document.getElementById('test-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
    document.getElementById('test-progress').classList.add('hidden');
}

function stopTesting() {
    stopPollingResults();
    showNotification('Testing stopped', 'warning');
}

function exportResults() {
    if (testResults.length === 0) {
        showNotification('No test results to export', 'error');
        return;
    }
    
    const results = testResults.map(r => ({
        index: r.index + 1,
        type: r.account?.type || 'unknown',
        tag: r.account?.tag || '',
        status: r.status,
        country: r.country,
        provider: r.provider,
        ip: r.ip,
        latency: r.latency,
        jitter: r.jitter,
        icmp: r.icmp
    }));
    
    const csv = 'Index,Type,Tag,Status,Country,Provider,IP,Latency,Jitter,ICMP\n' +
        results.map(r => `${r.index},${r.type},${r.tag},${r.status},${r.country},${r.provider},${r.ip},${r.latency},${r.jitter},${r.icmp}`).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Test results exported successfully', 'success');
}

// Table Display Functions
function displayAccountsTable() {
    const container = document.getElementById('accounts-table');
    
    if (parsedAccounts.length === 0) {
        container.innerHTML = '<p style="color: #a0a0a0; text-align: center; padding: 2rem;">No accounts parsed yet. Paste some VPN links to get started!</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'accounts-table enhanced-table';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th><i class="fas fa-hashtag"></i> No</th>
                <th><i class="fas fa-shield-alt"></i> Type</th>
                <th><i class="fas fa-tag"></i> Tag</th>
                <th><i class="fas fa-server"></i> Server</th>
                <th><i class="fas fa-plug"></i> Port</th>
                <th><i class="fas fa-flag"></i> Country</th>
                <th><i class="fas fa-building"></i> Provider</th>
                <th><i class="fas fa-map-marker-alt"></i> IP</th>
                <th><i class="fas fa-vial"></i> Test Type</th>
                <th><i class="fas fa-clock"></i> Latency</th>
                <th><i class="fas fa-wave-square"></i> Jitter</th>
                <th><i class="fas fa-satellite-dish"></i> ICMP</th>
                <th><i class="fas fa-heartbeat"></i> Status</th>
                <th><i class="fas fa-cogs"></i> Actions</th>
            </tr>
        </thead>
        <tbody>
            ${parsedAccounts.map((account, index) => {
                const result = testResults[index] || {};
                const latencyColor = getLatencyColor(result.latency);
                const jitterColor = getJitterColor(result.jitter);
                const statusBadge = getStatusBadge(result.status);
                
                return `
                    <tr class="account-row" data-index="${index}">
                        <td class="row-number">${index + 1}</td>
                        <td>
                            <span class="protocol-badge ${account.type?.toLowerCase() || 'unknown'}">
                                ${getProtocolIcon(account.type)} ${account.type?.toUpperCase() || 'N/A'}
                            </span>
                        </td>
                        <td class="tag-cell">
                            <span class="tag-text" title="${account.tag || 'No tag'}">${truncateText(account.tag || '-', 20)}</span>
                        </td>
                        <td class="server-cell">
                            <span class="server-text" title="${account.server || 'No server'}">${truncateText(account.server || '-', 25)}</span>
                        </td>
                        <td class="port-cell">
                            <span class="port-badge">${account.server_port || '-'}</span>
                        </td>
                        <td class="country-cell">
                            <span class="country-flag">${result.country || '❓'}</span>
                        </td>
                        <td class="provider-cell">
                            <span class="provider-text">${truncateText(result.provider || '-', 15)}</span>
                        </td>
                        <td class="ip-cell">
                            <span class="ip-text">${result.ip || '-'}</span>
                        </td>
                        <td class="test-type-cell">
                            <span class="test-type-badge ${getTestTypeClass(result.TestType)}">${result.TestType || 'N/A'}</span>
                        </td>
                        <td class="latency-cell">
                            <span class="latency-value" style="color: ${latencyColor}">
                                ${result.latency >= 0 ? `${result.latency} ms` : '-'}
                            </span>
                        </td>
                        <td class="jitter-cell">
                            <span class="jitter-value" style="color: ${jitterColor}">
                                ${result.jitter >= 0 ? `${result.jitter} ms` : '-'}
                            </span>
                        </td>
                        <td class="icmp-cell">
                            <span class="icmp-badge ${getIcmpClass(result.icmp)}">
                                ${result.icmp || 'N/A'}
                            </span>
                        </td>
                        <td class="status-cell">
                            ${statusBadge}
                        </td>
                        <td class="actions-cell">
                            <div class="action-buttons">
                                <button class="action-btn test-btn" onclick="testSingleAccount(${index})" title="Test Account">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="action-btn info-btn" onclick="showAccountInfo(${index})" title="Account Info">
                                    <i class="fas fa-info"></i>
                                </button>
                                <button class="action-btn remove-btn" onclick="removeAccount(${index})" title="Remove Account">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
    
    // Add click event listeners for row selection
    table.querySelectorAll('.account-row').forEach(row => {
        row.addEventListener('click', function(e) {
            if (!e.target.closest('.action-buttons')) {
                this.classList.toggle('selected');
            }
        });
    });
}

function getLatencyColor(latency) {
    if (latency < 0) return '#6c757d'; // Gray for unknown
    if (latency < 50) return '#28a745'; // Green for excellent
    if (latency < 100) return '#ffc107'; // Yellow for good
    if (latency < 200) return '#fd7e14'; // Orange for fair
    if (latency < 500) return '#dc3545'; // Red for poor
    return '#6f42c1'; // Purple for very poor
}

function getJitterColor(jitter) {
    if (jitter < 0) return '#6c757d'; // Gray for unknown
    if (jitter < 5) return '#28a745'; // Green for excellent
    if (jitter < 15) return '#ffc107'; // Yellow for good
    if (jitter < 30) return '#fd7e14'; // Orange for fair
    if (jitter < 50) return '#dc3545'; // Red for poor
    return '#6f42c1'; // Purple for very poor
}

function getStatusBadge(status) {
    if (!status || status === 'WAIT') {
        return '<span class="status-badge status-waiting"><i class="fas fa-hourglass-half"></i> WAIT</span>';
    }
    if (status === '●') {
        return '<span class="status-badge status-success"><i class="fas fa-check-circle"></i> ONLINE</span>';
    }
    if (status.startsWith('✖')) {
        return '<span class="status-badge status-failed"><i class="fas fa-times-circle"></i> FAILED</span>';
    }
    if (status.startsWith('Testing')) {
        return '<span class="status-badge status-testing"><i class="fas fa-spinner fa-spin"></i> TESTING</span>';
    }
    if (status.startsWith('Retry')) {
        return '<span class="status-badge status-retry"><i class="fas fa-redo"></i> RETRY</span>';
    }
    return '<span class="status-badge status-waiting"><i class="fas fa-hourglass-half"></i> WAIT</span>';
}

function getProtocolIcon(type) {
    const icons = {
        'vmess': '<i class="fas fa-shield-alt"></i>',
        'vless': '<i class="fas fa-shield-virus"></i>',
        'trojan': '<i class="fas fa-horse"></i>',
        'shadowsocks': '<i class="fas fa-eye-slash"></i>',
        'shadowsocksr': '<i class="fas fa-user-secret"></i>',
        'hysteria': '<i class="fas fa-bolt"></i>',
        'hysteria2': '<i class="fas fa-thunder"></i>',
        'tuic': '<i class="fas fa-rocket"></i>'
    };
    return icons[type?.toLowerCase()] || '<i class="fas fa-question"></i>';
}

function getIcmpClass(icmp) {
    if (!icmp || icmp === 'N/A') return 'icmp-unknown';
    if (icmp.includes('✓') || icmp.includes('OK')) return 'icmp-success';
    if (icmp.includes('✗') || icmp.includes('FAIL')) return 'icmp-failed';
    return 'icmp-unknown';
}

function getTestTypeClass(testType) {
    if (!testType || testType === 'N/A') return 'test-type-unknown';
    
    const type = testType.toLowerCase();
    if (type.includes('path')) return 'test-type-path';
    if (type.includes('host')) return 'test-type-host';
    if (type.includes('server')) return 'test-type-server';
    
    return 'test-type-unknown';
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// New action functions
function testSingleAccount(index) {
    // Implementation for testing single account
    console.log('Testing account:', index);
    // Add your test logic here
}

function showAccountInfo(index) {
    const account = parsedAccounts[index];
    const result = testResults[index] || {};
    
    // Create modal or alert with account information
    const info = `
        Account Info:
        - Type: ${account.type || 'N/A'}
        - Tag: ${account.tag || 'N/A'}
        - Server: ${account.server || 'N/A'}
        - Port: ${account.server_port || 'N/A'}
        - Status: ${result.status || 'Not tested'}
        - Test Type: ${result.TestType || 'N/A'}
        - Latency: ${result.latency >= 0 ? result.latency + ' ms' : 'N/A'}
        - Jitter: ${result.jitter >= 0 ? result.jitter + ' ms' : 'N/A'}
        - ICMP: ${result.icmp || 'N/A'}
        - Tested IP: ${result.ip || 'N/A'}
        - Country: ${result.country || 'Unknown'}
        - Provider: ${result.provider || 'Unknown'}
    `;
    
    alert(info); // Replace with a proper modal later
}

function removeAccount(index) {
    if (confirm('Are you sure you want to remove this account?')) {
        parsedAccounts.splice(index, 1);
        testResults.splice(index, 1);
        displayAccountsTable();
        updateAccountCount();
        updateButtonStates();
    }
}

// Config Generation Functions
async function generateConfig() {
    const successfulResults = testResults.filter(r => r.status === '●');
    
    if (successfulResults.length === 0) {
        showNotification('No successful accounts to generate config', 'error');
        return;
    }
    
    showLoading('Generating configuration...');
    
    try {
        const response = await fetch('/api/generate-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ successful_results: successfulResults }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('config-output').value = data.config;
            updateConfigStats();
            
            showNotification(`Generated config with ${successfulResults.length} accounts`, 'success');
            
            // Auto-expand config section
            const configContent = document.getElementById('config-content');
            if (configContent.classList.contains('collapsed')) {
                toggleSection('config-content');
            }
        } else {
            showNotification(data.error || 'Failed to generate config', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function downloadConfig() {
    const configText = document.getElementById('config-output').value;
    
    if (!configText) {
        showNotification('No configuration to download', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/download-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ config: configText }),
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'config.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('Configuration downloaded successfully', 'success');
        } else {
            showNotification('Failed to download configuration', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    }
}

function copyConfig() {
    const configText = document.getElementById('config-output').value;
    
    if (!configText) {
        showNotification('No configuration to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(configText).then(() => {
        showNotification('Configuration copied to clipboard', 'success');
    }).catch(() => {
        showNotification('Failed to copy configuration', 'error');
    });
}

function shareConfig() {
    const configText = document.getElementById('config-output').value;
    
    if (!configText) {
        showNotification('No configuration to share', 'error');
        return;
    }
    
    if (navigator.share) {
        navigator.share({
            title: 'VortexVPN Configuration',
            text: 'VPN Configuration File',
            files: [new File([configText], 'vortex-vpn-config.json', { type: 'application/json' })]
        }).catch(err => {
            console.error('Error sharing:', err);
            copyConfig(); // Fallback to copy
        });
    } else {
        copyConfig(); // Fallback to copy
    }
}

function formatConfig() {
    const configText = document.getElementById('config-output').value;
    
    if (!configText) {
        showNotification('No configuration to format', 'error');
        return;
    }
    
    try {
        const formatted = JSON.stringify(JSON.parse(configText), null, 2);
        document.getElementById('config-output').value = formatted;
        updateConfigStats();
        showNotification('Configuration formatted successfully', 'success');
    } catch (error) {
        showNotification('Invalid JSON configuration', 'error');
    }
}

function validateConfig() {
    const configText = document.getElementById('config-output').value;
    
    if (!configText) {
        showNotification('No configuration to validate', 'error');
        return;
    }
    
    try {
        const config = JSON.parse(configText);
        const issues = [];
        
        // Basic validation
        if (!config.outbounds) issues.push('Missing outbounds section');
        if (!config.dns) issues.push('Missing DNS configuration');
        if (!config.log) issues.push('Missing log configuration');
        
        if (issues.length === 0) {
            showNotification('Configuration is valid', 'success');
        } else {
            showNotification(`Configuration issues: ${issues.join(', ')}`, 'warning');
        }
    } catch (error) {
        showNotification('Invalid JSON configuration', 'error');
    }
}

function previewConfig() {
    const configText = document.getElementById('config-output').value;
    
    if (!configText) {
        showNotification('No configuration to preview', 'error');
        return;
    }
    
    try {
        const config = JSON.parse(configText);
        const preview = document.getElementById('preview-content');
        
        // Generate a structured preview
        let previewHTML = '<h4>Configuration Overview</h4>';
        
        if (config.outbounds) {
            const serverOutbounds = config.outbounds.filter(o => o.type && o.type !== 'direct' && o.type !== 'block');
            previewHTML += `<p><strong>Servers:</strong> ${serverOutbounds.length}</p>`;
            previewHTML += '<h5>Outbounds:</h5><ul>';
            serverOutbounds.slice(0, 10).forEach(o => {
                previewHTML += `<li>${o.tag || 'Unnamed'} (${o.type})</li>`;
            });
            if (serverOutbounds.length > 10) {
                previewHTML += `<li>... and ${serverOutbounds.length - 10} more</li>`;
            }
            previewHTML += '</ul>';
        }
        
        if (config.dns) {
            previewHTML += `<h5>DNS:</h5><p>${config.dns.servers?.length || 0} servers configured</p>`;
        }
        
        preview.innerHTML = previewHTML;
        showModal('preview-modal');
    } catch (error) {
        showNotification('Invalid JSON configuration', 'error');
    }
}

function toggleWrap() {
    const textarea = document.getElementById('config-output');
    const currentWrap = textarea.style.whiteSpace;
    
    if (currentWrap === 'nowrap') {
        textarea.style.whiteSpace = 'pre-wrap';
        showNotification('Text wrapping enabled', 'info');
    } else {
        textarea.style.whiteSpace = 'nowrap';
        showNotification('Text wrapping disabled', 'info');
    }
}

// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showAbout() {
    showNotification('VortexVPN Config Manager v2.0 - Advanced VPN Configuration Tool', 'info');
}

function showHelp() {
    showModal('help-modal');
}

function showKeyboardShortcuts() {
    const shortcuts = `
        <h4>Keyboard Shortcuts</h4>
        <ul>
            <li><strong>Ctrl+L:</strong> Focus on VPN links input</li>
            <li><strong>Ctrl+Enter:</strong> Parse links (when in input)</li>
            <li><strong>Ctrl+T:</strong> Start testing</li>
            <li><strong>Ctrl+G:</strong> Generate config</li>
            <li><strong>Ctrl+S:</strong> Download config</li>
            <li><strong>Escape:</strong> Close modals</li>
        </ul>
    `;
    
    showNotification(shortcuts, 'info');
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Auto-save GitHub credentials on input
document.getElementById('github-token').addEventListener('input', saveGitHubCredentials);
document.getElementById('github-owner').addEventListener('input', saveGitHubCredentials);
document.getElementById('github-repo').addEventListener('input', saveGitHubCredentials);

// Auto-update config stats when config changes
document.getElementById('config-output').addEventListener('input', updateConfigStats);

// Add to Config Functions
async function addToConfig() {
    const existingConfig = document.getElementById('existing-config').value.trim();
    const newLinksText = document.getElementById('new-links').value.trim();
    
    if (!existingConfig) {
        showNotification('Please provide an existing configuration', 'error');
        return;
    }
    
    if (!newLinksText) {
        showNotification('Please provide new VPN links to add', 'error');
        return;
    }
    
    const newLinks = newLinksText.split('\n').filter(link => link.trim());
    
    showLoading('Adding accounts to configuration...');
    
    try {
        const response = await fetch('/api/add-to-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                existing_config: existingConfig,
                new_links: newLinks
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('config-output').value = data.config;
            updateConfigStats();
            
            const resultDiv = document.getElementById('add-config-result');
            resultDiv.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    Successfully added ${data.added_count} new accounts to configuration!
                    <br>
                    Total accounts: ${data.total_accounts}
                </div>
            `;
            
            showNotification(`Added ${data.added_count} accounts to configuration`, 'success');
            
            // Clear the new links input
            document.getElementById('new-links').value = '';
            updateNewLinkCount();
            
        } else {
            const resultDiv = document.getElementById('add-config-result');
            resultDiv.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error: ${data.error}
                </div>
            `;
            showNotification(data.error, 'error');
        }
        
    } catch (error) {
        const resultDiv = document.getElementById('add-config-result');
        resultDiv.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                Network error: ${error.message}
            </div>
        `;
        showNotification('Network error occurred', 'error');
    } finally {
        hideLoading();
    }
}

function validateExistingConfig() {
    const configText = document.getElementById('existing-config').value.trim();
    
    if (!configText) {
        showNotification('Please provide a configuration to validate', 'error');
        return;
    }
    
    try {
        const config = JSON.parse(configText);
        
        // Basic validation
        if (!config.outbounds || !Array.isArray(config.outbounds)) {
            showNotification('Invalid configuration: missing outbounds array', 'error');
            return;
        }
        
        const accountCount = config.outbounds.filter(o => 
            ['vmess', 'vless', 'trojan', 'shadowsocks', 'shadowsocksr', 'hysteria', 'hysteria2', 'tuic'].includes(o.type)
        ).length;
        
        showNotification(`Configuration is valid! Found ${accountCount} VPN accounts`, 'success');
        updateAddToConfigButtons();
        
    } catch (error) {
        showNotification('Invalid JSON configuration', 'error');
    }
}

function detectNewLinks() {
    const linksText = document.getElementById('new-links').value;
    const links = linksText.split('\n').filter(link => {
        const trimmed = link.trim();
        return trimmed && (
            trimmed.startsWith('vmess://') ||
            trimmed.startsWith('vless://') ||
            trimmed.startsWith('trojan://') ||
            trimmed.startsWith('ss://') ||
            trimmed.startsWith('ssr://') ||
            trimmed.startsWith('hysteria://') ||
            trimmed.startsWith('hysteria2://') ||
            trimmed.startsWith('hy2://') ||
            trimmed.startsWith('tuic://')
        );
    });
    
    document.getElementById('new-link-count').textContent = links.length;
    updateAddToConfigButtons();
    
    if (links.length > 0) {
        showNotification(`Detected ${links.length} valid VPN links`, 'success');
    } else {
        showNotification('No valid VPN links detected', 'warning');
    }
}

function updateNewLinkCount() {
    const linksText = document.getElementById('new-links').value;
    const links = linksText.split('\n').filter(link => {
        const trimmed = link.trim();
        return trimmed && (
            trimmed.startsWith('vmess://') ||
            trimmed.startsWith('vless://') ||
            trimmed.startsWith('trojan://') ||
            trimmed.startsWith('ss://') ||
            trimmed.startsWith('ssr://') ||
            trimmed.startsWith('hysteria://') ||
            trimmed.startsWith('hysteria2://') ||
            trimmed.startsWith('hy2://') ||
            trimmed.startsWith('tuic://')
        );
    });
    
    document.getElementById('new-link-count').textContent = links.length;
    updateAddToConfigButtons();
}

function updateAddToConfigButtons() {
    const hasConfig = document.getElementById('existing-config').value.trim();
    const hasLinks = document.getElementById('new-link-count').textContent !== '0';
    
    document.getElementById('add-to-config-btn').disabled = !hasConfig || !hasLinks;
    document.getElementById('preview-merged-btn').disabled = !hasConfig || !hasLinks;
}

function clearNewLinks() {
    document.getElementById('new-links').value = '';
    updateNewLinkCount();
}

function loadConfigFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('existing-config').value = e.target.result;
                validateExistingConfig();
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function previewMergedConfig() {
    const existingConfig = document.getElementById('existing-config').value.trim();
    const newLinksText = document.getElementById('new-links').value.trim();
    
    if (!existingConfig || !newLinksText) {
        showNotification('Please provide both existing config and new links', 'error');
        return;
    }
    
    try {
        const config = JSON.parse(existingConfig);
        const newLinks = newLinksText.split('\n').filter(link => link.trim());
        
        // Show preview modal with existing accounts and new links
        const existingAccounts = config.outbounds.filter(o => 
            ['vmess', 'vless', 'trojan', 'shadowsocks', 'shadowsocksr', 'hysteria', 'hysteria2', 'tuic'].includes(o.type)
        );
        
        const previewContent = `
            <div class="preview-summary">
                <h4>Merge Preview</h4>
                <p><strong>Existing accounts:</strong> ${existingAccounts.length}</p>
                <p><strong>New links to add:</strong> ${newLinks.length}</p>
                <p><strong>Total after merge:</strong> ${existingAccounts.length + newLinks.length}</p>
            </div>
            <div class="preview-details">
                <h5>Existing Accounts:</h5>
                <ul>
                    ${existingAccounts.map(acc => `<li>${acc.type}: ${acc.tag || acc.server}</li>`).join('')}
                </ul>
                <h5>New Links:</h5>
                <ul>
                    ${newLinks.map(link => `<li>${link.substring(0, 50)}...</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Show in a simple alert for now (can be enhanced to a proper modal)
        alert(previewContent.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n'));
        
    } catch (error) {
        showNotification('Error parsing configuration', 'error');
    }
}

// Set up event listeners for new links input
document.addEventListener('DOMContentLoaded', function() {
    const newLinksInput = document.getElementById('new-links');
    const existingConfigInput = document.getElementById('existing-config');
    
    if (newLinksInput) {
        newLinksInput.addEventListener('input', updateNewLinkCount);
    }
    
    if (existingConfigInput) {
        existingConfigInput.addEventListener('input', updateAddToConfigButtons);
    }
});