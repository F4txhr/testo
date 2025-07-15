#!/usr/bin/env python3
"""
VortexVPN Config Manager - Web Application
A modern web interface for VPN configuration testing and management
"""

import os
import sys
import subprocess
import webbrowser
from threading import Timer

def install_requirements():
    """Install required packages"""
    print("Installing required packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def open_browser():
    """Open browser after a short delay"""
    webbrowser.open('http://localhost:5000')

def main():
    print("=" * 60)
    print("🛡️  VortexVPN Config Manager - Web Application")
    print("=" * 60)
    print()
    
    # Check if requirements are installed
    try:
        import flask
        import requests
    except ImportError:
        print("📦 Installing dependencies...")
        install_requirements()
        print("✅ Dependencies installed successfully!")
        print()
    
    # Set environment variables
    os.environ['FLASK_ENV'] = 'development'
    
    print("🚀 Starting VortexVPN Config Manager...")
    print("📱 Web interface will be available at: http://localhost:5000")
    print()
    print("Features:")
    print("• 🔗 Parse VPN links (vless, vmess, trojan, ss)")
    print("• 🧪 Test VPN connections")
    print("• 🐙 GitHub integration")
    print("• 📱 Mobile-responsive design")
    print("• 🌙 Dark theme with animations")
    print("• 📁 File upload/download")
    print("• ⚡ Real-time testing results")
    print()
    print("Press Ctrl+C to stop the server")
    print("-" * 60)
    
    # Open browser after 2 seconds
    Timer(2.0, open_browser).start()
    
    # Import and run the Flask app
    from app import app
    app.run(host='0.0.0.0', port=5000, debug=True)

if __name__ == "__main__":
    main()