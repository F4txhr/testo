# utils.py
import socket
import re
import requests
import time
import subprocess
import statistics

def get_flag_emoji(country_code: str) -> str:
    """Membuat emoji bendera dari dua huruf kode negara."""
    if not isinstance(country_code, str) or len(country_code) != 2:
        return '❓'
    return "".join(chr(ord(char.upper()) - ord('A') + 0x1F1E6) for char in country_code)

def get_network_stats(host: str, count: int = 4) -> dict:
    """
    Menjalankan ping dan menghitung latensi, jitter, dan status ICMP.
    """
    command = ["ping", "-c", str(count), "-i", "0.2", host]
    result = {"Latency": -1, "Jitter": -1, "ICMP": "Failed"}

    try:
        output = subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True, timeout=5)

        latencies = [float(x) for x in re.findall(r"time=([\d.]+)", output)]
        if not latencies:
            return result

        result["Latency"] = round(statistics.mean(latencies))

        if len(latencies) > 1:
            jitters = [abs(latencies[i] - latencies[i-1]) for i in range(1, len(latencies))]
            result["Jitter"] = round(statistics.mean(jitters))
        else:
            result["Jitter"] = 0

        loss_match = re.search(r"(\d+)% packet loss", output)
        if loss_match and int(loss_match.group(1)) == 0:
            result["ICMP"] = "✔"
        else:
            received_match = re.search(r"(\d+) packets received", output) or re.search(r"(\d+) received", output)
            received = int(received_match.group(1)) if received_match else 0
            result["ICMP"] = f"{received}/{count}"

    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        pass

    return result

def is_alive(host, port=443, timeout=3) -> tuple[bool, int]:
    """
    Mengecek koneksi port dan mengukur latensi TCP.
    Fungsi ini dikembalikan untuk digunakan oleh tes fallback.
    """
    start_time = time.time()
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            latency = int((time.time() - start_time) * 1000)
            return True, latency
    except (socket.timeout, ConnectionRefusedError, OSError, TypeError):
        return False, -1

def shorten_provider_name(name: str, max_len: int = 20) -> str:
    """Memendekkan nama provider agar tidak terlalu panjang."""
    if len(name) > max_len:
        common_names = ["OVH", "Alibaba", "Google", "Amazon", "Cloudflare", "DigitalOcean", "Hetzner", "Vultr", "Linode"]
        for cn in common_names:
            if cn.lower() in name.lower():
                return cn
        return name[:max_len-3] + "..."
    return name

def geoip_lookup(ip: str) -> dict:
    """Mencari informasi GeoIP dan mengembalikan provider utuh."""
    default_result = {"Country": "❓", "Provider": "-"}
    if not ip or not isinstance(ip, str): return default_result

    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,isp,org"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                provider = data.get('org') or data.get('isp') or "-"
                return {
                    "Country": get_flag_emoji(data.get('countryCode', '')),
                    "Provider": provider    # <--- FULL!
                }
        return default_result
    except requests.RequestException:
        return default_result
