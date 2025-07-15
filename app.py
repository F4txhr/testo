from flask import Flask, render_template, request, jsonify, send_file
import asyncio
import json
import os
import re
import base64
import threading
import time
from datetime import datetime
from converter import parse_link, inject_outbounds_to_template
from extractor import extract_accounts_from_config
from github_client import GitHubClient
from tester import test_account
from utils import get_network_stats, geoip_lookup
import tempfile

app = Flask(__name__)

# Global variables for managing test results
test_results = []
test_in_progress = False
test_semaphore = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/github/files', methods=['POST'])
def get_github_files():
    data = request.get_json()
    token = data.get('token')
    owner = data.get('owner')
    repo = data.get('repo')
    
    if not all([token, owner, repo]):
        return jsonify({'error': 'Missing required parameters'}), 400
    
    try:
        client = GitHubClient(token, owner, repo)
        files = client.list_files_in_repo()
        json_files = [f for f in files if f.get('name', '').endswith('.json')]
        return jsonify({'files': json_files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/github/file/<path:filepath>', methods=['POST'])
def get_github_file(filepath):
    data = request.get_json()
    token = data.get('token')
    owner = data.get('owner')
    repo = data.get('repo')
    
    if not all([token, owner, repo]):
        return jsonify({'error': 'Missing required parameters'}), 400
    
    try:
        client = GitHubClient(token, owner, repo)
        content, sha = client.get_file(filepath)
        if content:
            return jsonify({'content': content, 'sha': sha})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/github/upload', methods=['POST'])
def upload_to_github():
    data = request.get_json()
    token = data.get('token')
    owner = data.get('owner')
    repo = data.get('repo')
    filepath = data.get('filepath')
    content = data.get('content')
    commit_msg = data.get('commit_msg', 'Update config')
    sha = data.get('sha')
    
    if not all([token, owner, repo, filepath, content]):
        return jsonify({'error': 'Missing required parameters'}), 400
    
    try:
        client = GitHubClient(token, owner, repo)
        result = client.update_or_create_file(filepath, content, commit_msg, sha)
        if result:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Upload failed'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/parse-links', methods=['POST'])
def parse_links():
    data = request.get_json()
    links = data.get('links', [])
    
    if isinstance(links, str):
        # Enhanced pattern to match all VPN types
        vpn_pattern = r"(?:vless|vmess|trojan|ss|ssr|hysteria|hysteria2|hy2|tuic)://[^\s]+"
        links = re.findall(vpn_pattern, links)
    
    parsed_accounts = []
    for link in links:
        parsed = parse_link(link.strip())
        if parsed:
            parsed_accounts.append(parsed)
    
    return jsonify({'accounts': parsed_accounts, 'count': len(parsed_accounts)})

@app.route('/api/test-accounts', methods=['POST'])
def start_test():
    global test_results, test_in_progress, test_semaphore
    
    data = request.get_json()
    accounts = data.get('accounts', [])
    max_concurrent = data.get('max_concurrent', 5)
    
    if not accounts:
        return jsonify({'error': 'No accounts provided'}), 400
    
    if test_in_progress:
        return jsonify({'error': 'Test already in progress'}), 400
    
    test_in_progress = True
    test_results = []
    test_semaphore = asyncio.Semaphore(max_concurrent)
    
    # Initialize results
    for i, acc in enumerate(accounts):
        test_results.append({
            'index': i,
            'account': acc,
            'status': 'WAIT',
            'country': '❓',
            'provider': '-',
            'ip': '-',
            'latency': -1,
            'jitter': -1,
            'icmp': 'N/A',
            'retry': 0
        })
    
    # Start testing in background
    def run_tests():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(test_accounts_async(accounts))
        loop.close()
    
    thread = threading.Thread(target=run_tests)
    thread.daemon = True
    thread.start()
    
    return jsonify({'success': True, 'total': len(accounts)})

async def test_accounts_async(accounts):
    global test_results, test_in_progress, test_semaphore
    
    try:
        tasks = []
        for i, acc in enumerate(accounts):
            task = test_account(acc, test_semaphore, i, test_results)
            tasks.append(task)
        
        for completed_task in asyncio.as_completed(tasks):
            result = await completed_task
            if result['index'] < len(test_results):
                test_results[result['index']].update({
                    'status': result.get('Status', 'FAILED'),
                    'country': result.get('Country', '❓'),
                    'provider': result.get('Provider', '-'),
                    'ip': result.get('Tested IP', '-'),
                    'latency': result.get('Latency', -1),
                    'jitter': result.get('Jitter', -1),
                    'icmp': result.get('ICMP', 'N/A'),
                    'retry': result.get('Retry', 0)
                })
    finally:
        test_in_progress = False

@app.route('/api/test-status')
def get_test_status():
    global test_results, test_in_progress
    return jsonify({
        'in_progress': test_in_progress,
        'results': test_results
    })

@app.route('/api/generate-config', methods=['POST'])
def generate_config():
    data = request.get_json()
    successful_results = data.get('successful_results', [])
    
    if not successful_results:
        return jsonify({'error': 'No successful accounts provided'}), 400
    
    try:
        # Load template
        with open('template.json', 'r') as f:
            template_data = json.load(f)
        
        # Extract successful accounts and clean them
        final_accounts = []
        for i, result in enumerate(successful_results):
            account = result['account'].copy()
            
            # Clean internal fields
            account = {k: v for k, v in account.items() if not k.startswith('_')}
            
            # Generate clean tag
            country = result.get('country', '')
            provider = result.get('provider', '-')
            # Clean provider name
            provider = re.sub(r'\(.*?\)', '', provider).replace(',', '').strip()
            account['tag'] = f"{country} {provider} -{i+1}".strip()
            
            final_accounts.append(account)
        
        # Inject accounts into template
        final_config = inject_outbounds_to_template(template_data, final_accounts)
        config_str = json.dumps(final_config, indent=2, ensure_ascii=False)
        
        return jsonify({'config': config_str})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-config', methods=['POST'])
def download_config():
    data = request.get_json()
    config_str = data.get('config', '')
    
    if not config_str:
        return jsonify({'error': 'No config provided'}), 400
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    filename = f"VortexVpn-{timestamp}.json"
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(config_str)
        temp_path = f.name
    
    return send_file(temp_path, as_attachment=True, download_name=filename)

@app.route('/api/extract-from-config', methods=['POST'])
def extract_from_config():
    data = request.get_json()
    config_str = data.get('config', '')
    
    if not config_str:
        return jsonify({'error': 'No config provided'}), 400
    
    try:
        config_data = json.loads(config_str)
        accounts = extract_accounts_from_config(config_data)
        return jsonify({'accounts': accounts, 'count': len(accounts)})
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON config'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/parse-and-test', methods=['POST'])
def parse_and_test():
    global test_results, test_in_progress, test_semaphore
    
    data = request.get_json()
    links = data.get('links', [])
    existing_config = data.get('existing_config', '')
    
    if not links and not existing_config:
        return jsonify({'error': 'No links or existing config provided'}), 400
    
    try:
        # Parse new links
        all_accounts = []
        if links:
            for link in links:
                try:
                    account = parse_link(link)
                    if account:
                        all_accounts.append(account)
                except Exception as e:
                    print(f"Error parsing link {link}: {e}")
                    continue
        
        # Extract accounts from existing config
        if existing_config:
            try:
                config_data = json.loads(existing_config)
                existing_accounts = extract_accounts_from_config(config_data)
                all_accounts.extend(existing_accounts)
            except json.JSONDecodeError:
                pass
        
        if not all_accounts:
            return jsonify({'error': 'No valid accounts found'}), 400
        
        # Initialize test results
        test_results = []
        test_in_progress = True
        test_semaphore = asyncio.Semaphore(5)
        
        # Start testing in a separate thread
        def test_worker():
            global test_results, test_in_progress
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Initialize results
                test_results = [None] * len(all_accounts)
                
                # Create test tasks
                tasks = []
                for i, account in enumerate(all_accounts):
                    task = test_account(account, test_semaphore, i, test_results)
                    tasks.append(task)
                
                # Run tests
                loop.run_until_complete(asyncio.gather(*tasks))
                
                # Update results
                for i, result in enumerate(test_results):
                    if result is not None:
                        test_results[i] = result
                
            except Exception as e:
                print(f"Error in test worker: {e}")
            finally:
                test_in_progress = False
                loop.close()
        
        # Start testing thread
        test_thread = threading.Thread(target=test_worker)
        test_thread.daemon = True
        test_thread.start()
        
        return jsonify({
            'message': 'Parse and test started',
            'account_count': len(all_accounts),
            'accounts': all_accounts
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)