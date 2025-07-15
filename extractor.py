# extractor.py
import json
import re

VALID_ACCOUNT_TYPES = {"vmess", "vless", "trojan", "shadowsocks"}

def extract_path_from_plugin_opts(opts_string: str) -> str | None:
    """Mengekstrak nilai 'path' dari string plugin_opts."""
    if not isinstance(opts_string, str):
        return None
    match = re.search(r'path=([^;]+)', opts_string)
    if match:
        return match.group(1)
    return None

def extract_accounts_from_config(config_data: dict) -> list[dict]:
    """
    Membaca config, mengekstrak akun, dan menambahkan _ws_path
    baik dari 'transport' maupun 'plugin_opts'.
    """
    accounts = []
    if not isinstance(config_data, dict):
        return []

    for outbound in config_data.get("outbounds", []):
        if outbound.get("type") in VALID_ACCOUNT_TYPES:
            path = None

            transport = outbound.get("transport", {})
            if isinstance(transport, dict) and "path" in transport:
                path = transport["path"]
            elif "plugin_opts" in outbound:
                path = extract_path_from_plugin_opts(outbound["plugin_opts"])

            if path:
                outbound["_ws_path"] = path

            accounts.append(outbound)

    print(f"✔️ Ditemukan dan diproses {len(accounts)} akun dari file konfigurasi.")
    return accounts
