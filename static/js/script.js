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
    
    // Initialize theme
    initializeTheme();
    
    // Add geometric shapes to background
    generateGeometricShapes();
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
            // Store the existing config content
            const existingConfig = data.content;
            currentConfigSha = data.sha;
            currentGitHubPath = filepath;
            
            // Set the config output to the loaded content
            document.getElementById('config-output').value = existingConfig;
            
            // Extract accounts from the config
            const extractResponse = await fetch('/api/extract-from-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config: existingConfig }),
            });
            
            const extractData = await extractResponse.json();
            
            if (extractResponse.ok) {
                parsedAccounts = extractData.accounts;
                
                updateAccountCount();
                updateButtonStates();
                displayAccountsTable();
                
                showNotification(`Loaded ${extractData.count} accounts from ${filename}`, 'success');
                
                // Auto-expand accounts section
                const accountsContent = document.getElementById('accounts-content');
                if (accountsContent.classList.contains('collapsed')) {
                    toggleSection('accounts-content');
                }
                
                // Now automatically parse and test the loaded config
                await parseAndTest();
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
    
    // Check if we're updating an existing file or creating a new one
    if (currentGitHubPath && currentConfigSha) {
        // Updating existing file
        const filename = currentGitHubPath.split('/').pop();
        const confirmUpdate = confirm(`Update existing file "${filename}"?`);
        if (confirmUpdate) {
            performGitHubUpload(currentGitHubPath, configOutput, `Update ${filename}`, currentConfigSha);
        }
    } else {
        // Creating new file
        const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
        const filename = `VortexVpn-${timestamp}.json`;
        const confirmCreate = confirm(`Create new file "${filename}"?`);
        if (confirmCreate) {
            performGitHubUpload(filename, configOutput, `Create ${filename}`, null);
        }
    }
}
}

async function performGitHubUpload(filepath, content, message, sha) {
    const token = document.getElementById('github-token').value;
    const owner = document.getElementById('github-owner').value;
    const repo = document.getElementById('github-repo').value;
    
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
                filepath: filepath,
                content: content,
                commit_msg: message,
                sha: sha
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Successfully ${sha ? 'updated' : 'created'} ${filepath}`, 'success');
            
            // Update SHA for future updates
            currentConfigSha = data.sha;
            currentGitHubPath = filepath;
            
            // Refresh files list
            loadGitHubFiles();
        } else {
            showNotification(data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function confirmUpload() {
    const filename = document.getElementById('upload-filename').value;
    const commitMsg = document.getElementById('commit-message').value;
    const configOutput = document.getElementById('config-output').value;
    
    if (!filename || !commitMsg) {
        showNotification('Please fill in filename and commit message', 'error');
        return;
    }
    
    closeModal('upload-modal');
    await performGitHubUpload(filename, configOutput, commitMsg, currentConfigSha);
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
        container.innerHTML = '<p style="color: #a0a0a0; text-align: center;">No accounts parsed yet</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'accounts-table';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th>No</th>
                <th>Type</th>
                <th>Tag</th>
                <th>Country</th>
                <th>Provider</th>
                <th>IP</th>
                <th>Latency</th>
                <th>Jitter</th>
                <th>ICMP</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${parsedAccounts.map((account, index) => {
                const result = testResults[index] || {};
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td><span class="protocol-badge">${account.type?.toUpperCase() || 'N/A'}</span></td>
                        <td>${account.tag || '-'}</td>
                        <td>${result.country || '❓'}</td>
                        <td>${result.provider || '-'}</td>
                        <td>${result.ip || '-'}</td>
                        <td>${result.latency >= 0 ? result.latency + ' ms' : '-'}</td>
                        <td>${result.jitter >= 0 ? result.jitter + ' ms' : '-'}</td>
                        <td>${result.icmp || 'N/A'}</td>
                        <td class="${getStatusClass(result.status)}">${result.status || 'WAIT'}</td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

function getStatusClass(status) {
    if (!status) return 'status-waiting';
    if (status === 'WAIT') return 'status-waiting';
    if (status === '●') return 'status-success';
    if (status.startsWith('✖')) return 'status-failed';
    if (status.startsWith('Testing')) return 'status-testing';
    if (status.startsWith('Retry')) return 'status-retry';
    return 'status-waiting';
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

// Theme Toggle Functions
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Add transition effect
    document.body.style.transition = 'all 0.3s ease';
    
    // Update theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Show notification
    showNotification(`Switched to ${newTheme} mode`, 'info');
    
    // Remove transition after animation
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('#theme-toggle i');
    if (theme === 'dark') {
        themeIcon.className = 'fas fa-moon';
    } else {
        themeIcon.className = 'fas fa-sun';
    }
}

// Geometric Shapes Animation
function generateGeometricShapes() {
    const animatedBg = document.querySelector('.animated-bg');
    const shapesContainer = document.createElement('div');
    shapesContainer.className = 'geometric-shapes';
    
    const shapes = ['triangle', 'square', 'circle', 'diamond', 'hexagon'];
    
    function createShape() {
        const shape = document.createElement('div');
        const shapeType = shapes[Math.floor(Math.random() * shapes.length)];
        shape.className = `geometric-shape ${shapeType}`;
        
        // Random position
        shape.style.left = Math.random() * 100 + '%';
        shape.style.animationDuration = (Math.random() * 20 + 10) + 's';
        shape.style.animationDelay = Math.random() * 5 + 's';
        
        shapesContainer.appendChild(shape);
        
        // Remove shape after animation
        setTimeout(() => {
            if (shape.parentNode) {
                shape.parentNode.removeChild(shape);
            }
        }, 25000);
    }
    
    animatedBg.appendChild(shapesContainer);
    
    // Create initial shapes
    for (let i = 0; i < 10; i++) {
        setTimeout(createShape, i * 2000);
    }
    
    // Continuously create new shapes
    setInterval(createShape, 3000);
}

// Enhanced Parse and Test Function
async function parseAndTest() {
    const linksInput = document.getElementById('vpn-links');
    const links = extractLinks(linksInput.value);
    
    // Get existing config if any
    let existingConfig = '';
    const configOutput = document.getElementById('config-output');
    if (configOutput.value) {
        existingConfig = configOutput.value;
    }
    
    if (links.length === 0 && !existingConfig) {
        showNotification('Please enter VPN links or select a config file', 'error');
        return;
    }
    
    showLoading('Parsing and testing accounts...');
    
    try {
        const response = await fetch('/api/parse-and-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                links: links,
                existing_config: existingConfig
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to parse and test');
        }
        
        showNotification(`Started testing ${data.account_count} accounts`, 'success');
        parsedAccounts = data.accounts;
        updateAccountCount();
        
        // Start monitoring test results
        startTestMonitoring();
        
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Parse from existing config
async function parseFromConfig() {
    const configInput = prompt('Paste your config JSON here:');
    if (!configInput) return;
    
    try {
        showLoading('Extracting accounts from config...');
        
        const response = await fetch('/api/extract-from-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                config: configInput
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to extract accounts');
        }
        
        showNotification(`Extracted ${data.count} accounts from config`, 'success');
        
        // Now parse and test these accounts
        await parseAndTest();
        
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Enhanced Test Results Display
function displayTestResults(results) {
    const container = document.getElementById('accounts-table');
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p>No test results to display</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'accounts-table';
    
    // Create header
    const headerRow = document.createElement('tr');
    const headers = ['#', 'Type', 'Status', 'Ping', 'Country', 'Provider', 'IP', 'Actions'];
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create rows
    results.forEach((result, index) => {
        const row = document.createElement('tr');
        row.className = 'row-enter';
        
        // Index
        const indexCell = document.createElement('td');
        indexCell.textContent = index + 1;
        row.appendChild(indexCell);
        
        // Type
        const typeCell = document.createElement('td');
        typeCell.textContent = result.VpnType || 'Unknown';
        row.appendChild(typeCell);
        
        // Status
        const statusCell = document.createElement('td');
        statusCell.innerHTML = getStatusHTML(result.Status);
        row.appendChild(statusCell);
        
        // Ping with color coding
        const pingCell = document.createElement('td');
        pingCell.innerHTML = getPingHTML(result.Latency);
        row.appendChild(pingCell);
        
        // Country
        const countryCell = document.createElement('td');
        countryCell.textContent = result.Country || '❓';
        row.appendChild(countryCell);
        
        // Provider
        const providerCell = document.createElement('td');
        providerCell.textContent = result.Provider || '-';
        row.appendChild(providerCell);
        
        // IP
        const ipCell = document.createElement('td');
        ipCell.textContent = result['Tested IP'] || '-';
        row.appendChild(ipCell);
        
        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <button class="btn btn-small btn-info" onclick="retestAccount(${index})">
                <i class="fas fa-redo"></i>
            </button>
        `;
        row.appendChild(actionsCell);
        
        table.appendChild(row);
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

// Get status HTML with appropriate styling
function getStatusHTML(status) {
    const statusMap = {
        'WAIT': { class: 'status-waiting', icon: 'fas fa-clock', text: 'Waiting' },
        'Testing...': { class: 'status-testing', icon: 'fas fa-spinner', text: 'Testing...' },
        '●': { class: 'status-success', icon: 'fas fa-check-circle', text: 'Success' },
        '✖': { class: 'status-failed', icon: 'fas fa-times-circle', text: 'Failed' },
        'retry': { class: 'status-retry', icon: 'fas fa-redo', text: 'Retry' }
    };
    
    const statusInfo = statusMap[status] || { class: 'status-waiting', icon: 'fas fa-question', text: status };
    
    return `<span class="${statusInfo.class}">
        <i class="${statusInfo.icon}"></i> ${statusInfo.text}
    </span>`;
}

// Get ping HTML with color coding
function getPingHTML(latency) {
    if (latency === -1 || latency === null) {
        return '<span class="ping-bad">-</span>';
    }
    
    const ping = parseInt(latency);
    let pingClass = 'ping-bad';
    let indicatorClass = 'bad';
    
    if (ping <= 50) {
        pingClass = 'ping-excellent';
        indicatorClass = 'excellent';
    } else if (ping <= 100) {
        pingClass = 'ping-good';
        indicatorClass = 'good';
    } else if (ping <= 200) {
        pingClass = 'ping-fair';
        indicatorClass = 'fair';
    } else if (ping <= 300) {
        pingClass = 'ping-poor';
        indicatorClass = 'poor';
    }
    
    return `<span class="${pingClass}">
        <span class="ping-indicator ${indicatorClass}"></span>
        ${ping}ms
    </span>`;
}

// Start test monitoring
function startTestMonitoring() {
    if (testInterval) {
        clearInterval(testInterval);
    }
    
    testInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/test-results');
            const data = await response.json();
            
            if (data.results) {
                testResults = data.results;
                displayTestResults(testResults);
                updateButtonStates();
                
                // Check if testing is complete
                if (!data.in_progress) {
                    clearInterval(testInterval);
                    testInterval = null;
                    showNotification('Testing completed!', 'success');
                }
            }
        } catch (error) {
            console.error('Error fetching test results:', error);
        }
    }, 1000);
}

// Retest individual account
async function retestAccount(index) {
    if (!parsedAccounts[index]) {
        showNotification('Account not found', 'error');
        return;
    }
    
    try {
        showLoading('Retesting account...');
        
        const response = await fetch('/api/parse-and-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                links: [parsedAccounts[index]],
                existing_config: ''
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to retest account');
        }
        
        showNotification('Account retest started', 'success');
        startTestMonitoring();
        
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}