import asyncio
import time
import json
import os
import re

from utils import is_alive, geoip_lookup, get_network_stats
from converter import extract_ip_port_from_path, get_test_target

MAX_RETRIES = 3
RETRY_DELAY = 1.5  # detik

def sanitize_filename(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', name.encode('ascii', 'ignore').decode('ascii'))

def clean_account_for_test(account: dict) -> dict:
    return {k: v for k, v in account.items() if not k.startswith('_')}

async def test_account(account: dict, semaphore: asyncio.Semaphore, index: int, live_results=None) -> dict:
    tag = account.get('tag', 'proxy')
    vpn_type = account.get('type', 'N/A')
    result = {
        "index": index, "VpnType": vpn_type, "OriginalTag": tag, "Latency": -1, "Jitter": -1, "ICMP": "N/A",
        "Country": "❓", "Provider": "-", "Tested IP": "-", "Status": "WAIT",
        "OriginalAccount": account, "TestType": "N/A", "Retry": 0
    }

    async with semaphore:
        # Use the new get_test_target function to get the best target
        target_ip, target_port, test_type = get_test_target(account)
        
        if not target_ip:
            result['Status'] = '✖ (No Target Found)'
            result['TestType'] = 'none'
            return result

        result['TestType'] = test_type
        result['Tested IP'] = target_ip

        try:
            target_port = int(target_port)
        except (ValueError, TypeError):
            target_port = 443

        for attempt in range(MAX_RETRIES):
            result['Status'] = 'Testing...'
            result['Retry'] = attempt
            if live_results is not None:
                live_results[index].update(result)
                await asyncio.sleep(0)  # yield to event loop

            is_connected, latency = is_alive(target_ip, target_port)
            if is_connected:
                geo_info = geoip_lookup(target_ip)
                result.update({
                    "Status": "●",
                    "TestType": f"{test_type.title()} TCP",
                    "Tested IP": target_ip,
                    "Latency": latency,
                    "Jitter": 0,
                    "ICMP": "✔",
                    **geo_info
                })
                return result

            if attempt < MAX_RETRIES - 1:
                result['Status'] = f"Retry({attempt+1})"
                result['Retry'] = attempt+1
                if live_results is not None:
                    live_results[index].update(result)
                    await asyncio.sleep(0)
                await asyncio.sleep(RETRY_DELAY)

        # Fallback ping jika TCP gagal semua
        for attempt in range(MAX_RETRIES):
            result['Status'] = 'Testing...'
            result['Retry'] = attempt
            if live_results is not None:
                live_results[index].update(result)
                await asyncio.sleep(0)

            stats = get_network_stats(target_ip)
            if stats.get("Latency") != -1:
                geo_info = geoip_lookup(target_ip)
                result.update({
                    "Status": "●",
                    "TestType": f"{test_type.title()} Ping",
                    "Tested IP": target_ip,
                    **stats,
                    **geo_info
                })
                return result

            if attempt < MAX_RETRIES - 1:
                result['Status'] = f"Retry({attempt+1})"
                result['Retry'] = attempt+1
                if live_results is not None:
                    live_results[index].update(result)
                    await asyncio.sleep(0)
                await asyncio.sleep(RETRY_DELAY)

    result['Status'] = f'✖ ({test_type.title()} Failed)'
    return result