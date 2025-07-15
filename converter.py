# converter.py
import base64
import json
from urllib.parse import urlparse, parse_qs, unquote
import socket
import re

# ======================================================
# == FUNGSI-FUNGSI PARSING DARI ANDA DIMASUKKAN DI SINI ==
# ======================================================
def is_alive(host, port=443):
    try:
        with socket.create_connection((host, int(port)), timeout=5):
            return True
    except Exception:
        return False

def extract_ip_port_from_path(path):
    m = re.search(r"/(\d+\.\d+\.\d+\.\d+)-(\d+)", path)
    if m:
        return m.group(1), int(m.group(2))
    return None, None

def clean_host_from_server(host, server):
    """Remove server part from host if it contains it"""
    if not host or not server:
        return host
    
    # Remove server prefix if host starts with server
    if host.startswith(server + "."):
        return host[len(server) + 1:]
    
    # Remove server suffix if host ends with server
    if host.endswith("." + server):
        return host[:-len("." + server)]
    
    # If host contains server as a subdomain, remove it
    if "." + server + "." in host:
        return host.replace("." + server + ".", ".")
    
    return host

def get_host_to_test(server, ws_host):
    """Get the best host for testing, cleaning up server redundancy"""
    if ws_host:
        cleaned_host = clean_host_from_server(ws_host, server)
        return cleaned_host if cleaned_host else ws_host
    return server

def get_test_target(account):
    """Get the best target (IP and port) for testing an account"""
    # First try to extract from path
    path_str = account.get("_ss_path") or account.get("_ws_path") or ""
    path_info = extract_ip_port_from_path(path_str)
    
    if path_info and path_info[0]:
        # Found IP in path
        target_ip = path_info[0]
        target_port = path_info[1] if path_info[1] else (account.get("server_port") or 443)
        return target_ip, target_port, "path"
    
    # If no IP in path, try to use host
    server = account.get("server", "")
    ws_host = account.get("_ws_host") or account.get("_ss_ws_host") or ""
    
    if ws_host:
        # Clean host and use it for testing
        cleaned_host = clean_host_from_server(ws_host, server)
        test_host = cleaned_host if cleaned_host else ws_host
        target_port = account.get("server_port") or 443
        return test_host, target_port, "host"
    
    # Fall back to server
    if server:
        target_port = account.get("server_port") or 443
        return server, target_port, "server"
    
    return None, None, "none"

def parse_ss(link):
    url = link.replace("ss://", "", 1)
    tag = ""
    if "#" in url:
        url, tag = url.split("#", 1)
        tag = unquote(tag)
    if "@" in url:
        base, rest = url.split("@", 1)
        base = unquote(base)
        try:
            decoded = base64.urlsafe_b64decode(base + "=" * (-len(base) % 4)).decode()
            method, password = decoded.split(":", 1)
        except Exception:
            method, password = base.split(":", 1)
        if "?" in rest:
            hostport, query = rest.split("?", 1)
        else:
            hostport, query = rest, ""
        if ":" in hostport:
            host, port = hostport.split(":", 1)
        else:
            host, port = hostport, ""
        query_params = parse_qs(query)
    else:
        if "?" in url:
            base, query = url.split("?", 1)
        else:
            base, query = url, ""
        base = unquote(base)
        try:
            decoded = base64.urlsafe_b64decode(base + "=" * (-len(base) % 4)).decode()
            if "@" in decoded:
                method_password, host_port = decoded.split("@", 1)
                method, password = method_password.split(":", 1)
                if ":" in host_port:
                    host, port = host_port.split(":", 1)
                else:
                    host, port = host_port, ""
            else:
                method, password = decoded.split(":", 1)
                host, port = "", ""
        except Exception:
            method = password = host = port = ""
        query_params = parse_qs(query)
        if not host and "server" in query_params:
            host = query_params["server"][0]
        if not port and "port" in query_params:
            port = query_params["port"][0]
    plugin = "v2ray-plugin"
    plugin_opts = []
    if query_params.get("type", [""])[0] == "ws":
        plugin_opts.append("mux=0")
    if "path" in query_params:
        plugin_opts.append(f"path={query_params['path'][0]}")
    if "host" in query_params:
        plugin_opts.append(f"host={query_params['host'][0]}")
    if "security" in query_params and query_params["security"][0] == "tls":
        plugin_opts.append("tls")
    if "sni" in query_params:
        plugin_opts.append(f"sni={query_params['sni'][0]}")
    if "encryption" in query_params:
        plugin_opts.append(f"encryption={query_params['encryption'][0]}")

    outbound = {
        "type": "shadowsocks",
        "tag": tag or host or "ss",
        "server": host,
        "server_port": int(port) if port else 443,
        "method": method,
        "password": password,
    }
    if plugin_opts:
        outbound["plugin"] = plugin
        outbound["plugin_opts"] = ";".join(plugin_opts)
    outbound["_ss_ws_host"] = query_params["host"][0] if "host" in query_params else ""
    outbound["_ss_path"] = query_params["path"][0] if "path" in query_params else ""
    return outbound

def parse_ssr(link):
    """Parse SSR (ShadowsocksR) links"""
    if not link.startswith("ssr://"):
        return None
    
    try:
        # Remove ssr:// prefix and decode base64
        config_b64 = link[6:]
        config_decoded = base64.urlsafe_b64decode(config_b64 + "=" * (-len(config_b64) % 4)).decode('utf-8')
        
        # Parse the SSR format: server:port:protocol:method:obfs:password_base64/?params
        parts = config_decoded.split('/')
        main_part = parts[0]
        params_part = parts[1] if len(parts) > 1 else ""
        
        # Parse main part
        server, port, protocol, method, obfs, password_b64 = main_part.split(':')
        password = base64.urlsafe_b64decode(password_b64 + "=" * (-len(password_b64) % 4)).decode('utf-8')
        
        # Parse parameters
        params = parse_qs(params_part) if params_part else {}
        
        tag = ""
        if 'remarks' in params:
            tag = base64.urlsafe_b64decode(params['remarks'][0] + "=" * (-len(params['remarks'][0]) % 4)).decode('utf-8')
        
        outbound = {
            "type": "shadowsocksr",
            "tag": tag or server or "ssr",
            "server": server,
            "server_port": int(port),
            "method": method,
            "password": password,
            "protocol": protocol,
            "obfs": obfs,
        }
        
        # Add additional parameters
        if 'obfsparam' in params:
            outbound["obfs_param"] = base64.urlsafe_b64decode(params['obfsparam'][0] + "=" * (-len(params['obfsparam'][0]) % 4)).decode('utf-8')
        if 'protoparam' in params:
            outbound["protocol_param"] = base64.urlsafe_b64decode(params['protoparam'][0] + "=" * (-len(params['protoparam'][0]) % 4)).decode('utf-8')
        
        return outbound
        
    except Exception as e:
        return None

def parse_vless(link):
    url = urlparse(link)
    params = parse_qs(url.query)
    net = params.get("type", ["ws"])[0]
    outbound = {
        "type": "vless",
        "tag": unquote(url.fragment) if url.fragment else url.hostname,
        "server": url.hostname,
        "server_port": int(url.port or 443),
        "uuid": url.username,
        "tls": {
            "enabled": params.get("security", ["tls"])[0] == "tls",
            "server_name": params.get("sni", [url.hostname])[0],
            "insecure": params.get("allowInsecure", ["false"])[0] == "true",
        },
        "transport": {},
    }
    if net == "ws":
        outbound["transport"] = {
            "type": "ws",
            "path": params.get("path", [""])[0],
            "headers": {"Host": params.get("host", [url.hostname])[0]},
        }
        outbound["_ws_host"] = params.get("host", [""])[0]
        outbound["_ws_path"] = params.get("path", [""])[0]
    elif net == "grpc":
        outbound["transport"] = {
            "type": "grpc",
            "service_name": params.get("serviceName", [""])[0],
        }
        outbound["_grpc_service"] = params.get("serviceName", [""])[0]
    elif net == "tcp":
        outbound["transport"] = {
            "type": "tcp",
            "header": {
                "type": params.get("headerType", ["none"])[0]
            }
        }
    else:
        outbound["_ws_host"] = ""
        outbound["_ws_path"] = ""
    return outbound

def parse_trojan(link):
    url = urlparse(link)
    params = parse_qs(url.query)
    outbound = {
        "type": "trojan",
        "tag": unquote(url.fragment) if url.fragment else url.hostname,
        "server": url.hostname,
        "server_port": int(url.port or 443),
        "password": url.username,
        "tls": {
            "enabled": params.get("security", ["tls"])[0] == "tls",
            "server_name": params.get("sni", [url.hostname])[0],
            "insecure": params.get("allowInsecure", ["false"])[0] == "true",
        },
        "transport": {},
    }
    net = params.get("type", ["ws"])[0]
    if net == "ws":
        outbound["transport"] = {
            "type": "ws",
            "path": params.get("path", [""])[0],
            "headers": {"Host": params.get("host", [url.hostname])[0]},
        }
        outbound["_ws_host"] = params.get("host", [""])[0]
        outbound["_ws_path"] = params.get("path", [""])[0]
    elif net == "grpc":
        outbound["transport"] = {
            "type": "grpc",
            "service_name": params.get("serviceName", [""])[0],
        }
        outbound["_grpc_service"] = params.get("serviceName", [""])[0]
    elif net == "tcp":
        outbound["transport"] = {
            "type": "tcp",
            "header": {
                "type": params.get("headerType", ["none"])[0]
            }
        }
    else:
        outbound["_ws_host"] = ""
        outbound["_ws_path"] = ""
    
    # Handle additional trojan parameters
    if "fp" in params:
        outbound["tls"]["fingerprint"] = params["fp"][0]
    if "encryption" in params:
        outbound["encryption"] = params["encryption"][0]
    
    return outbound

def parse_vmess(link):
    """Parse vmess:// links with base64 encoded config"""
    if not link.startswith("vmess://"):
        return None
    
    try:
        # Remove vmess:// prefix and decode base64
        config_b64 = link[8:]
        config_json = base64.b64decode(config_b64).decode('utf-8')
        config = json.loads(config_json)
        
        # Extract configuration
        outbound = {
            "type": "vmess",
            "tag": config.get("ps", config.get("add", "vmess")),
            "server": config.get("add", ""),
            "server_port": int(config.get("port", 443)),
            "uuid": config.get("id", ""),
            "security": config.get("scy", "auto"),
            "tls": {
                "enabled": config.get("tls", "none") == "tls",
                "server_name": config.get("sni", config.get("add", "")),
                "insecure": False
            },
            "transport": {}
        }
        
        # Only add alterId if it's not 0 (as per your request to remove encryption none)
        if int(config.get("aid", 0)) != 0:
            outbound["alterId"] = int(config.get("aid", 0))
        
        # Handle different transport types
        net = config.get("net", "ws")
        if net == "ws":
            outbound["transport"] = {
                "type": "ws",
                "path": config.get("path", "/"),
                "headers": {"Host": config.get("host", config.get("add", ""))}
            }
            outbound["_ws_host"] = config.get("host", "")
            outbound["_ws_path"] = config.get("path", "/")
        elif net == "grpc":
            outbound["transport"] = {
                "type": "grpc",
                "service_name": config.get("path", "")
            }
            outbound["_grpc_service"] = config.get("path", "")
        elif net == "tcp":
            outbound["transport"] = {
                "type": "tcp"
            }
            # Handle HTTP header obfuscation
            if config.get("type") == "http":
                outbound["transport"]["header"] = {
                    "type": "http",
                    "request": {
                        "path": [config.get("path", "/")],
                        "headers": {
                            "Host": [config.get("host", config.get("add", ""))]
                        }
                    }
                }
        elif net == "kcp":
            outbound["transport"] = {
                "type": "kcp",
                "header": {
                    "type": config.get("type", "none")
                }
            }
        elif net == "quic":
            outbound["transport"] = {
                "type": "quic",
                "header": {
                    "type": config.get("type", "none")
                }
            }
        else:
            outbound["_ws_host"] = ""
            outbound["_ws_path"] = ""
            
        return outbound
        
    except Exception as e:
        print(f"Error parsing vmess link: {e}")
        return None

def parse_hysteria(link):
    """Parse hysteria:// links"""
    if not link.startswith("hysteria://"):
        return None
    
    try:
        url = urlparse(link)
        params = parse_qs(url.query)
        
        outbound = {
            "type": "hysteria",
            "tag": unquote(url.fragment) if url.fragment else url.hostname,
            "server": url.hostname,
            "server_port": int(url.port or 443),
            "auth_str": url.username,
            "tls": {
                "enabled": True,
                "server_name": params.get("sni", [url.hostname])[0],
                "insecure": params.get("allowInsecure", ["false"])[0] == "true",
            }
        }
        
        # Handle additional hysteria parameters
        if "upmbps" in params:
            outbound["up_mbps"] = int(params["upmbps"][0])
        if "downmbps" in params:
            outbound["down_mbps"] = int(params["downmbps"][0])
        if "obfs" in params:
            outbound["obfs"] = params["obfs"][0]
        
        return outbound
        
    except Exception as e:
        return None

def parse_hysteria2(link):
    """Parse hysteria2:// or hy2:// links"""
    if not (link.startswith("hysteria2://") or link.startswith("hy2://")):
        return None
    
    try:
        url = urlparse(link)
        params = parse_qs(url.query)
        
        outbound = {
            "type": "hysteria2",
            "tag": unquote(url.fragment) if url.fragment else url.hostname,
            "server": url.hostname,
            "server_port": int(url.port or 443),
            "password": url.username,
            "tls": {
                "enabled": True,
                "server_name": params.get("sni", [url.hostname])[0],
                "insecure": params.get("allowInsecure", ["false"])[0] == "true",
            }
        }
        
        # Handle additional hysteria2 parameters
        if "obfs" in params:
            outbound["obfs"] = {
                "type": params["obfs"][0],
                "password": params.get("obfs-password", [""])[0]
            }
        
        return outbound
        
    except Exception as e:
        return None

def parse_tuic(link):
    """Parse tuic:// links"""
    if not link.startswith("tuic://"):
        return None
    
    try:
        url = urlparse(link)
        params = parse_qs(url.query)
        
        # Extract UUID and password from username
        if url.username and ":" in url.username:
            uuid, password = url.username.split(":", 1)
        else:
            uuid = url.username
            password = ""
        
        outbound = {
            "type": "tuic",
            "tag": unquote(url.fragment) if url.fragment else url.hostname,
            "server": url.hostname,
            "server_port": int(url.port or 443),
            "uuid": uuid,
            "password": password,
            "tls": {
                "enabled": True,
                "server_name": params.get("sni", [url.hostname])[0],
                "insecure": params.get("allowInsecure", ["false"])[0] == "true",
            }
        }
        
        # Handle additional tuic parameters
        if "congestion_control" in params:
            outbound["congestion_control"] = params["congestion_control"][0]
        if "udp_relay_mode" in params:
            outbound["udp_relay_mode"] = params["udp_relay_mode"][0]
        if "alpn" in params:
            outbound["tls"]["alpn"] = params["alpn"][0].split(",")
        
        return outbound
        
    except Exception as e:
        return None

def parse_link(link):
    """Enhanced link parser that supports multiple VPN protocols"""
    link = link.strip()
    
    if link.startswith("vmess://"):
        return parse_vmess(link)
    elif link.startswith("vless://"):
        return parse_vless(link)
    elif link.startswith("trojan://"):
        return parse_trojan(link)
    elif link.startswith("ss://"):
        return parse_ss(link)
    elif link.startswith("ssr://"):
        return parse_ssr(link)
    elif link.startswith("hysteria://"):
        return parse_hysteria(link)
    elif link.startswith("hysteria2://") or link.startswith("hy2://"):
        return parse_hysteria2(link)
    elif link.startswith("tuic://"):
        return parse_tuic(link)
    else:
        return None

def inject_outbounds_to_template(template_data: dict, new_outbounds: list) -> dict:
    if not new_outbounds:
        return template_data
    
    # Clean up outbounds - remove "encryption": "none"
    for outbound in new_outbounds:
        if "encryption" in outbound and outbound["encryption"] == "none":
            del outbound["encryption"]
    
    all_new_tags = [acc['tag'] for acc in new_outbounds]
    
    # DEBUG: print all tags
    for tag in all_new_tags:
        print("TAG INJECTED:", tag)
    
    # Add new tags to existing selectors
    for outbound in template_data.get("outbounds", []):
        if outbound.get("tag") in ["Internet", "Best Latency", "Lock Region ID"]:
            outbound_list = outbound.get("outbounds", [])
            for tag in all_new_tags:
                if tag not in outbound_list:
                    outbound_list.append(tag)
    
    # Find existing accounts and merge with new ones
    existing_outbounds = []
    direct_index = -1
    
    for i, outbound in enumerate(template_data["outbounds"]):
        if outbound.get("tag") == "direct":
            direct_index = i
            break
        elif outbound.get("type") in ["vmess", "vless", "trojan", "shadowsocks", "shadowsocksr", "hysteria", "hysteria2", "tuic"]:
            existing_outbounds.append(outbound)
    
    # Merge new outbounds with existing ones, avoiding duplicates
    merged_outbounds = existing_outbounds.copy()
    for new_outbound in new_outbounds:
        # Check if this account already exists (by tag)
        existing_tags = [acc.get("tag") for acc in merged_outbounds]
        if new_outbound.get("tag") not in existing_tags:
            merged_outbounds.append(new_outbound)
    
    # Insert merged outbounds at the correct position
    if direct_index != -1:
        template_data["outbounds"] = (
            template_data["outbounds"][:direct_index] + 
            merged_outbounds + 
            template_data["outbounds"][direct_index:]
        )
    else:
        template_data["outbounds"].extend(merged_outbounds)
    
    return template_data
